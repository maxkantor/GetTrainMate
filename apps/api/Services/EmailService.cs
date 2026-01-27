using Amazon.SimpleEmail;
using Amazon.SimpleEmail.Model;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace GetTrainMate.Api.Services;

public class EmailService : IEmailService
{
    private readonly IAmazonSimpleEmailService _ses;
    private readonly IConfiguration _configuration;
    private readonly ILogger<EmailService> _logger;
    private readonly string _fromEmail;
    private readonly string? _configurationSet;

    public EmailService(
        IAmazonSimpleEmailService ses,
        IConfiguration configuration,
        ILogger<EmailService> logger)
    {
        _ses = ses;
        _configuration = configuration;
        _logger = logger;
        
        _fromEmail = Environment.GetEnvironmentVariable("SES_FROM_EMAIL")
            ?? configuration["SES:FromEmail"]
            ?? throw new InvalidOperationException("SES_FROM_EMAIL not configured");
        
        _configurationSet = Environment.GetEnvironmentVariable("SES_CONFIGURATION_SET")
            ?? configuration["SES:ConfigurationSet"];
    }

    public async Task<string> SendEmailAsync(
        string to,
        string subject,
        string bodyText,
        string? bodyHtml = null,
        List<string>? cc = null,
        List<string>? bcc = null,
        List<EmailAttachment>? attachments = null,
        string? threadId = null)
    {
        try
        {
            var request = new SendEmailRequest
            {
                Source = _fromEmail,
                Destination = new Destination
                {
                    ToAddresses = new List<string> { to },
                    CcAddresses = cc ?? new List<string>(),
                    BccAddresses = bcc ?? new List<string>()
                },
                Message = new Message
                {
                    Subject = new Content(subject),
                    Body = new Body
                    {
                        Text = new Content(bodyText),
                        Html = !string.IsNullOrEmpty(bodyHtml) ? new Content(bodyHtml) : null
                    }
                }
            };

            // Add configuration set if configured
            if (!string.IsNullOrEmpty(_configurationSet))
            {
                request.ConfigurationSetName = _configurationSet;
            }

            // Note: SES Message doesn't support custom headers directly
            // Thread ID can be included in subject or body if needed
            // For threading, use In-Reply-To and References headers via SendRawEmail if needed

            // Handle attachments if provided
            if (attachments != null && attachments.Count > 0)
            {
                // For attachments, we need to use SendRawEmail
                // This is a simplified version - full implementation would use MIME
                _logger.LogWarning("Attachments not fully implemented, using SendEmail without attachments");
            }

            var response = await _ses.SendEmailAsync(request);
            
            _logger.LogInformation("Email sent successfully. MessageId: {MessageId}, To: {To}", 
                response.MessageId, to);

            return response.MessageId;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending email to {To}", to);
            throw;
        }
    }
}
