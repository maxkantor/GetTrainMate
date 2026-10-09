using System.Text.Json;

namespace GetTrainMate.Api.Services.PartnerOutreach;

/// <summary>
/// Parses SES → SNS delivery/bounce/complaint notifications and maps them to ApplySesEvent inputs.
/// Correlation uses opaque <c>gtm_mid</c> message tags (never email addresses).
/// </summary>
public static class PartnerSesEventProcessor
{
    public static bool IsSnsEnvelope(JsonElement root) =>
        root.ValueKind == JsonValueKind.Object
        && root.TryGetProperty("Records", out var records)
        && records.ValueKind == JsonValueKind.Array
        && records.GetArrayLength() > 0
        && records[0].TryGetProperty("EventSource", out var src)
        && string.Equals(src.GetString(), "aws:sns", StringComparison.OrdinalIgnoreCase);

    /// <summary>
    /// Extract (internalMessageId, eventType, sesMessageId) triples from an SNS Lambda event.
    /// Skips SubscriptionConfirmation / UnsubscribeConfirmation and open/click noise.
    /// </summary>
    public static IReadOnlyList<(string InternalMessageId, string EventType, string? SesMessageId)> ParseSnsLambdaEvent(
        JsonElement root)
    {
        var results = new List<(string, string, string?)>();
        if (!root.TryGetProperty("Records", out var records) || records.ValueKind != JsonValueKind.Array)
            return results;

        foreach (var record in records.EnumerateArray())
        {
            if (!record.TryGetProperty("Sns", out var sns)) continue;
            var message = sns.TryGetProperty("Message", out var msgEl) ? msgEl.GetString() : null;
            if (string.IsNullOrWhiteSpace(message)) continue;

            // SNS subscription handshake — not an SES event.
            var snsType = sns.TryGetProperty("Type", out var t) ? t.GetString() : null;
            if (string.Equals(snsType, "SubscriptionConfirmation", StringComparison.OrdinalIgnoreCase)
                || string.Equals(snsType, "UnsubscribeConfirmation", StringComparison.OrdinalIgnoreCase))
                continue;

            foreach (var parsed in ParseSesNotification(message))
                results.Add(parsed);
        }

        return results;
    }

    public static IReadOnlyList<(string InternalMessageId, string EventType, string? SesMessageId)> ParseSesNotification(
        string json)
    {
        var results = new List<(string, string, string?)>();
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;

        var eventType = root.TryGetProperty("eventType", out var et) ? et.GetString()
            : root.TryGetProperty("notificationType", out var nt) ? nt.GetString()
            : null;
        var normalized = NormalizeEventType(eventType);
        if (normalized == null) return results;

        string? sesMessageId = null;
        string? internalId = null;
        if (root.TryGetProperty("mail", out var mail))
        {
            if (mail.TryGetProperty("messageId", out var mid))
                sesMessageId = mid.GetString();
            if (mail.TryGetProperty("tags", out var tags))
                internalId = FirstTag(tags, "gtm_mid") ?? FirstTag(tags, "GTM_MID");
            if (string.IsNullOrWhiteSpace(internalId) && mail.TryGetProperty("headers", out var headers)
                && headers.ValueKind == JsonValueKind.Array)
            {
                foreach (var h in headers.EnumerateArray())
                {
                    var name = h.TryGetProperty("name", out var n) ? n.GetString() : null;
                    if (!string.Equals(name, "X-GetTrainMate-MessageId", StringComparison.OrdinalIgnoreCase))
                        continue;
                    internalId = h.TryGetProperty("value", out var v) ? v.GetString() : null;
                    break;
                }
            }
        }

        if (string.IsNullOrWhiteSpace(internalId) && !string.IsNullOrWhiteSpace(sesMessageId))
        {
            // Allow ApplySesEvent to correlate by SesMessageId when gtm_mid is missing.
            results.Add(("ses:" + sesMessageId, normalized, sesMessageId));
            return results;
        }

        if (string.IsNullOrWhiteSpace(internalId)) return results;
        results.Add((internalId.Trim(), normalized, sesMessageId));
        return results;
    }

    /// <summary>
    /// Maps SES notification names to ApplySesEventAsync switch cases.
    /// Returns null for open/click/send (acceptance is already recorded at SendRawEmail).
    /// </summary>
    public static string? NormalizeEventType(string? eventType)
    {
        if (string.IsNullOrWhiteSpace(eventType)) return null;
        return eventType.Trim().ToLowerInvariant() switch
        {
            "delivery" => "delivery",
            "bounce" => "bounce",
            "complaint" => "complaint",
            "reject" => "reject",
            "rendering failure" or "rendering_failure" => "rendering failure",
            "delivery delay" or "deliverydelay" or "delivery_delay" => "delivery delay",
            "send" or "open" or "click" or "subscription" => null,
            _ => null
        };
    }

    static string? FirstTag(JsonElement tags, string name)
    {
        if (tags.ValueKind != JsonValueKind.Object) return null;
        if (!tags.TryGetProperty(name, out var el)) return null;
        if (el.ValueKind == JsonValueKind.Array)
        {
            foreach (var v in el.EnumerateArray())
            {
                var s = v.GetString();
                if (!string.IsNullOrWhiteSpace(s)) return s;
            }
            return null;
        }
        return el.GetString();
    }
}
