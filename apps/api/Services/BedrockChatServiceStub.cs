using Microsoft.Extensions.Logging;

namespace GetTrainMate.Api.Services;

/// <summary>
/// Stub implementation of Bedrock chat. Does not call AWS yet.
/// Replace with real Bedrock Converse/ConverseStream when model and guardrails are configured.
/// </summary>
public class BedrockChatServiceStub : IBedrockChatService
{
    private readonly ILogger<BedrockChatServiceStub> _logger;

    public BedrockChatServiceStub(ILogger<BedrockChatServiceStub> logger)
    {
        _logger = logger;
    }

    public Task<BedrockChatResponse> SendAsync(
        string systemPrompt,
        IReadOnlyList<BedrockChatMessage> history,
        string userMessage,
        CancellationToken cancellationToken = default)
    {
        _logger.LogDebug("BedrockChatServiceStub: SendAsync (stub)");
        return Task.FromResult(new BedrockChatResponse(
            Content: "AI Coach is being connected. You can use it soon for profile tips, match insights, and workout ideas.",
            StopReason: "end_turn",
            InputTokens: 0,
            OutputTokens: 0));
    }

    public async IAsyncEnumerable<string> SendStreamAsync(
        string systemPrompt,
        IReadOnlyList<BedrockChatMessage> history,
        string userMessage,
        [System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        _logger.LogDebug("BedrockChatServiceStub: SendStreamAsync (stub)");
        yield return "AI Coach ";
        await Task.Delay(50, cancellationToken);
        yield return "streaming ";
        await Task.Delay(50, cancellationToken);
        yield return "coming soon.";
    }
}
