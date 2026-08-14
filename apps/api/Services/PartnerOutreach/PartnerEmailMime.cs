using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;

namespace GetTrainMate.Api.Services.PartnerOutreach;

public static class PartnerEmailMime
{
    public static byte[] BuildRaw(
        string fromName,
        string fromEmail,
        string to,
        string replyTo,
        string subject,
        string text,
        string html,
        string? inReplyTo = null,
        IReadOnlyList<string>? references = null,
        string? listUnsubscribeUrl = null,
        string? configurationSet = null,
        string? internalMessageId = null)
    {
        PartnerOutreachRules.AssertNoMojibake(subject, "subject");
        PartnerOutreachRules.AssertNoMojibake(text, "text");
        PartnerOutreachRules.AssertNoMojibake(html, "html");

        var boundary = "gtm" + Guid.NewGuid().ToString("N");
        var headers = new List<string>
        {
            $"From: {fromName} <{fromEmail}>",
            $"To: {to}",
            $"Reply-To: {replyTo}",
            $"Subject: {EncodeHeader(subject)}",
            "MIME-Version: 1.0",
            $"Content-Type: multipart/alternative; boundary=\"{boundary}\"",
            "X-GetTrainMate-Channel: partner-outreach"
        };
        if (!string.IsNullOrWhiteSpace(inReplyTo))
            headers.Add($"In-Reply-To: {inReplyTo.Trim()}");
        if (references is { Count: > 0 })
            headers.Add("References: " + string.Join(' ', references));
        if (!string.IsNullOrWhiteSpace(listUnsubscribeUrl))
        {
            headers.Add($"List-Unsubscribe: <{listUnsubscribeUrl}>");
            headers.Add("List-Unsubscribe-Post: List-Unsubscribe=One-Click");
        }
        if (!string.IsNullOrWhiteSpace(configurationSet))
            headers.Add($"X-SES-CONFIGURATION-SET: {configurationSet}");
        if (!string.IsNullOrWhiteSpace(internalMessageId))
            headers.Add($"X-GetTrainMate-MessageId: {internalMessageId}");

        var raw = string.Join("\r\n", headers) + "\r\n\r\n"
            + $"--{boundary}\r\n"
            + "Content-Type: text/plain; charset=UTF-8\r\n"
            + "Content-Transfer-Encoding: quoted-printable\r\n\r\n"
            + EncodeQuotedPrintable(text) + "\r\n"
            + $"--{boundary}\r\n"
            + "Content-Type: text/html; charset=UTF-8\r\n"
            + "Content-Transfer-Encoding: quoted-printable\r\n\r\n"
            + EncodeQuotedPrintable(html) + "\r\n"
            + $"--{boundary}--\r\n";
        return Encoding.UTF8.GetBytes(raw);
    }

    public static (string Subject, string Text, string Html) RenderDefault(
        string organizationName,
        string partnerUrl,
        string partnerCode,
        string unsubscribeUrl,
        string postalAddress)
    {
        var org = organizationName.Trim();
        var subject = $"Help {org} members find local training partners";
        var text = $"Hi {org} team,\n\n"
            + "I\u2019m Max, the founder of GetTrainMate, an Atlanta-based platform that helps people find local partners for workouts, running, pickleball, and other activities.\n\n"
            + "I created a dedicated invitation page for your community:\n\n"
            + $"{partnerUrl}\n\n"
            + $"Partner code: {partnerCode}\n\n"
            + "There is no cost for your organization. If you think it would be useful, would you be open to sharing the invitation with members looking for additional local training partners?\n\n"
            + "I\u2019m happy to answer any questions.\n\n"
            + "Thanks,\nMax\nFounder, GetTrainMate\nhttps://gettrainmate.com/\n\n"
            + "GetTrainMate does not sell partner member lists, and participation does not guarantee a match.\n"
            + $"Unsubscribe: {unsubscribeUrl}\n"
            + postalAddress;
        var html = DefaultHtml(org, partnerUrl, partnerCode, unsubscribeUrl, postalAddress, subject);
        if (Regex.IsMatch(text, "TRAIN-mode|not dating-first", RegexOptions.IgnoreCase))
            throw new InvalidOperationException("Forbidden pitch language");
        PartnerOutreachRules.AssertNoMojibake(text, "text");
        PartnerOutreachRules.AssertNoMojibake(html, "html");
        return (subject, text, html);
    }

    public static string DefaultHtml(string org, string url, string code, string unsub, string postal, string title)
    {
        string E(string s) => WebUtility.HtmlEncode(s);
        return "<!DOCTYPE html><html lang=\"en\"><head><meta charset=\"UTF-8\">"
            + "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">"
            + $"<title>{E(title)}</title></head>"
            + "<body style=\"margin:0;padding:0;background:#f3f4f6;\">"
            + "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background:#f3f4f6;\"><tr><td align=\"center\" style=\"padding:24px 12px;\">"
            + "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"max-width:600px;background:#fff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;\">"
            + "<tr><td style=\"padding:20px 24px;background:#0f172a;color:#fff;font-family:Arial,Helvetica,sans-serif;\">"
            + "<div style=\"font-size:20px;font-weight:700;\">GetTrainMate</div>"
            + "<div style=\"font-size:13px;opacity:0.85;margin-top:4px;\">Atlanta training partners</div></td></tr>"
            + "<tr><td style=\"padding:28px 24px;font-family:Arial,Helvetica,sans-serif;color:#111827;font-size:16px;line-height:1.6;\">"
            + $"<p>Hi {E(org)} team,</p>"
            + "<p>I\u2019m Max, the founder of GetTrainMate, an Atlanta-based platform that helps people find local partners for workouts, running, pickleball, and other activities.</p>"
            + "<p>I created a dedicated invitation page for your community.</p>"
            + $"<p style=\"text-align:center;\"><a href=\"{E(url)}\" style=\"display:inline-block;background:#0f172a;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:700;\">Open invitation page</a></p>"
            + $"<p>Partner code: <strong>{E(code)}</strong></p>"
            + $"<p style=\"font-size:13px;color:#6b7280;word-break:break-all;\">{E(url)}</p>"
            + "<p>There is no cost for your organization. If you think it would be useful, would you be open to sharing the invitation with members looking for additional local training partners?</p>"
            + "<p>I\u2019m happy to answer any questions.</p>"
            + "<p>Thanks,<br><strong>Max</strong><br>Founder, GetTrainMate<br>"
            + "<a href=\"https://gettrainmate.com/\" style=\"color:#0f172a;\">https://gettrainmate.com/</a></p>"
            + "<p style=\"font-size:12px;color:#6b7280;border-top:1px solid #e5e7eb;padding-top:16px;\">GetTrainMate does not sell partner member lists, and participation does not guarantee a match.<br>"
            + $"<a href=\"{E(unsub)}\">Unsubscribe from partnership emails</a><br>{E(postal)}</p>"
            + "</td></tr></table></td></tr></table></body></html>";
    }

    public static string EncodeQuotedPrintable(string utf8Text)
    {
        var lines = utf8Text.Replace("\r\n", "\n").Replace('\r', '\n').Split('\n');
        return string.Join("\r\n", lines.Select(EncodeQpLine));
    }

    public static string DecodeQuotedPrintable(string input)
    {
        var s = Regex.Replace(input, "=\r?\n", "");
        var bytes = new List<byte>();
        for (var i = 0; i < s.Length; i++)
        {
            if (s[i] == '=' && i + 2 < s.Length && Uri.IsHexDigit(s[i + 1]) && Uri.IsHexDigit(s[i + 2]))
            {
                bytes.Add(Convert.ToByte(s.Substring(i + 1, 2), 16));
                i += 2;
            }
            else bytes.Add((byte)s[i]);
        }
        return Encoding.UTF8.GetString(bytes.ToArray());
    }

    public static string SanitizeHtml(string? html)
    {
        if (string.IsNullOrWhiteSpace(html)) return "";
        var s = html;
        s = Regex.Replace(s, "<script[\\s\\S]*?</script>", "", RegexOptions.IgnoreCase);
        s = Regex.Replace(s, "<iframe[\\s\\S]*?</iframe>", "", RegexOptions.IgnoreCase);
        s = Regex.Replace(s, "<object[\\s\\S]*?</object>", "", RegexOptions.IgnoreCase);
        s = Regex.Replace(s, @"<img\b[^>]*>", "", RegexOptions.IgnoreCase);
        s = Regex.Replace(s, @"on\w+\s*=\s*""[^""]*""", "", RegexOptions.IgnoreCase);
        s = Regex.Replace(s, @"javascript:", "", RegexOptions.IgnoreCase);
        return s;
    }

    public static bool IsDangerousAttachment(string fileName, string contentType)
    {
        var ext = Path.GetExtension(fileName).ToLowerInvariant();
        var bad = new[] { ".exe", ".js", ".vbs", ".bat", ".cmd", ".scr", ".ps1", ".msi", ".dll", ".html", ".htm" };
        if (bad.Contains(ext)) return true;
        if (contentType.Contains("javascript", StringComparison.OrdinalIgnoreCase)) return true;
        return false;
    }

    static string EncodeQpLine(string line)
    {
        var buf = Encoding.UTF8.GetBytes(line);
        var sb = new StringBuilder();
        var col = 0;
        void Emit(string token)
        {
            if (col + token.Length > 75)
            {
                sb.Append("=\r\n");
                col = 0;
            }
            sb.Append(token);
            col += token.Length;
        }
        for (var i = 0; i < buf.Length; i++)
        {
            var b = buf[i];
            var safe = (b >= 33 && b <= 60) || (b >= 62 && b <= 126);
            if (safe) Emit(((char)b).ToString());
            else if (b is 9 or 32)
            {
                if (i == buf.Length - 1) Emit("=" + b.ToString("X2"));
                else Emit(((char)b).ToString());
            }
            else Emit("=" + b.ToString("X2"));
        }
        return sb.ToString();
    }

    static string EncodeHeader(string value)
    {
        var s = value.Replace("\r", " ").Replace("\n", " ");
        if (s.All(c => c >= 32 && c <= 126)) return s;
        return "=?UTF-8?B?" + Convert.ToBase64String(Encoding.UTF8.GetBytes(s)) + "?=";
    }
}

public static class UnsubscribeToken
{
    public static string Create(string recipientId, string secret, DateTimeOffset expiresAt)
    {
        var payload = recipientId + "|" + expiresAt.ToUnixTimeSeconds();
        var sig = Sign(payload, secret);
        return Base64Url(Encoding.UTF8.GetBytes(payload)) + "." + sig;
    }

    public static bool TryValidate(string token, string secret, out string recipientId, out DateTimeOffset expiresAt)
    {
        recipientId = "";
        expiresAt = default;
        var parts = token.Split('.', 2);
        if (parts.Length != 2) return false;
        string payload;
        try { payload = Encoding.UTF8.GetString(Base64UrlDecode(parts[0])); }
        catch { return false; }
        if (!string.Equals(Sign(payload, secret), parts[1], StringComparison.Ordinal)) return false;
        var bits = payload.Split('|');
        if (bits.Length != 2) return false;
        recipientId = bits[0];
        if (!long.TryParse(bits[1], out var unix)) return false;
        expiresAt = DateTimeOffset.FromUnixTimeSeconds(unix);
        return expiresAt > DateTimeOffset.UtcNow;
    }

    static string Sign(string payload, string secret)
    {
        using var h = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
        return Convert.ToHexString(h.ComputeHash(Encoding.UTF8.GetBytes(payload))).ToLowerInvariant();
    }

    static string Base64Url(byte[] data) => Convert.ToBase64String(data).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    static byte[] Base64UrlDecode(string s)
    {
        s = s.Replace('-', '+').Replace('_', '/');
        switch (s.Length % 4) { case 2: s += "=="; break; case 3: s += "="; break; }
        return Convert.FromBase64String(s);
    }
}

public static class InboundMimeParser
{
    public static ParsedInboundMessage Parse(string raw)
    {
        raw = raw.Replace("\r\n", "\n");
        var split = raw.Split("\n\n", 2);
        var headerBlock = split[0];
        var body = split.Length > 1 ? split[1] : "";
        var headers = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        string? last = null;
        foreach (var line in headerBlock.Split('\n'))
        {
            if (line.StartsWith(' ') || line.StartsWith('\t'))
            {
                if (last != null) headers[last] += " " + line.Trim();
                continue;
            }
            var i = line.IndexOf(':');
            if (i <= 0) continue;
            last = line[..i];
            headers[last] = line[(i + 1)..].Trim();
        }
        headers.TryGetValue("From", out var from);
        headers.TryGetValue("To", out var to);
        headers.TryGetValue("Subject", out var subject);
        headers.TryGetValue("Message-ID", out var messageId);
        headers.TryGetValue("In-Reply-To", out var inReplyTo);
        headers.TryGetValue("References", out var references);
        headers.TryGetValue("Date", out var date);
        var text = body;
        if (body.Contains("quoted-printable", StringComparison.OrdinalIgnoreCase))
            text = PartnerEmailMime.DecodeQuotedPrintable(body);
        return new ParsedInboundMessage
        {
            From = from ?? "",
            To = to ?? "",
            Subject = subject ?? "",
            MessageId = messageId ?? "",
            InReplyTo = inReplyTo,
            References = string.IsNullOrWhiteSpace(references) ? Array.Empty<string>() : references.Split(' ', StringSplitOptions.RemoveEmptyEntries),
            DateHeader = date,
            TextBody = PartnerEmailMime.SanitizeHtml(text),
            HtmlBody = PartnerEmailMime.SanitizeHtml(body.Contains("<html", StringComparison.OrdinalIgnoreCase) ? body : null)
        };
    }
}

public sealed class ParsedInboundMessage
{
    public string From { get; set; } = "";
    public string To { get; set; } = "";
    public string Subject { get; set; } = "";
    public string MessageId { get; set; } = "";
    public string? InReplyTo { get; set; }
    public string[] References { get; set; } = Array.Empty<string>();
    public string? DateHeader { get; set; }
    public string TextBody { get; set; } = "";
    public string? HtmlBody { get; set; }
}

public static class SesTagRules
{
    public static IReadOnlyDictionary<string, string> CampaignTags(string internalMessageId) =>
        new Dictionary<string, string> { ["gtm_mid"] = internalMessageId };

    public static void AssertNoPii(IReadOnlyDictionary<string, string> tags)
    {
        foreach (var kv in tags)
        {
            if (kv.Value.Contains('@') || kv.Key.Contains("email", StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException("PII is not allowed in SES tags");
        }
    }
}
