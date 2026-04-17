namespace GetTrainMate.Api;

/// <summary>
/// Holds Stripe webhook signing secret(s) from SSM or env.
/// Use comma-, semicolon-, or newline-separated values when rotating (old + new <c>whsec_...</c> briefly).
/// </summary>
public class StripeWebhookSecret
{
    /// <summary>Primary secret (first entry) — backward compatible for callers using <see cref="Value"/>.</summary>
    public string Value => SigningSecrets.Count > 0 ? SigningSecrets[0] : string.Empty;

    public IReadOnlyList<string> SigningSecrets { get; }

    public bool HasSigningSecrets => SigningSecrets.Count > 0;

    public StripeWebhookSecret(string raw)
    {
        var trimmed = (raw ?? string.Empty).Trim();
        if (string.IsNullOrEmpty(trimmed))
        {
            SigningSecrets = Array.Empty<string>();
            return;
        }
        var parts = trimmed
            .Split(new[] { ',', ';', '\n', '\r' }, StringSplitOptions.RemoveEmptyEntries)
            .Select(s => s.Trim())
            .Where(s => s.Length > 0)
            .ToArray();
        SigningSecrets = parts.Length > 0 ? parts : Array.Empty<string>();
    }
}
