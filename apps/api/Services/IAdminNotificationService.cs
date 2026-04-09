namespace GetTrainMate.Api.Services;

/// <summary>
/// Sends operational emails to admins (SES). Recipients come from <c>SES_ADMIN_EMAIL</c> / <c>SES:AdminEmail</c>,
/// populated at startup from SSM <c>/gettrainmate/ses-admin-email</c> when configured.
/// Failures are logged; callers are not blocked.
/// </summary>
public interface IAdminNotificationService
{
    Task NotifyNewSignupAsync(string userId, string? userEmail = null, CancellationToken cancellationToken = default);

    Task NotifyCreditsPurchaseAsync(
        string userId,
        int credits,
        string packKey,
        string sessionId,
        string? paymentIntentId,
        long? amountTotalCents,
        string? currency,
        CancellationToken cancellationToken = default);

    Task NotifyContactFormAsync(
        string name,
        string email,
        string subject,
        string message,
        string? contactId,
        CancellationToken cancellationToken = default);
}
