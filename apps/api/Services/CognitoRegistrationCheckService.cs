using Amazon.CognitoIdentityProvider;
using Amazon.CognitoIdentityProvider.Model;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace GetTrainMate.Api.Services;

public class CognitoRegistrationCheckService : ICognitoRegistrationCheckService
{
    private readonly IAmazonCognitoIdentityProvider _cognito;
    private readonly IConfiguration _configuration;
    private readonly ILogger<CognitoRegistrationCheckService> _logger;

    public CognitoRegistrationCheckService(
        IAmazonCognitoIdentityProvider cognito,
        IConfiguration configuration,
        ILogger<CognitoRegistrationCheckService> logger)
    {
        _cognito = cognito;
        _configuration = configuration;
        _logger = logger;
    }

    private string? ResolveUserPoolId()
    {
        var id = Environment.GetEnvironmentVariable("COGNITO_USER_POOL_ID")
            ?? _configuration["Aws:CognitoUserPoolId"];
        return string.IsNullOrWhiteSpace(id) ? null : id.Trim();
    }

    private static string EscapeCognitoFilterValue(string value)
    {
        return value.Replace("\\", "\\\\", StringComparison.Ordinal).Replace("\"", "\\\"", StringComparison.Ordinal);
    }

    public async Task<(EmailRegistrationStatus Status, string? Message, string? CognitoUsername)> CheckEmailForRegistrationAsync(
        string email,
        CancellationToken cancellationToken = default)
    {
        var poolId = ResolveUserPoolId();
        if (string.IsNullOrEmpty(poolId))
        {
            _logger.LogWarning("CheckEmailForRegistration: no COGNITO_USER_POOL_ID / Aws:CognitoUserPoolId");
            return (EmailRegistrationStatus.Error, "Registration check is temporarily unavailable. Please try again shortly.", null);
        }

        var normalized = email.Trim().ToLowerInvariant();
        if (normalized.Length < 3 || normalized.Length > 254 || !normalized.Contains('@', StringComparison.Ordinal))
            return (EmailRegistrationStatus.Error, "Enter a valid email address.", null);

        var filter = $"email = \"{EscapeCognitoFilterValue(normalized)}\"";

        try
        {
            var resp = await _cognito.ListUsersAsync(new ListUsersRequest
            {
                UserPoolId = poolId,
                Filter = filter,
                Limit = 10,
            }, cancellationToken).ConfigureAwait(false);

            var users = resp.Users ?? new List<UserType>();
            if (users.Count == 0)
                return (EmailRegistrationStatus.Available, null, null);

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

            // Prefer exact email match on attributes (filter can be quirky with aliases)
            var matches = users
                .Where(u => string.Equals(EmailFromAttrs(u.Attributes), normalized, StringComparison.Ordinal))
                .ToList();
            if (matches.Count == 0)
                matches = users.ToList();

            var first = matches[0];
            var status = first.UserStatus ?? "";

            if (string.Equals(status, "CONFIRMED", StringComparison.OrdinalIgnoreCase))
            {
                return (
                    EmailRegistrationStatus.ExistsConfirmed,
                    "An account with this email already exists. Sign in instead.",
                    null);
            }

            if (string.Equals(status, "UNCONFIRMED", StringComparison.OrdinalIgnoreCase))
            {
                return (
                    EmailRegistrationStatus.ExistsUnconfirmed,
                    "A verification email was already sent to this address. Check your inbox for the code, or resend below.",
                    first.Username);
            }

            // FORCE_CHANGE_PASSWORD, RESET_REQUIRED, EXTERNAL_PROVIDER, etc. — treat as existing account
            return (
                EmailRegistrationStatus.ExistsConfirmed,
                "An account with this email already exists. Sign in instead.",
                null);
        }
        catch (AmazonCognitoIdentityProviderException ex)
        {
            _logger.LogWarning(ex, "Cognito ListUsers failed for registration check (pool {PoolId})", poolId);
            return (EmailRegistrationStatus.Error, "Could not verify this email right now. Please try again in a moment.", null);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Unexpected error in registration email check");
            return (EmailRegistrationStatus.Error, "Could not verify this email right now. Please try again in a moment.", null);
        }
    }
}
