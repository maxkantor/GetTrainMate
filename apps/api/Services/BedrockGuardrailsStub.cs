namespace GetTrainMate.Api.Services;

/// <summary>
/// Stub: no guardrails applied. Replace with Bedrock Guardrails API when configured.
/// </summary>
public class BedrockGuardrailsStub : IBedrockGuardrails
{
    public Task<GuardrailsResult> ValidateInputAsync(string content, string? context = null, CancellationToken cancellationToken = default)
        => Task.FromResult(new GuardrailsResult(Passed: true, content, null));

    public Task<GuardrailsResult> ValidateOutputAsync(string content, string? context = null, CancellationToken cancellationToken = default)
        => Task.FromResult(new GuardrailsResult(Passed: true, content, null));
}
