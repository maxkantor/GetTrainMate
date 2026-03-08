namespace GetTrainMate.Api.Services;

/// <summary>
/// Abstraction for Amazon Bedrock chat (Converse / ConverseStream).
/// Supports system prompt, user messages, and streamed assistant responses.
/// Future: guardrails config, model selection, error handling.
/// </summary>
public interface IBedrockChatService
{
    /// <summary>
    /// Send a user message and get a single assistant response (non-streaming).
    /// Used for simple request/response until streaming is wired.
    /// </summary>
    Task<BedrockChatResponse> SendAsync(
        string systemPrompt,
        IReadOnlyList<BedrockChatMessage> history,
        string userMessage,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Stream assistant response tokens (for future ConverseStream integration).
    /// </summary>
    IAsyncEnumerable<string> SendStreamAsync(
        string systemPrompt,
        IReadOnlyList<BedrockChatMessage> history,
        string userMessage,
        CancellationToken cancellationToken = default);
}

public record BedrockChatMessage(string Role, string Content);

public record BedrockChatResponse(string Content, string? StopReason, int InputTokens, int OutputTokens);
