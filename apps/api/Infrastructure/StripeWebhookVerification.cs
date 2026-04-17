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

    public static async Task<string> ReadRawBodyUtf8Async(HttpRequest request, CancellationToken cancellationToken = default)
    {
        request.EnableBuffering();
        request.Body.Position = 0;
        await using var ms = new MemoryStream();
        await request.Body.CopyToAsync(ms, cancellationToken);
        return Encoding.UTF8.GetString(ms.ToArray());
    }

    /// <summary>Try each signing secret (comma-separated in SSM during rotation).</summary>
    public static bool TryConstructEvent(
        string json,
        string stripeSignatureHeader,
        IReadOnlyList<string> signingSecrets,
        out Event? stripeEvent,
        out StripeException? lastError)
    {
        stripeEvent = null;
        lastError = null;
        StripeException? last = null;
        foreach (var secret in signingSecrets)
        {
            if (string.IsNullOrWhiteSpace(secret)) continue;
            try
            {
                stripeEvent = EventUtility.ConstructEvent(
                    json,
                    stripeSignatureHeader,
                    secret.Trim(),
                    SignatureToleranceSeconds);
                return true;
            }
            catch (StripeException ex)
            {
                last = ex;
            }
        }
        lastError = last;
        return false;
    }
}
