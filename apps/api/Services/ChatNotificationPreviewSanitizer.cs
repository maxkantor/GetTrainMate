using System.Text;
using System.Text.RegularExpressions;

namespace GetTrainMate.Api.Services;

/// <summary>
/// Sanitizes outbound chat email previews. Never sends raw HTML/script; redacts on abuse signals.
/// </summary>
public static class ChatNotificationPreviewSanitizer
{
    public const string RedactedPlaceholder = "[Preview not shown — open GetTrainMate to read safely.]";

    private static readonly Regex ScriptOrHtmlOpen = new(
        @"<\s*(script|iframe|object|embed|style|link)\b",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant | RegexOptions.Compiled);

    private static readonly Regex JsUrl = new(
        @"\bjavascript\s*:",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant | RegexOptions.Compiled);

    /// <summary>Produce a plain-text preview safe for SES email bodies.</summary>
    public static string Sanitize(string? raw, IConfiguration? configuration)
    {
        if (string.IsNullOrWhiteSpace(raw)) return "…";

        var s = CollapseWhitespace(raw.Trim());
        if (s.Length == 0) return "…";

        foreach (var c in s)
        {
            if (char.IsControl(c) && c is not ('\n' or '\r' or '\t'))
                return RedactedPlaceholder;
        }

        if (ScriptOrHtmlOpen.IsMatch(s) || JsUrl.IsMatch(s))
            return RedactedPlaceholder;

        if (ContainsBlockedWord(s, configuration))
            return RedactedPlaceholder;

        // Excessive repetition (spam / harassment pattern)
        if (RepeatsCharTooLong(s))
            return RedactedPlaceholder;

        return Truncate(s, 180);
    }

    private static bool RepeatsCharTooLong(string s)
    {
        if (s.Length < 80) return false;
        var maxRun = 0;
        char? prev = null;
        var run = 0;
        foreach (var c in s)
        {
            if (c == prev)
            {
                run++;
                maxRun = Math.Max(maxRun, run);
            }
            else
            {
                prev = c;
                run = 1;
            }
        }
        return maxRun > 40;
    }

    private static bool ContainsBlockedWord(string s, IConfiguration? configuration)
    {
        var extra = configuration?["ChatNotifications:PreviewBlocklistWords"];
        if (string.IsNullOrWhiteSpace(extra)) return false;
        var words = extra.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        foreach (var w in words)
        {
            if (w.Length < 2) continue;
            if (s.Contains(w, StringComparison.OrdinalIgnoreCase))
                return true;
        }
        return false;
    }

    private static string CollapseWhitespace(string s)
    {
        var sb = new StringBuilder(s.Length);
        var prevSpace = false;
        foreach (var c in s.Replace('\r', '\n'))
        {
            if (char.IsWhiteSpace(c))
            {
                if (!prevSpace)
                {
                    sb.Append(' ');
                    prevSpace = true;
                }
            }
            else
            {
                sb.Append(c);
                prevSpace = false;
            }
        }
        return sb.ToString().Trim();
    }

    private static string Truncate(string s, int max)
    {
        if (s.Length <= max) return s;
        return s[..(max - 1)] + "…";
    }
}
