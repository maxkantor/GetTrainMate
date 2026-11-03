using System.Net.Mail;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;

namespace GetTrainMate.Api.Services.ContactForm;

/// <summary>
/// Pure validation / fingerprint helpers for the public contact form (no I/O).
/// </summary>
public static class ContactFormProtection
{
    public const int MaxNameLen = 120;
    public const int MaxEmailLen = 254;
    public const int MaxSubjectLen = 64;
    public const int MaxMessageLen = 8000;
    public const int MaxRequestBodyBytes = 32_768;
    public const int MaxHoneypotLen = 256;

    public static readonly HashSet<string> AllowedSubjects = new(StringComparer.OrdinalIgnoreCase)
    {
        "general", "support", "billing", "partnership", "feedback", "report",
    };

    /// <summary>Accessible honeypot field name — bots often fill "company"; humans leave empty.</summary>
    public const string HoneypotFieldName = "company";

    public sealed record NormalizedSubmission(
        string Name,
        string Email,
        string Subject,
        string Message);

    public sealed record ValidationOutcome(
        bool Ok,
        string? Error,
        string ReasonCode,
        NormalizedSubmission? Normalized,
        bool SilentAccept);

    public static ValidationOutcome Validate(
        string? nameRaw,
        string? emailRaw,
        string? subjectRaw,
        string? messageRaw,
        string? honeypotRaw,
        long? contentLengthBytes = null)
    {
        if (contentLengthBytes is > MaxRequestBodyBytes)
            return Fail("request_too_large", "Request is too large.", silent: false);

        var honeypot = (honeypotRaw ?? "").Trim();
        if (honeypot.Length > 0)
        {
            if (honeypot.Length > MaxHoneypotLen)
                return Fail("honeypot", "Invalid request.", silent: true);
            return Fail("honeypot", "Invalid request.", silent: true);
        }

        var name = (nameRaw ?? "").Trim();
        var email = (emailRaw ?? "").Trim().ToLowerInvariant();
        var subject = string.IsNullOrWhiteSpace(subjectRaw) ? "general" : subjectRaw.Trim();
        var message = (messageRaw ?? "").Trim();

        if (name.Length == 0 || name.Length > MaxNameLen)
            return Fail("name_invalid", "Name is required (max 120 characters).", silent: false);

        if (email.Length == 0 || email.Length > MaxEmailLen || !IsValidEmail(email))
            return Fail("email_invalid", "A valid email is required.", silent: false);

        if (subject.Length > MaxSubjectLen || !AllowedSubjects.Contains(subject))
            return Fail("subject_invalid", "Invalid subject.", silent: false);

        if (message.Length == 0 || message.Length > MaxMessageLen)
            return Fail("message_invalid", "Message is required (max 8000 characters).", silent: false);

        if (IsNumericOnlyMessage(message))
            return Fail("message_numeric_only", "Please enter a short message describing how we can help.", silent: false);

        if (IsDotStuffedEmailLocalPart(email))
            return Fail("email_suspicious", "A valid email is required.", silent: false);

        return new ValidationOutcome(
            Ok: true,
            Error: null,
            ReasonCode: "ok",
            Normalized: new NormalizedSubmission(name, email, subject.ToLowerInvariant(), message),
            SilentAccept: false);
    }

    public static bool IsNumericOnlyMessage(string message)
    {
        if (string.IsNullOrWhiteSpace(message)) return true;
        // Strip whitespace and common punctuation; if nothing but digits remain → spam pattern.
        var sb = new StringBuilder(message.Length);
        foreach (var ch in message)
        {
            if (char.IsWhiteSpace(ch)) continue;
            if (ch is '-' or '+' or '(' or ')' or '.' or ',' or '#' ) continue;
            sb.Append(ch);
        }
        if (sb.Length == 0) return true;
        for (var i = 0; i < sb.Length; i++)
        {
            if (!char.IsDigit(sb[i])) return false;
        }
        return sb.Length >= 4; // allow tiny numeric refs like "1" / "ok" handled elsewhere; 4+ digit-only = spam
    }

    public static bool IsValidEmail(string email)
    {
        if (string.IsNullOrWhiteSpace(email) || email.Length > MaxEmailLen) return false;
        if (email.Contains(' ', StringComparison.Ordinal)) return false;
        try
        {
            var addr = new MailAddress(email);
            return string.Equals(addr.Address, email, StringComparison.OrdinalIgnoreCase)
                   && addr.Host.Contains('.', StringComparison.Ordinal);
        }
        catch
        {
            return false;
        }
    }

    /// <summary>Bot pattern: many dots in local-part (robi.d.eli.s.i.r19.8.5@…).</summary>
    public static bool IsDotStuffedEmailLocalPart(string email)
    {
        var at = email.IndexOf('@');
        if (at <= 0) return false;
        var local = email[..at];
        var dotCount = local.Count(ch => ch == '.');
        if (dotCount >= 3) return true;
        if (dotCount >= 2 && local.Length >= 12)
        {
            var withoutDots = local.Replace(".", "", StringComparison.Ordinal);
            if (withoutDots.Length <= local.Length - 2 && withoutDots.Length >= 6)
                return true;
        }
        return false;
    }

    public static string ContentFingerprint(NormalizedSubmission s)
    {
        var normMessage = Regex.Replace(s.Message.ToLowerInvariant(), @"\s+", " ").Trim();
        var payload = $"{s.Email}\n{s.Subject}\n{normMessage}";
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(payload));
        return Convert.ToHexString(hash).ToLowerInvariant();
    }

    public static string HashKey(string value)
    {
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(value));
        return Convert.ToHexString(hash).ToLowerInvariant()[..32];
    }

    public static string? NormalizeClientIp(string? remoteIp)
    {
        if (string.IsNullOrWhiteSpace(remoteIp)) return null;
        var ip = remoteIp.Trim();
        // Strip IPv6-mapped IPv4 prefix
        if (ip.StartsWith("::ffff:", StringComparison.OrdinalIgnoreCase))
            ip = ip["::ffff:".Length..];
        if (ip is "unknown" or "null") return null;
        return ip;
    }

    private static ValidationOutcome Fail(string code, string error, bool silent) =>
        new(Ok: false, Error: error, ReasonCode: code, Normalized: null, SilentAccept: silent);
}
