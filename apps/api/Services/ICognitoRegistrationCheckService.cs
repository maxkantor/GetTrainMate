namespace GetTrainMate.Api.Services;

public enum EmailRegistrationStatus
{
    Available,
    ExistsConfirmed,
    ExistsUnconfirmed,
    Error
}

/// <summary>Pre-signup check: Cognito ListUsers by email so we never send a duplicate verification flow.</summary>
public interface ICognitoRegistrationCheckService
{
    /// <summary>
    /// When <see cref="EmailRegistrationStatus.ExistsUnconfirmed"/>, <paramref name="cognitoUsername"/>
    /// is the pool username (UUID) so the client can resend the verification code.
    /// </summary>
    Task<(EmailRegistrationStatus Status, string? Message, string? CognitoUsername)> CheckEmailForRegistrationAsync(
        string email,
        CancellationToken cancellationToken = default);
}
