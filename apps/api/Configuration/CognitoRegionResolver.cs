namespace GetTrainMate.Api.Configuration;

/// <summary>
/// Cognito Identity Provider is regional. The user pool id prefix (e.g. <c>us-east-1</c> in <c>us-east-1_abc</c>)
/// is the region where AdminGetUser/ListUsers/GetUser must be invoked. Lambda's <c>AWS_REGION</c> may differ
/// from that prefix if the stack is deployed to another region while reusing a pool in us-east-1.
/// </summary>
public static class CognitoRegionResolver
{
    public static bool TryParseRegionFromUserPoolId(string? poolId, out string region)
    {
        region = "";
        if (string.IsNullOrWhiteSpace(poolId)) return false;
        var i = poolId.IndexOf('_', StringComparison.Ordinal);
        if (i <= 0) return false;
        region = poolId[..i];
        return region.Length > 0;
    }

    /// <summary>
    /// Resolves the AWS region name for <see cref="Amazon.CognitoIdentityProvider.AmazonCognitoIdentityProviderClient"/>.
    /// Prefer region embedded in configured user pool id(s); fall back to <c>Aws:Region</c>, <c>AWS_REGION</c>, then us-east-1.
    /// </summary>
    public static string ResolveRegionNameForCognitoClient(IConfiguration configuration)
    {
        foreach (var poolId in EnumerateConfiguredPoolIds(configuration))
        {
            if (TryParseRegionFromUserPoolId(poolId, out var r))
                return r;
        }

        return configuration["Aws:Region"]
            ?? Environment.GetEnvironmentVariable("AWS_REGION")
            ?? "us-east-1";
    }

    private static IEnumerable<string> EnumerateConfiguredPoolIds(IConfiguration configuration)
    {
        foreach (var s in EnumerateRawPoolIds(configuration))
        {
            var t = (s ?? "").Trim();
            if (t.Length > 0 && !string.Equals(t, "us-east-1_XXXXXXXXX", StringComparison.OrdinalIgnoreCase))
                yield return t;
        }
    }

    private static IEnumerable<string?> EnumerateRawPoolIds(IConfiguration configuration)
    {
        yield return Environment.GetEnvironmentVariable("COGNITO_USER_POOL_ID");
        yield return Environment.GetEnvironmentVariable("AMPLIFY_USER_POOL_ID");
        var extras = Environment.GetEnvironmentVariable("COGNITO_EXTRA_USER_POOL_IDS");
        if (!string.IsNullOrWhiteSpace(extras))
        {
            foreach (var p in extras.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
                yield return p;
        }

        yield return configuration["Aws:CognitoUserPoolId"];
    }
}
