namespace GetTrainMate.Api.Services;

/// <summary>
/// Sends operational emails to admins (SES). Recipients come from <c>SES_ADMIN_EMAIL</c> / <c>SES:AdminEmail</c>,
/// populated at startup from SSM <c>/gettrainmate/ses-admin-email</c> when configured.
/// Failures are logged; callers are not blocked.
/// </summary>
public interface IAdminNotificationService
{
    Task NotifyNewSignupAsync(
        string userId,
        string? userEmail = null,
        string? userName = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Branded confirmation sent only to the <b>Stripe checkout / payer</b> address (never the account email when they differ).
    /// Skipped when <paramref name="stripePayerEmail"/> is null/empty.
    /// </summary>
    Task SendCreditsPurchaseConfirmationToCustomerAsync(
        string? stripePayerEmail,
        int credits,
        string packDisplayTitle,
        long? amountTotalCents,
        string? currency,
        string appBaseUrl,
        string? accountEmail,
        CancellationToken cancellationToken = default);

    /// <summary>Operational alert to SES admin inbox (Stripe references, internal user id). Returns true when at least one admin inbox accepted the message.</summary>
    Task<bool> NotifyCreditsPurchaseAdminAsync(
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
        CancellationToken cancellationToken = default);

    Task NotifyContactFormAsync(
        string name,
        string email,
        string subject,
        string message,
        string? contactId,
        CancellationToken cancellationToken = default);
}
