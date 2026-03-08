using Amazon.BedrockRuntime.Model;
using GetTrainMate.Api.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace GetTrainMate.Api.Services.Bedrock;

/// <summary>
/// Production Bedrock chat: uses Converse/ConverseStream when configured, with optional guardrails.
/// When Bedrock is not configured, returns stub-style messages (caller can also register BedrockChatServiceStub instead).
/// </summary>
public class BedrockChatService : IBedrockChatService
{
    private readonly IBedrockClientWrapper _client;
    private readonly IBedrockGuardrails _guardrails;
    private readonly ILogger<BedrockChatService> _logger;
    private readonly BedrockOptions _options;

    public BedrockChatService(
        IBedrockClientWrapper client,
        IBedrockGuardrails guardrails,
        IOptions<BedrockOptions> options,
        ILogger<BedrockChatService> logger)
    {
        _client = client;
        _guardrails = guardrails;
        _options = options?.Value ?? new BedrockOptions();
        _logger = logger;
    }

    public async Task<BedrockChatResponse> SendAsync(
        string systemPrompt,
        IReadOnlyList<BedrockChatMessage> history,
        string userMessage,
        CancellationToken cancellationToken = default)
    {
        if (!_client.IsAvailable)
        {
            _logger.LogDebug("[BedrockChat] Not configured; returning placeholder.");
            return new BedrockChatResponse(
                "AI Coach is being connected. You can use it for profile tips, match insights, and workout ideas once Bedrock is configured.",
                "end_turn", 0, 0);
        }

        var inputResult = await _guardrails.ValidateInputAsync(userMessage, "ai_coach", cancellationToken);
        if (!inputResult.Passed)
        {
            _logger.LogInformation("[BedrockChat] Input blocked by guardrails: {Reason}", inputResult.BlockedReason);
            return new BedrockChatResponse("I can't respond to that. Please ask something else.", "blocked", 0, 0);
        }
        var safeUserMessage = inputResult.Content;

        try
        {
            var response = await _client.ConverseAsync(systemPrompt, history, safeUserMessage, cancellationToken);
            var content = GetResponseText(response);
            var outputResult = await _guardrails.ValidateOutputAsync(content, "ai_coach", cancellationToken);
            if (!outputResult.Passed)
            {
                _logger.LogInformation("[BedrockChat] Output blocked by guardrails: {Reason}", outputResult.BlockedReason);
                return new BedrockChatResponse("I'm not able to show that response. Try rephrasing.", "blocked", 0, 0);
            }
            return new BedrockChatResponse(
                outputResult.Content,
                response.StopReason ?? "end_turn",
                (int)(response.Usage?.InputTokens ?? 0),
                (int)(response.Usage?.OutputTokens ?? 0));
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[BedrockChat] Converse failed");
            return new BedrockChatResponse("Something went wrong. Please try again in a moment.", "error", 0, 0);
        }
    }

    public async IAsyncEnumerable<string> SendStreamAsync(
        string systemPrompt,
        IReadOnlyList<BedrockChatMessage> history,
        string userMessage,
        [System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        if (!_client.IsAvailable)
        {
            yield return "AI Coach ";
            await Task.Delay(50, cancellationToken);
            yield return "streaming ";
            await Task.Delay(50, cancellationToken);
            yield return "coming soon.";
            yield break;
        }

        var inputResult = await _guardrails.ValidateInputAsync(userMessage, "ai_coach", cancellationToken);
        if (!inputResult.Passed)
        {
            yield return "I can't respond to that. Please ask something else.";
            yield break;
        }
        var safeUserMessage = inputResult.Content;

        IAsyncEnumerable<string>? stream = null;
        try
        {
            stream = _client.ConverseStreamAsync(systemPrompt, history, safeUserMessage, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[BedrockChat] ConverseStream failed");
        }
        if (stream == null)
        {
            yield return "Something went wrong. Please try again.";
            yield break;
        }
        await foreach (var token in stream.WithCancellation(cancellationToken))
        {
            yield return token;
        }
    }

    private static string GetResponseText(ConverseResponse response)
    {
        var msg = response.Output?.Message;
        if (msg?.Content == null || msg.Content.Count == 0)
            return "";
        var block = msg.Content[0];
        return block?.Text ?? "";
    }
}
