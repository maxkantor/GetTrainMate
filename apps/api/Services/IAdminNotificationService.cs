namespace GetTrainMate.Api.Services;

/// <summary>
/// Sends operational emails to admins (SES). Recipients come from <c>SES_ADMIN_EMAIL</c> / <c>SES:AdminEmail</c>,
/// populated at startup from SSM <c>/gettrainmate/ses-admin-email</c> when configured.
/// Failures are logged; callers are not blocked.
/// </summary>
public interface IAdminNotificationService
{
    Task NotifyNewSignupAsync(string userId, string? userEmail = null, CancellationToken cancellationToken = default);

    /// <summary>Branded confirmation to the buyer (no internal IDs). Skipped when <paramref name="buyerEmail"/> is null/empty.</summary>
    Task SendCreditsPurchaseConfirmationToCustomerAsync(
        string? buyerEmail,
        int credits,
        string packDisplayTitle,
        long? amountTotalCents,
        string? currency,
        string appBaseUrl,
        CancellationToken cancellationToken = default);

    /// <summary>Operational alert to SES admin inbox (Stripe references, internal user id).</summary>
    Task NotifyCreditsPurchaseAdminAsync(
        string userId,
        string? buyerEmail,
        int credits,
        string packKey,
        string packDisplayTitle,
        string stripeSessionId,
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
