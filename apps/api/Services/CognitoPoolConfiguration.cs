using Microsoft.Extensions.Configuration;

namespace GetTrainMate.Api.Services;

/// <summary>
/// Resolves the same Cognito user pool id list for admin CRM, signup email checks, and deletes.
/// Production often uses one pool from CDK (<c>COGNITO_USER_POOL_ID</c>) and another for Amplify web
/// (<c>AMPLIFY_USER_POOL_ID</c>); checking only the primary pool makes duplicate detection and deletes inconsistent.
/// </summary>
public static class CognitoPoolConfiguration
{
    public static string[] ResolveAllUserPoolIds(IConfiguration configuration)
    {
        var primary = ResolvePrimaryUserPoolId(configuration);
        var amplifyPool = NormalizeUserPoolId(Environment.GetEnvironmentVariable("AMPLIFY_USER_POOL_ID"));
        if (!string.IsNullOrEmpty(amplifyPool) &&
            string.Equals(amplifyPool, primary, StringComparison.OrdinalIgnoreCase))
            amplifyPool = "";

        var extraRaw = ResolveExtraUserPoolIdsRaw(configuration);
        if (!string.IsNullOrEmpty(amplifyPool))
            extraRaw = string.IsNullOrEmpty(extraRaw) ? amplifyPool : $"{extraRaw},{amplifyPool}";

        var poolIds = string.Join(',', primary, extraRaw)
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(s => !string.IsNullOrWhiteSpace(s))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        if (poolIds.Count > 0 && !string.IsNullOrEmpty(primary))
        {
            poolIds.RemoveAll(p => string.Equals(p, primary, StringComparison.OrdinalIgnoreCase));
            poolIds.Insert(0, primary);
        }

        return poolIds.ToArray();
    }

    private static string NormalizeUserPoolId(string? value)
    {
        var s = (value ?? "").Trim();
        if (s.Length == 0) return "";
        if (string.Equals(s, "us-east-1_XXXXXXXXX", StringComparison.OrdinalIgnoreCase)) return "";
        return s;
    }

    private static string ResolvePrimaryUserPoolId(IConfiguration configuration)
    {
        var env = NormalizeUserPoolId(Environment.GetEnvironmentVariable("COGNITO_USER_POOL_ID"));
        if (env.Length > 0) return env;
        return NormalizeUserPoolId(configuration["Aws:CognitoUserPoolId"]);
    }

    private static string ResolveExtraUserPoolIdsRaw(IConfiguration configuration)
    {
        var env = (Environment.GetEnvironmentVariable("COGNITO_EXTRA_USER_POOL_IDS") ?? "").Trim();
        if (env.Length > 0) return env;
        return (configuration["Aws:CognitoExtraUserPoolIds"] ?? "").Trim();
    }
}
