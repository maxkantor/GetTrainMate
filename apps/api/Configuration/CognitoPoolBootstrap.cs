using Amazon;
using Amazon.CognitoIdentityProvider;
using Amazon.CognitoIdentityProvider.Model;
using Amazon.SecurityToken;
using Amazon.SecurityToken.Model;
using Amazon.SimpleSystemsManagement;
using Amazon.SimpleSystemsManagement.Model;
using Microsoft.Extensions.Configuration;
using Serilog;

namespace GetTrainMate.Api.Configuration;

/// <summary>
/// Resolves the real Cognito user pool id at cold start: optional SSM override, STS account logging,
/// DescribeUserPool validation, and when the configured id does not exist — list pools + optional
/// auto-correct when exactly one pool exists in that region.
/// </summary>
public static class CognitoPoolBootstrap
{
    public const string SsmUserPoolParameterName = "/gettrainmate/cognito/user-pool-id";

    /// <summary>Load pool id from SSM (overrides Lambda env from CDK) so you can fix prod without redeploying.</summary>
    public static void ApplySsmUserPoolIdOverride(IConfiguration configuration)
    {
        try
        {
            using var ssm = new AmazonSimpleSystemsManagementClient();
            var resp = ssm.GetParameterAsync(new GetParameterRequest
            {
                Name = SsmUserPoolParameterName,
                WithDecryption = false
            }).GetAwaiter().GetResult();
            var v = resp.Parameter?.Value?.Trim();
            if (string.IsNullOrEmpty(v)) return;
            if (string.Equals(v, "us-east-1_XXXXXXXXX", StringComparison.OrdinalIgnoreCase)) return;

            Environment.SetEnvironmentVariable("COGNITO_USER_POOL_ID", v);
            Log.Information(
                "COGNITO_USER_POOL_ID from SSM {Param} = {PoolId} (overrides Lambda environment / CDK)",
                SsmUserPoolParameterName,
                v);
        }
        catch (ParameterNotFoundException) { /* optional */ }
        catch (Exception ex)
        {
            Log.Warning(ex, "Could not read {Param} from SSM (optional)", SsmUserPoolParameterName);
        }
    }

    /// <summary>
    /// If DescribeUserPool fails, lists every pool id in this region/account so logs show the correct value to configure.
    /// If exactly one pool exists, sets COGNITO_USER_POOL_ID to that id (fixes wrong CDK context vs single pool).
    /// </summary>
    public static void ValidatePoolExistsOrDiagnose(IAmazonCognitoIdentityProvider cognito, string regionName)
    {
        var poolId = (Environment.GetEnvironmentVariable("COGNITO_USER_POOL_ID") ?? "").Trim();
        if (string.IsNullOrEmpty(poolId))
        {
            Log.Warning("COGNITO_USER_POOL_ID is not set; Cognito email resolution in Admin CRM will not work.");
            return;
        }

        var accountId = "?";
        try
        {
            using var sts = new AmazonSecurityTokenServiceClient(RegionEndpoint.GetBySystemName(regionName));
            var id = sts.GetCallerIdentityAsync(new GetCallerIdentityRequest()).GetAwaiter().GetResult();
            accountId = id.Account ?? "?";
            Log.Information(
                "AWS STS GetCallerIdentity: Account={Account} (compare with Cognito console account in the title bar)",
                accountId);
        }
        catch (Exception ex)
        {
            Log.Warning(ex, "STS GetCallerIdentity failed (add iam: sts:GetCallerIdentity if missing)");
        }

        try
        {
            var d = cognito.DescribeUserPoolAsync(new DescribeUserPoolRequest { UserPoolId = poolId }).GetAwaiter().GetResult();
            var name = d.UserPool?.Name ?? "?";
            Log.Information(
                "Cognito DescribeUserPool OK: PoolId={PoolId} Name={Name} in account {Account} region {Region}",
                poolId,
                name,
                accountId,
                regionName);
            return;
        }
        catch (AmazonCognitoIdentityProviderException ex) when (string.Equals(ex.ErrorCode, "ResourceNotFoundException", StringComparison.OrdinalIgnoreCase))
        {
            Log.Error(
                "COGNITO_POOL_MISSING: PoolId {PoolId} does not exist in account {Account} region {Region}. " +
                "Either the id is wrong (copy Pool Id from Cognito → User pools → your pool), or this Lambda runs in a different AWS account than the console you are looking at. " +
                "Fix without redeploy: aws ssm put-parameter --name {Ssm} --value \"YOUR_POOL_ID\" --type String --overwrite",
                poolId,
                accountId,
                regionName,
                SsmUserPoolParameterName);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "DescribeUserPool failed unexpectedly for {PoolId}", poolId);
            return;
        }

        try
        {
            var rows = new List<string>();
            string? next = null;
            do
            {
                var lr = cognito.ListUserPoolsAsync(new ListUserPoolsRequest { MaxResults = 60, NextToken = next })
                    .GetAwaiter().GetResult();
                foreach (var p in lr.UserPools)
                {
                    if (!string.IsNullOrEmpty(p.Id))
                        rows.Add($"{p.Id} | {p.Name ?? "(no name)"}");
                }
                next = lr.NextToken;
            } while (!string.IsNullOrEmpty(next));

            if (rows.Count == 0)
            {
                Log.Error(
                    "Cognito ListUserPools: zero user pools in region {Region} for account {Account}. " +
                    "Your pool may live in another region — pool id prefix must match (e.g. us-east-1_... → call APIs in us-east-1).",
                    regionName,
                    accountId);
                return;
            }

            Log.Error(
                "USER_POOLS_IN_THIS_ACCOUNT_REGION ({Count} in {Region}): {List}",
                rows.Count,
                regionName,
                string.Join(" || ", rows));

            var ids = rows
                .Select(r => r.Split('|')[0].Trim())
                .Where(s => s.Length > 0)
                .ToList();

            if (rows.Count == 1)
            {
                var onlyId = ids[0];
                if (!string.Equals(onlyId, poolId, StringComparison.Ordinal))
                {
                    Log.Warning(
                        "AUTO_FIX_COGNITO_POOL_ID: Replacing wrong COGNITO_USER_POOL_ID {Bad} with the only pool in this region: {Good}",
                        poolId,
                        onlyId);
                    Environment.SetEnvironmentVariable("COGNITO_USER_POOL_ID", onlyId);
                }
            }
            else
            {
                // Common copy/paste typo: capital I vs lowercase l in opaque pool suffix (e.g. mxju5 pool).
                var typoCandidates = ids
                    .Where(id => id.Length == poolId.Length && LevenshteinDistance(id, poolId) == 1)
                    .ToList();
                if (typoCandidates.Count == 1)
                {
                    var good = typoCandidates[0];
                    Log.Warning(
                        "AUTO_FIX_COGNITO_POOL_ID: Configured id looks like a 1-character typo (often I vs l). Replacing {Bad} with {Good}",
                        poolId,
                        good);
                    Environment.SetEnvironmentVariable("COGNITO_USER_POOL_ID", good);
                    try
                    {
                        var fix = cognito.DescribeUserPoolAsync(new DescribeUserPoolRequest { UserPoolId = good }).GetAwaiter().GetResult();
                        Log.Information(
                            "Cognito DescribeUserPool OK after typo fix: PoolId={PoolId} Name={Name}",
                            good,
                            fix.UserPool?.Name ?? "?");
                    }
                    catch (Exception ex)
                    {
                        Log.Error(ex, "DescribeUserPool failed even after typo-corrected id {PoolId}", good);
                    }
                }
            }
        }
        catch (Exception ex)
        {
            Log.Error(
                ex,
                "ListUserPools failed — ensure Lambda IAM includes cognito-idp:ListUserPools on resource *");
        }
    }

    private static int LevenshteinDistance(string a, string b)
    {
        var n = a.Length;
        var m = b.Length;
        if (n == 0) return m;
        if (m == 0) return n;
        var d = new int[n + 1, m + 1];
        for (var i = 0; i <= n; i++) d[i, 0] = i;
        for (var j = 0; j <= m; j++) d[0, j] = j;
        for (var i = 1; i <= n; i++)
        {
            for (var j = 1; j <= m; j++)
            {
                var cost = a[i - 1] == b[j - 1] ? 0 : 1;
                d[i, j] = Math.Min(
                    Math.Min(d[i - 1, j] + 1, d[i, j - 1] + 1),
                    d[i - 1, j - 1] + cost);
            }
        }

        return d[n, m];
    }
}
