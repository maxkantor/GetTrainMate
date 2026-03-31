namespace GetTrainMate.Api.Configuration;

/// <summary>
/// Bedrock model and feature config. Set via appsettings or env (e.g. BEDROCK_MODEL_ID, BEDROCK_REGION).
/// When ModelId is empty, the stub implementation is used (no AWS calls).
/// </summary>
public class BedrockOptions
{
    public const string SectionName = "Bedrock";

    /// <summary>e.g. us.anthropic.claude-haiku-4-5-20251001-v1:0 (inference profile) or amazon.nova-lite-v1:0. Empty = use stub.</summary>
    public string ModelId { get; set; } = "";

    /// <summary>AWS region for Bedrock (e.g. us-east-1).</summary>
    public string Region { get; set; } = "us-east-1";

    /// <summary>Max tokens per response.</summary>
    public int MaxTokens { get; set; } = 1024;

    /// <summary>Temperature 0-1.</summary>
    public float Temperature { get; set; } = 0.5f;

    /// <summary>Guardrails identifier (optional).</summary>
    public string? GuardrailIdentifier { get; set; }

    /// <summary>Guardrails version (optional).</summary>
    public string? GuardrailVersion { get; set; }

    public bool IsConfigured => !string.IsNullOrWhiteSpace(ModelId);
}
