using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace GetTrainMate.Api.Services;

public class AdminNotificationService : IAdminNotificationService
{
    private readonly IEmailService _email;
    private readonly IConfiguration _configuration;
    private readonly ILogger<AdminNotificationService> _logger;

    public AdminNotificationService(
        IEmailService email,
        IConfiguration configuration,
        ILogger<AdminNotificationService> logger)
    {
        _email = email;
        _configuration = configuration;
        _logger = logger;
    }

    private IReadOnlyList<string> AdminRecipients()
    {
        var raw = (_configuration["SES:AdminEmail"]
            ?? Environment.GetEnvironmentVariable("SES_ADMIN_EMAIL")
            ?? "").Trim();
        if (string.IsNullOrEmpty(raw))
        {
            _logger.LogWarning(
                "Admin notifications skipped: no SES admin email (SES:AdminEmail / SES_ADMIN_EMAIL / SSM /gettrainmate/ses-admin-email).");
            return Array.Empty<string>();
        }

        return raw
            .Split(new[] { ',', ';' }, StringSplitOptions.RemoveEmptyEntries)
            .Select(s => s.Trim())
            .Where(s => s.Length > 0 && s.Contains('@', StringComparison.Ordinal))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    private async Task SendToAllAsync(
        string subject,
        string text,
        string? html,
        CancellationToken cancellationToken,
        IReadOnlyList<string>? replyToAddresses = null)
    {
        var to = AdminRecipients();
        if (to.Count == 0)
            return;

        foreach (var address in to)
        {
            cancellationToken.ThrowIfCancellationRequested();
            try
            {
                await _email.SendEmailAsync(address, subject, text, html, replyToAddresses: replyToAddresses);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Admin notification to {Email} failed for subject {Subject}", address, subject);
            }
        }
    }

    public Task NotifyNewSignupAsync(
        string userId,
        string? userEmail = null,
        string? userName = null,
        CancellationToken cancellationToken = default)
    {
        var subject = "[GetTrainMate] New user signup";
        var lines = new List<string>
        {
            "A new user signed up and received free starter credits.",
            $"User ID (Cognito sub): {userId}",
        };
        if (!string.IsNullOrWhiteSpace(userName))
            lines.Add($"Name: {userName.Trim()}");
        if (!string.IsNullOrWhiteSpace(userEmail))
            lines.Add($"Email: {userEmail.Trim()}");
        lines.Add($"Time (UTC): {DateTime.UtcNow:O}");
        var appBase = (_configuration["Frontend:BaseUrl"]
            ?? Environment.GetEnvironmentVariable("FRONTEND_URL")
            ?? "https://gettrainmate.com").Trim().TrimEnd('/');
        lines.Add($"Admin CRM: {appBase}/admin/users");
        var text = string.Join(Environment.NewLine, lines);
        var html = $"<p>{string.Join("</p><p>", lines.Select(System.Net.WebUtility.HtmlEncode))}</p>";
        var signupReplyTrim = (userEmail ?? "").Trim();
        IReadOnlyList<string>? signupReplyTo = string.IsNullOrEmpty(signupReplyTrim) || !signupReplyTrim.Contains('@', StringComparison.Ordinal)
            ? null
            : new[] { signupReplyTrim };
        return SendToAllAsync(subject, text, html, cancellationToken, signupReplyTo);
    }

    private string? PurchaseSupportEmail()
    {
        var s = (_configuration["PurchaseEmail:SupportEmail"] ?? Environment.GetEnvironmentVariable("PURCHASE_EMAIL_SUPPORT") ?? "").Trim();
        return string.IsNullOrEmpty(s) || !s.Contains('@', StringComparison.Ordinal) ? null : s;
    }

    public async Task SendCreditsPurchaseConfirmationToCustomerAsync(
        string? stripePayerEmail,
        int credits,
        string packDisplayTitle,
        long? amountTotalCents,
        string? currency,
        string appBaseUrl,
        string? accountEmail,
        CancellationToken cancellationToken = default)
    {
        var to = (stripePayerEmail ?? "").Trim();
        if (string.IsNullOrEmpty(to) || !to.Contains('@', StringComparison.Ordinal))
        {
            _logger.LogDebug("Customer purchase confirmation skipped: no payer email from Stripe checkout.");
            return;
        }

        var amountFormatted = CreditsPurchaseEmailTemplates.FormatMoney(amountTotalCents, currency);
        var support = PurchaseSupportEmail();
        var (subject, text, html) = CreditsPurchaseEmailTemplates.BuildCustomerPurchaseEmail(
            credits,
            packDisplayTitle,
            amountFormatted,
            appBaseUrl,
            support,
            to,
            accountEmail);

        IReadOnlyList<string>? replyTo = support != null ? new[] { support } : null;

        try
        {
            await _email.SendEmailAsync(to, subject, text, html, replyToAddresses: replyTo);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Customer purchase confirmation email failed for {To}", to);
        }
    }

    public Task NotifyCreditsPurchaseAdminAsync(
        string userId,
        string? stripePayerEmail,
        string? accountEmail,
        int credits,
        string packKey,
        string packDisplayTitle,
        string stripeSessionId,
        string? paymentIntentId,
        long? amountTotalCents,
        string? currency,
        CancellationToken cancellationToken = default)
    {
        var (subject, text, html) = CreditsPurchaseEmailTemplates.BuildAdminCreditsPurchaseEmail(
            userId,
            stripePayerEmail,
            accountEmail,
            credits,
            packKey,
            packDisplayTitle,
            stripeSessionId,
            paymentIntentId,
            amountTotalCents,
            currency);
        return SendToAllAsync(subject, text, html, cancellationToken, replyToAddresses: null);
    }

    public Task NotifyContactFormAsync(
        string name,
        string email,
        string subject,
        string message,
        string? contactId,
        CancellationToken cancellationToken = default)
    {
        var safeSubject = string.IsNullOrWhiteSpace(subject) ? "general" : subject;
        var mailSubject = $"[GetTrainMate] Contact: {safeSubject}";
        var lines = new List<string>
        {
            "Someone submitted the website contact form.",
            $"Name: {name}",
            $"Email: {email}",
            $"Subject: {safeSubject}",
            "",
            "Message:",
            message,
        };
        if (!string.IsNullOrWhiteSpace(contactId))
            lines.Add("");
        if (!string.IsNullOrWhiteSpace(contactId))
            lines.Add($"CRM ContactId: {contactId}");
        lines.Add($"Time (UTC): {DateTime.UtcNow:O}");
        var text = string.Join(Environment.NewLine, lines);
        var html = "<pre style=\"font-family:sans-serif;white-space:pre-wrap\">"
            + System.Net.WebUtility.HtmlEncode(text)
            + "</pre>";
        var trimmed = (email ?? "").Trim();
        IReadOnlyList<string>? replyTo = string.IsNullOrEmpty(trimmed) || !trimmed.Contains('@', StringComparison.Ordinal)
            ? null
            : new[] { trimmed };
        return SendToAllAsync(mailSubject, text, html, cancellationToken, replyTo);
    }
}
