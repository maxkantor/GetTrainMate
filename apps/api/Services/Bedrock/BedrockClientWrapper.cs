using Amazon.BedrockRuntime;
using Amazon.BedrockRuntime.Model;
using GetTrainMate.Api.Configuration;
using GetTrainMate.Api.Services;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace GetTrainMate.Api.Services.Bedrock;

/// <summary>
/// Reusable Bedrock Runtime client. When BedrockOptions.ModelId is not set, all Converse calls are no-ops
/// and the caller should use stub implementations. When set, uses Converse/ConverseStream for chat.
/// </summary>
public interface IBedrockClientWrapper
{
    bool IsAvailable { get; }
    Task<ConverseResponse> ConverseAsync(string systemPrompt, IReadOnlyList<BedrockChatMessage> history, string userMessage, CancellationToken cancellationToken = default);
    IAsyncEnumerable<string> ConverseStreamAsync(string systemPrompt, IReadOnlyList<BedrockChatMessage> history, string userMessage, CancellationToken cancellationToken = default);
}

public class BedrockClientWrapper : IBedrockClientWrapper
{
    private readonly IAmazonBedrockRuntime? _client;
    private readonly BedrockOptions _options;
    private readonly ILogger<BedrockClientWrapper> _logger;

    public BedrockClientWrapper(IOptions<BedrockOptions> options, ILogger<BedrockClientWrapper> logger)
    {
        _options = options?.Value ?? new BedrockOptions();
        _logger = logger;
        if (_options.IsConfigured)
        {
            var region = Amazon.RegionEndpoint.GetBySystemName(_options.Region);
            _client = new AmazonBedrockRuntimeClient(region);
        }
        else
        {
            _client = null;
            _logger.LogInformation("[Bedrock] ModelId not set; using stub mode. Set Bedrock:ModelId for live Bedrock.");
        }
    }

    public bool IsAvailable => _client != null && _options.IsConfigured;

    public async Task<ConverseResponse> ConverseAsync(string systemPrompt, IReadOnlyList<BedrockChatMessage> history, string userMessage, CancellationToken cancellationToken = default)
    {
        if (_client == null || !_options.IsConfigured)
            throw new InvalidOperationException("Bedrock is not configured. Set Bedrock:ModelId.");

        var messages = BuildMessages(history, userMessage);
        var request = new ConverseRequest
        {
            ModelId = _options.ModelId,
            System = new List<SystemContentBlock> { new SystemContentBlock { Text = systemPrompt } },
            Messages = messages,
            InferenceConfig = new InferenceConfiguration
            {
                MaxTokens = _options.MaxTokens,
                Temperature = _options.Temperature,
            },
        };

        try
        {
            var response = await _client.ConverseAsync(request, cancellationToken);
            _logger.LogDebug("[Bedrock] Converse completed. InputTokens={InputTokens}, OutputTokens={OutputTokens}",
                response.Usage?.InputTokens ?? 0, response.Usage?.OutputTokens ?? 0);
            return response;
        }
        catch (AmazonBedrockRuntimeException ex)
        {
            _logger.LogWarning(ex, "[Bedrock] Converse failed: {Message}", ex.Message);
            throw;
        }
    }

    public async IAsyncEnumerable<string> ConverseStreamAsync(string systemPrompt, IReadOnlyList<BedrockChatMessage> history, string userMessage, [System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        if (_client == null || !_options.IsConfigured)
        {
            await Task.CompletedTask;
            yield break;
        }

        var messages = BuildMessages(history, userMessage);
        var request = new ConverseStreamRequest
        {
            ModelId = _options.ModelId,
            System = new List<SystemContentBlock> { new SystemContentBlock { Text = systemPrompt } },
            Messages = messages,
            InferenceConfig = new InferenceConfiguration
            {
                MaxTokens = _options.MaxTokens,
                Temperature = _options.Temperature,
            },
        };

        ConverseStreamResponse response;
        try
        {
            response = await _client.ConverseStreamAsync(request, cancellationToken);
        }
        catch (AmazonBedrockRuntimeException ex)
        {
            _logger.LogWarning(ex, "[Bedrock] ConverseStream failed: {Message}", ex.Message);
            throw;
        }
        foreach (var chunk in response.Stream.AsEnumerable())
        {
            cancellationToken.ThrowIfCancellationRequested();
            if (chunk is ContentBlockDeltaEvent delta)
            {
                var text = delta.Delta?.Text;
                if (!string.IsNullOrEmpty(text))
                    yield return text;
            }
        }
    }

    private static List<Message> BuildMessages(IReadOnlyList<BedrockChatMessage> history, string userMessage)
    {
        var list = new List<Message>();
        foreach (var m in history)
        {
            var role = m.Role == "user" ? ConversationRole.User : ConversationRole.Assistant;
            list.Add(new Message { Role = role, Content = new List<ContentBlock> { new ContentBlock { Text = m.Content } } });
        }
        list.Add(new Message { Role = ConversationRole.User, Content = new List<ContentBlock> { new ContentBlock { Text = userMessage } } });
        return list;
    }
}
