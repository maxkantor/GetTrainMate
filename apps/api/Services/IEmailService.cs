namespace GetTrainMate.Api.Services;

/// <summary>Transactional email via Amazon SES (<c>SendEmail</c>). Not SNS.</summary>
public interface IEmailService
{
    Task<string> SendEmailAsync(
        string to,
        string subject,
        string bodyText,
        string? bodyHtml = null,
        List<string>? cc = null,
        List<string>? bcc = null,
        List<EmailAttachment>? attachments = null,
        string? threadId = null,
        IReadOnlyList<string>? replyToAddresses = null);

    /// <summary>Partner outreach and threaded replies. Uses SES SendRawEmail (UTF-8 MIME).</summary>
    Task<string> SendRawEmailAsync(
        string from,
        string to,
        byte[] rawMime,
        string? configurationSet = null);
}

public class EmailAttachment
{
    public string FileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public byte[] Content { get; set; } = Array.Empty<byte>();
}
