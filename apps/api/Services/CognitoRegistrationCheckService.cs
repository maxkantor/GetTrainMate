using Amazon.CognitoIdentityProvider;
using Amazon.CognitoIdentityProvider.Model;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace GetTrainMate.Api.Services;

public class CognitoRegistrationCheckService : ICognitoRegistrationCheckService
{
    private readonly IAmazonCognitoIdentityProvider _cognito;
    private readonly IProfileService _profileService;
    private readonly ICognitoAdminUserDeletionService _cognitoDeletion;
    private readonly ILogger<CognitoRegistrationCheckService> _logger;
    private readonly string[] _userPoolIds;

    public CognitoRegistrationCheckService(
        IAmazonCognitoIdentityProvider cognito,
        IConfiguration configuration,
        IProfileService profileService,
        ICognitoAdminUserDeletionService cognitoDeletion,
        ILogger<CognitoRegistrationCheckService> logger)
    {
        _cognito = cognito;
        _profileService = profileService;
        _cognitoDeletion = cognitoDeletion;
        _logger = logger;
        _userPoolIds = CognitoPoolConfiguration.ResolveAllUserPoolIds(configuration);
    }

    private static string EscapeCognitoFilterValue(string value)
    {
        return value.Replace("\\", "\\\\", StringComparison.Ordinal).Replace("\"", "\\\"", StringComparison.Ordinal);
    }

    private static string? RawSubFromCognitoUser(UserType u)
    {
        return u.Attributes?.FirstOrDefault(a => string.Equals(a.Name, "sub", StringComparison.OrdinalIgnoreCase))?.Value?.Trim();
    }

    private static string? NormalizeSubForDynamoLookup(string? rawSub)
    {
        if (string.IsNullOrEmpty(rawSub)) return null;
        var t = rawSub.Trim();
        return Guid.TryParse(t, out var g) ? g.ToString("D") : t;
    }

    private async Task<bool> IsAccountClosedForCognitoSubAsync(string? rawSub, CancellationToken cancellationToken)
    {
        if (string.IsNullOrEmpty(rawSub)) return false;
        var t = rawSub.Trim();
        if (await _profileService.IsAccountClosedAsync(t).ConfigureAwait(false)) return true;
        var n = NormalizeSubForDynamoLookup(t);
        if (!string.IsNullOrEmpty(n) && !string.Equals(t, n, StringComparison.Ordinal) &&
            await _profileService.IsAccountClosedAsync(n).ConfigureAwait(false))
            return true;
        return false;
    }

    public async Task<(EmailRegistrationStatus Status, string? Message, string? CognitoUsername)> CheckEmailForRegistrationAsync(
        string email,
        CancellationToken cancellationToken = default)
    {
        if (_userPoolIds.Length == 0)
        {
            _logger.LogWarning("CheckEmailForRegistration: no Cognito user pools resolved (COGNITO_USER_POOL_ID / AMPLIFY_USER_POOL_ID / extras)");
            return (EmailRegistrationStatus.Error, "Registration check is temporarily unavailable. Please try again shortly.", null);
        }

        var normalized = email.Trim().ToLowerInvariant();
        if (normalized.Length < 3 || normalized.Length > 254 || !normalized.Contains('@', StringComparison.Ordinal))
            return (EmailRegistrationStatus.Error, "Enter a valid email address.", null);

        var filter = $"email = \"{EscapeCognitoFilterValue(normalized)}\"";

        static string? EmailFromAttrs(List<AttributeType>? attrs)
        {
            if (attrs == null) return null;
            foreach (var a in attrs)
            {
                if (string.Equals(a.Name, "email", StringComparison.OrdinalIgnoreCase) && !string.IsNullOrEmpty(a.Value))
                    return a.Value.Trim().ToLowerInvariant();
            }
            return null;
        }

        var attemptedSelfHeal = false;

        RestartScan:
        var poolsCheckedOk = 0;
        var poolsFailed = 0;
        foreach (var poolId in _userPoolIds)
        {
            try
            {
                var resp = await _cognito.ListUsersAsync(new ListUsersRequest
                {
                    UserPoolId = poolId,
                    Filter = filter,
                    Limit = 10,
                }, cancellationToken).ConfigureAwait(false);

                poolsCheckedOk++;

                var users = resp.Users ?? new List<UserType>();
                if (users.Count == 0)
                    continue;

                var matches = users
                    .Where(u => string.Equals(EmailFromAttrs(u.Attributes), normalized, StringComparison.Ordinal))
                    .ToList();
                if (matches.Count == 0)
                    matches = users.ToList();

                var first = matches[0];
                var userStatus = first.UserStatus ?? "";

                // Soft-deleted CRM user: remove stale Cognito so the same email can sign up again.
                // Do not require emailReleasedForSignup (often unset); sub vs Dynamo PK may differ — use email scan fallback.
                if (!attemptedSelfHeal)
                {
                    var rawSub = RawSubFromCognitoUser(first);
                    var closedBySub = await IsAccountClosedForCognitoSubAsync(rawSub, cancellationToken).ConfigureAwait(false);

                    string? closedRowUserId = null;
                    if (!closedBySub)
                    {
                        closedRowUserId = await _profileService
                            .TryFindClosedAccountUserIdByEmailAsync(normalized, cancellationToken)
                            .ConfigureAwait(false);
                    }

                    var closedByEmailScan = !string.IsNullOrEmpty(closedRowUserId) &&
                        await _profileService.IsAccountClosedAsync(closedRowUserId).ConfigureAwait(false);

                    if (closedBySub || closedByEmailScan)
                    {
                        // Prefer Cognito sub when that row is closed in Dynamo; otherwise use PK from email scan.
                        // Do not delete by sub when only the scanned row is closed — sub may point at a different (active) user.
                        string? deleteKey = null;
                        if (closedBySub)
                            deleteKey = NormalizeSubForDynamoLookup(rawSub) ?? rawSub?.Trim();
                        else if (closedByEmailScan)
                            deleteKey = closedRowUserId;
                        if (string.IsNullOrEmpty(deleteKey))
                            deleteKey = first.Username;

                        if (!string.IsNullOrEmpty(deleteKey))
                        {
                            var removed = await _cognitoDeletion
                                .TryDeleteCognitoUserAsync(deleteKey, normalized, cancellationToken)
                                .ConfigureAwait(false);
                            if (removed)
                            {
                                _logger.LogInformation(
                                    "check-email: removed Cognito user blocking re-registration (closedBySub={BySub} closedByEmailScan={ByScan})",
                                    closedBySub,
                                    closedByEmailScan);
                                attemptedSelfHeal = true;
                                goto RestartScan;
                            }
                        }
                    }
                }

                if (string.Equals(userStatus, "CONFIRMED", StringComparison.OrdinalIgnoreCase))
                {
                    return (
                        EmailRegistrationStatus.ExistsConfirmed,
                        "An account with this email already exists. Sign in instead.",
                        null);
                }

                if (string.Equals(userStatus, "UNCONFIRMED", StringComparison.OrdinalIgnoreCase))
                {
                    return (
                        EmailRegistrationStatus.ExistsUnconfirmed,
                        "A verification email was already sent to this address. Check your inbox for the code, or resend below.",
                        first.Username);
                }

                return (
                    EmailRegistrationStatus.ExistsConfirmed,
                    "An account with this email already exists. Sign in instead.",
                    null);
            }
            catch (AmazonCognitoIdentityProviderException ex)
            {
                poolsFailed++;
                _logger.LogWarning(ex, "Cognito ListUsers failed for registration check (pool {PoolId})", poolId);
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (Exception ex)
            {
                poolsFailed++;
                _logger.LogWarning(ex, "Unexpected error in registration email check (pool {PoolId})", poolId);
            }
        }

        if (poolsCheckedOk == 0 || poolsFailed > 0)
        {
            return (EmailRegistrationStatus.Error, "Could not verify this email right now. Please try again in a moment.", null);
        }

        return (EmailRegistrationStatus.Available, null, null);
    }
}
