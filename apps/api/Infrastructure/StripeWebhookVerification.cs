using System.Globalization;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Http;
using Stripe;

namespace GetTrainMate.Api.Infrastructure;

/// <summary>
/// Stripe signs the exact raw POST bytes. Read via <see cref="ReadRawBodyUtf8Async"/> (no StreamReader)
/// so the string passed to <see cref="EventUtility"/> matches what Stripe hashed.
/// </summary>
public static class StripeWebhookVerification
{
    /// <summary>Stripe allows clock skew between signing and delivery; default SDK tolerance is 300s.</summary>
    public const int SignatureToleranceSeconds = 600;

    /// <summary>
    /// API Gateway HTTP API (and some proxies) may forward <c>Stripe-Signature</c> as multiple header values
    /// (e.g. separate <c>t=</c> and <c>v1=</c>). Taking only the first value drops <c>v1</c>, Stripe.NET reports
    /// "expected signature was not found" and <c>v1</c> count appears as 0.
    /// </summary>
    public static string? GetStripeSignatureHeader(IHeaderDictionary headers)
    {
        if (!headers.TryGetValue("Stripe-Signature", out var values) || values.Count == 0)
            return null;
        if (values.Count == 1)
            return values[0];
        return string.Join(",", values.Select(s => s ?? string.Empty));
    }

    public static async Task<string> ReadRawBodyUtf8Async(HttpRequest request, CancellationToken cancellationToken = default)
    {
        request.EnableBuffering();
        request.Body.Position = 0;
        await using var ms = new MemoryStream();
        await request.Body.CopyToAsync(ms, cancellationToken);
        return Encoding.UTF8.GetString(ms.ToArray());
    }

    /// <summary>First 12 hex chars of SHA-256(raw UTF-8 bytes) — safe correlation with Stripe support without logging body.</summary>
    public static string BodySha256Prefix12(string json)
    {
        var bytes = Encoding.UTF8.GetBytes(json);
        var hash = SHA256.HashData(bytes);
        return Convert.ToHexString(hash.AsSpan(0, 6)).ToLowerInvariant();
    }

    /// <summary>Parses <c>t=</c> from Stripe-Signature (safe to log). Returns null if missing.</summary>
    public static long? TryGetSignatureTimestamp(string? stripeSignatureHeader)
    {
        if (string.IsNullOrEmpty(stripeSignatureHeader)) return null;
        foreach (var part in stripeSignatureHeader.Split(','))
        {
            var p = part.Trim();
            if (p.Length > 2
                && p.StartsWith("t=", StringComparison.OrdinalIgnoreCase)
                && long.TryParse(p.AsSpan(2), NumberStyles.Integer, CultureInfo.InvariantCulture, out var t))
                return t;
        }
        return null;
    }

    public static int CountV1Signatures(string? stripeSignatureHeader)
    {
        if (string.IsNullOrEmpty(stripeSignatureHeader)) return 0;
        var n = 0;
        foreach (var part in stripeSignatureHeader.Split(','))
        {
            if (part.TrimStart().StartsWith("v1=", StringComparison.OrdinalIgnoreCase))
                n++;
        }
        return n;
    }

    /// <summary>Try each signing secret (comma-separated in SSM during rotation).</summary>
    public static bool TryConstructEvent(
        string json,
        string stripeSignatureHeader,
        IReadOnlyList<string> signingSecrets,
        out Event? stripeEvent,
        out StripeException? lastError,
        out IReadOnlyList<string> perSecretFailureSummaries)
    {
        stripeEvent = null;
        lastError = null;
        var summaries = new List<string>();
        perSecretFailureSummaries = summaries;
        StripeException? last = null;
        var index = 0;
        foreach (var secret in signingSecrets)
        {
            if (string.IsNullOrWhiteSpace(secret))
            {
                index++;
                continue;
            }

            var trimmed = StripeWebhookSecret.SanitizeSegment(secret);
            try
            {
                // Resent / older events may use a different Stripe API version than Stripe.net's default;
                // that still throws StripeException and is easy to mistake for a bad signing secret.
                stripeEvent = EventUtility.ConstructEvent(
                    json,
                    stripeSignatureHeader,
                    trimmed,
                    SignatureToleranceSeconds,
                    throwOnApiVersionMismatch: false);
                perSecretFailureSummaries = Array.Empty<string>();
                return true;
            }
            catch (StripeException ex)
            {
                last = ex;
                var msg = ex.Message;
                if (msg.Length > 220)
                    msg = msg[..220] + "…";
                summaries.Add(
                    $"secret[{index}] len={trimmed.Length} prefixOk={trimmed.StartsWith("whsec_", StringComparison.Ordinal)} err={msg}");
            }

            index++;
        }
        lastError = last;
        perSecretFailureSummaries = summaries;
        return false;
    }
}
