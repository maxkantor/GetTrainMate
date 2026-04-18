namespace GetTrainMate.Api.Services;

/// <summary>
/// Removes Cognito users using pool <b>Username</b> (UUID, email-shaped, etc.) across all configured pools.
/// Shared by admin CRM and public check-email self-heal when CRM has released the email but Cognito still blocks signup.
/// </summary>
public interface ICognitoAdminUserDeletionService
{
    Task<bool> TryDeleteCognitoUserAsync(
        string userId,
        string? cognitoEmailHint,
        CancellationToken cancellationToken = default);
}
