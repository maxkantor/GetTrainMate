using System.Text.RegularExpressions;

namespace GetTrainMate.Api.Infrastructure;

/// <summary>
/// Sanitizes acquisition attribution for Stripe metadata (no PII).
/// Allowed keys only; values truncated and character-filtered.
/// </summary>
public static class StripeAcquisitionMetadata
{
    private static readonly HashSet<string> AllowedKeys = new(StringComparer.OrdinalIgnoreCase)
    {
        "acquisition_source",
        "experiment_id",
        "metro",
        "mode",
        "utm_source",
        "utm_medium",
        "utm_campaign",
        "utm_content",
        "utm_term",
        "src",
        "partner_code",
        "partner",
    };

    private static readonly Regex SafeValue = new(@"^[a-zA-Z0-9.\-:%_]{1,64}$", RegexOptions.Compiled);

    public static void MergeInto(Dictionary<string, string> target, IDictionary<string, string>? attribution)
    {
        if (target == null || attribution == null || attribution.Count == 0) return;
        foreach (var kv in attribution)
        {
            if (string.IsNullOrWhiteSpace(kv.Key) || !AllowedKeys.Contains(kv.Key.Trim()))
                continue;
            var key = kv.Key.Trim().ToLowerInvariant();
            if (key == "src") key = "acquisition_source";
            if (key == "partner") key = "partner_code";
            var value = (kv.Value ?? string.Empty).Trim();
            if (value.Length > 64) value = value[..64];
            if (!SafeValue.IsMatch(value)) continue;
            target[key] = value;
        }
    }
}
