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
        string? threadId = null);
}

public class EmailAttachment
{
    public string FileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public byte[] Content { get; set; } = Array.Empty<byte>();
}
