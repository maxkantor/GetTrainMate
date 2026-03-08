namespace GetTrainMate.Api.Services;

/// <summary>
/// Integration point for Bedrock Guardrails (content filters, PII, topic blocks).
/// Apply to: AI coach chat, AI-generated icebreakers, support/help responses.
/// </summary>
public interface IBedrockGuardrails
{
    /// <summary>
    /// Validate and optionally redact content before sending to the model or returning to the user.
    /// Returns the (possibly modified) content and whether it passed.
    /// </summary>
    Task<GuardrailsResult> ValidateInputAsync(string content, string? context = null, CancellationToken cancellationToken = default);

    /// <summary>
    /// Validate model output before returning to the user.
    /// </summary>
    Task<GuardrailsResult> ValidateOutputAsync(string content, string? context = null, CancellationToken cancellationToken = default);
}

public record GuardrailsResult(bool Passed, string Content, string? BlockedReason);
