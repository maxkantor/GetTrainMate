using Amazon.CognitoIdentityProvider;
using Amazon.CognitoIdentityProvider.Model;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace GetTrainMate.Api.Services;

public class CognitoAdminUserDeletionService : ICognitoAdminUserDeletionService
{
    private readonly IAmazonCognitoIdentityProvider _cognito;
    private readonly string[] _poolIds;
    private readonly ILogger<CognitoAdminUserDeletionService> _logger;

    public CognitoAdminUserDeletionService(
        IAmazonCognitoIdentityProvider cognito,
        IConfiguration configuration,
        ILogger<CognitoAdminUserDeletionService> logger)
    {
        _cognito = cognito;
        _logger = logger;
        _poolIds = CognitoPoolConfiguration.ResolveAllUserPoolIds(configuration);
    }

    /// <inheritdoc />
    public async Task<bool> TryDeleteCognitoUserAsync(
        string userId,
        string? cognitoEmailHint,
        CancellationToken cancellationToken = default)
    {
        if (_poolIds.Length == 0) return false;
        var lookupId = NormalizeUserIdForCognitoLookup(userId);
        foreach (var poolId in _poolIds)
        {
            if (await TryDeleteInPoolAsync(userId, lookupId, cognitoEmailHint, poolId, cancellationToken).ConfigureAwait(false))
                return true;
        }

        return false;
    }

    private static string NormalizeUserIdForCognitoLookup(string userId)
    {
        userId = userId.Trim();
        if (Guid.TryParse(userId, out var g))
            return g.ToString("D");
        return userId;
    }

    private static string EscapeCognitoListUsersFilterValue(string value)
    {
        return value.Replace("\\", "\\\\", StringComparison.Ordinal).Replace("\"", "\\\"", StringComparison.Ordinal);
    }

    private static string ShortUserIdForLogs(string? userId)
    {
        if (string.IsNullOrEmpty(userId)) return "(empty)";
        return userId.Length <= 14 ? userId : userId[..8] + "…" + userId[^4..];
    }

    private static string DescribeCognitoUsername(string? username)
    {
        if (string.IsNullOrEmpty(username)) return "empty";
        if (username.Contains('@', StringComparison.Ordinal)) return "email-shaped";
        if (Guid.TryParse(username, out _)) return "uuid-shaped";
        return "other";
    }

    private static string? EmailFromCognitoAttributes(List<AttributeType>? attrs)
    {
        if (attrs == null || attrs.Count == 0)
            return null;
        static bool LooksLikeEmail(string? s) =>
            !string.IsNullOrWhiteSpace(s) && s.Contains('@', StringComparison.Ordinal)
            && s.IndexOf('@', StringComparison.Ordinal) > 0
            && s.IndexOf('@', StringComparison.Ordinal) < s.Length - 1;

        var email = attrs.FirstOrDefault(a => string.Equals(a.Name, "email", StringComparison.OrdinalIgnoreCase))?.Value?.Trim();
        if (LooksLikeEmail(email))
            return email;
        var pref = attrs.FirstOrDefault(a => a.Name == "preferred_username")?.Value?.Trim();
        if (LooksLikeEmail(pref))
            return pref;
        foreach (var a in attrs)
        {
            if (a.Name != null && a.Name.Contains("email", StringComparison.OrdinalIgnoreCase) && LooksLikeEmail(a.Value))
                return a.Value!.Trim();
        }

        return null;
    }

    private async Task<bool> TryDeleteInPoolAsync(
        string userId,
        string lookupId,
        string? cognitoEmailHint,
        string poolId,
        CancellationToken cancellationToken)
    {
        async Task<bool> deleteByUsernameAsync(string? username)
        {
            if (string.IsNullOrEmpty(username)) return false;
            try
            {
                await _cognito.AdminDeleteUserAsync(new AdminDeleteUserRequest
                {
                    UserPoolId = poolId,
                    Username = username,
                }, cancellationToken).ConfigureAwait(false);
                _logger.LogInformation(
                    "AdminDeleteUser succeeded for {UserId} in pool {PoolId} (username={UsernameKind})",
                    ShortUserIdForLogs(userId),
                    poolId,
                    DescribeCognitoUsername(username));
                return true;
            }
            catch (UserNotFoundException)
            {
                return false;
            }
            catch (AmazonCognitoIdentityProviderException ex) when (
                string.Equals(ex.ErrorCode, "UserNotFoundException", StringComparison.OrdinalIgnoreCase))
            {
                return false;
            }
            catch (AmazonCognitoIdentityProviderException ex)
            {
                _logger.LogWarning(
                    "AdminDeleteUser denied or failed: pool={PoolId} user={User} usernameKind={Kind} errorCode={Code} message={Msg}",
                    poolId,
                    ShortUserIdForLogs(userId),
                    DescribeCognitoUsername(username),
                    ex.ErrorCode ?? "(null)",
                    ex.Message);
                return false;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "AdminDeleteUser failed for {UserId} pool {PoolId}", userId, poolId);
                return false;
            }
        }

        if (await deleteByUsernameAsync(lookupId).ConfigureAwait(false))
            return true;

        try
        {
            var subFilter = $"sub = \"{EscapeCognitoListUsersFilterValue(lookupId)}\"";
            var bySub = await _cognito.ListUsersAsync(new ListUsersRequest
            {
                UserPoolId = poolId,
                Filter = subFilter,
                Limit = 10,
            }, cancellationToken).ConfigureAwait(false);
            foreach (var u in bySub.Users ?? new List<UserType>())
            {
                if (!string.IsNullOrEmpty(u.Username) && await deleteByUsernameAsync(u.Username).ConfigureAwait(false))
                    return true;
            }
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "ListUsers(sub) delete path for {UserId} pool {PoolId}", userId, poolId);
        }

        try
        {
            var unFilter = $"username = \"{EscapeCognitoListUsersFilterValue(lookupId)}\"";
            var byUsername = await _cognito.ListUsersAsync(new ListUsersRequest
            {
                UserPoolId = poolId,
                Filter = unFilter,
                Limit = 10,
            }, cancellationToken).ConfigureAwait(false);
            foreach (var u in byUsername.Users ?? new List<UserType>())
            {
                if (!string.IsNullOrEmpty(u.Username) && await deleteByUsernameAsync(u.Username).ConfigureAwait(false))
                    return true;
            }
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "ListUsers(username) delete path for {UserId} pool {PoolId}", userId, poolId);
        }

        if (string.IsNullOrWhiteSpace(cognitoEmailHint))
            return false;

        var normalizedEmail = cognitoEmailHint.Trim().ToLowerInvariant();
        try
        {
            var emailFilter = $"email = \"{EscapeCognitoListUsersFilterValue(normalizedEmail)}\"";
            var byEmail = await _cognito.ListUsersAsync(new ListUsersRequest
            {
                UserPoolId = poolId,
                Filter = emailFilter,
                Limit = 10,
            }, cancellationToken).ConfigureAwait(false);
            foreach (var u in byEmail.Users ?? new List<UserType>())
            {
                var em = EmailFromCognitoAttributes(u.Attributes);
                if (!string.Equals(em, normalizedEmail, StringComparison.OrdinalIgnoreCase))
                    continue;
                if (!string.IsNullOrEmpty(u.Username) && await deleteByUsernameAsync(u.Username).ConfigureAwait(false))
                    return true;
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "ListUsers(email) delete path for {UserId} pool {PoolId}", userId, poolId);
        }

        return false;
    }
}
