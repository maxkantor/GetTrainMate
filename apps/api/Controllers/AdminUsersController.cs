using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using GetTrainMate.Api.Models;
using GetTrainMate.Api.Services;
using Amazon.CognitoIdentityProvider;
using Amazon.CognitoIdentityProvider.Model;
using Amazon.DynamoDBv2;
using Amazon.DynamoDBv2.DataModel;
using Amazon.DynamoDBv2.DocumentModel;
using System.Security.Claims;
using Microsoft.Extensions.DependencyInjection;

namespace GetTrainMate.Api.Controllers;

[ApiController]
[Route("api/admin/users")]
[Authorize]
public class AdminUsersController : ControllerBase
{
    private readonly IDynamoDBContext _context;
    private readonly IAmazonDynamoDB _dynamoDb;
    private readonly IAuditLogService _auditLogService;
    private readonly IProfileService _profileService;
    private readonly ICreditsService _creditsService;
    private readonly string _profilesTableName;
    /// <summary>Primary + optional extra pools (e.g. Amplify app pool when stack uses a different pool).</summary>
    private readonly string[] _cognitoUserPoolIds;
    private readonly IAmazonCognitoIdentityProvider _cognito;
    private readonly ILogger<AdminUsersController> _logger;

    public AdminUsersController(
        IDynamoDBContext context,
        IAmazonDynamoDB dynamoDb,
        IAuditLogService auditLogService,
        IProfileService profileService,
        ICreditsService creditsService,
        IAmazonCognitoIdentityProvider cognito,
        IConfiguration configuration,
        ILogger<AdminUsersController> logger)
    {
        _context = context;
        _dynamoDb = dynamoDb;
        _auditLogService = auditLogService;
        _profileService = profileService;
        _creditsService = creditsService;
        _cognito = cognito;
        var prefix = configuration["DYNAMODB_TABLE_PREFIX"] ?? "gettrainmate-";
        _profilesTableName = configuration["DYNAMODB_TABLE_PROFILES"] ?? $"{prefix}profiles";
        // appsettings.json ships a non-empty placeholder; it must NOT win over Lambda COGNITO_USER_POOL_ID
        // (otherwise Cognito calls target us-east-1_XXXXXXXXX and IAM denies AdminGetUser).
        var primary = ResolvePrimaryUserPoolId(configuration);
        var amplifyPool = NormalizeUserPoolId(Environment.GetEnvironmentVariable("AMPLIFY_USER_POOL_ID"));
        // Same id twice (e.g. manual Lambda edits) must not reorder or duplicate.
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

        // Always try COGNITO_USER_POOL_ID (primary) first — it is the CDK/deploy source of truth.
        // Legacy setups used AMPLIFY_USER_POOL_ID first when the API stack pointed at a different pool; that ordering
        // broke CRM when AMPLIFY_* / EXTRAS were typos or stale while primary was correct.
        if (poolIds.Count > 0 && !string.IsNullOrEmpty(primary))
        {
            poolIds.RemoveAll(p => string.Equals(p, primary, StringComparison.OrdinalIgnoreCase));
            poolIds.Insert(0, primary);
        }

        _cognitoUserPoolIds = poolIds.ToArray();
        _logger = logger;
        if (_cognitoUserPoolIds.Length > 0)
            _logger.LogInformation("Admin CRM Cognito email lookup pool order: {Pools}", string.Join(", ", _cognitoUserPoolIds));
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

    private AdminIdentity GetAdminIdentity()
    {
        if (HttpContext.Items["AdminIdentity"] is AdminIdentity identity)
        {
            return identity;
        }
        
        var sub = User.FindFirst(ClaimTypes.NameIdentifier)?.Value 
            ?? User.FindFirst("sub")?.Value 
            ?? throw new UnauthorizedAccessException("Admin identity not found");
        
        return new AdminIdentity
        {
            Sub = sub,
            CognitoUsername = User.FindFirst("cognito:username")?.Value,
            Email = User.FindFirst(ClaimTypes.Email)?.Value ?? User.FindFirst("email")?.Value
        };
    }

    /// <summary>
    /// GET /api/admin/users?search=&status=&plan=&sort=&page=&pageSize=
    /// List users with pagination and filtering
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<PagedResponse<UserListItem>>> GetUsers(
        [FromQuery] string? search = null,
        [FromQuery] string? status = null,
        [FromQuery] string? plan = null,
        [FromQuery] string? sort = "createdAt",
        [FromQuery] bool testUsersOnly = false,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        try
        {
            page = Math.Max(1, page);
            pageSize = Math.Clamp(pageSize, 1, 200);

            var table = Table.LoadTable(_dynamoDb, _profilesTableName);
            var scan = table.Scan(new ScanOperationConfig());
            var all = new List<Document>();
            do
            {
                var batch = await scan.GetNextSetAsync();
                all.AddRange(batch);
            } while (!scan.IsDone);

            var q = search?.Trim().ToLowerInvariant();
            IEnumerable<UserListItem> rows = all.Select(MapDocumentToListItem).Where(x => x.UserId.Length > 0);

            rows = rows.Where(x => testUsersOnly ? IsTestUserRow(x) : !IsTestUserRow(x));

            if (!string.IsNullOrEmpty(q))
            {
                rows = rows.Where(x =>
                    (x.Email?.ToLowerInvariant().Contains(q) ?? false) ||
                    (x.Name?.ToLowerInvariant().Contains(q) ?? false) ||
                    (x.UserId?.ToLowerInvariant().Contains(q) ?? false) ||
                    (x.City?.ToLowerInvariant().Contains(q) ?? false));
            }

            if (!string.IsNullOrEmpty(status) && !string.Equals(status, "all", StringComparison.OrdinalIgnoreCase))
                rows = rows.Where(x => string.Equals(x.Status, status, StringComparison.OrdinalIgnoreCase));

            if (!string.IsNullOrEmpty(plan) && !string.Equals(plan, "all", StringComparison.OrdinalIgnoreCase))
                rows = rows.Where(x => string.Equals(x.Plan ?? "free", plan, StringComparison.OrdinalIgnoreCase));

            var list = rows.ToList();
            if (string.Equals(sort ?? "createdAt", "createdAt", StringComparison.OrdinalIgnoreCase))
                list = list.OrderByDescending(x => x.CreatedAt).ToList();
            else
                list = list.OrderBy(x => x.Name, StringComparer.OrdinalIgnoreCase).ToList();

            var totalCount = list.Count;
            var totalPages = totalCount == 0 ? 1 : (int)Math.Ceiling(totalCount / (double)pageSize);
            var slice = list.Skip((page - 1) * pageSize).Take(pageSize).ToList();

            await EnrichListFieldsAsync(slice, includeCognitoEmailLookup: !testUsersOnly);

            return Ok(new PagedResponse<UserListItem>
            {
                Items = slice,
                Page = page,
                PageSize = pageSize,
                TotalCount = totalCount,
                TotalPages = totalPages
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error listing users");
            return StatusCode(500, new { error = "Failed to list users" });
        }
    }

    private static bool IsTestUserRow(UserListItem x)
    {
        if (x.UserId.StartsWith("dummy-user-", StringComparison.OrdinalIgnoreCase))
            return true;
        if (!string.IsNullOrEmpty(x.Email) && x.Email.EndsWith("@test.com", StringComparison.OrdinalIgnoreCase))
            return true;
        return false;
    }

    /// <summary>Cognito stores <c>sub</c> as a lowercase GUID string; Dynamo/JWT may differ in casing.</summary>
    private static string NormalizeUserIdForCognitoLookup(string userId)
    {
        userId = userId.Trim();
        if (Guid.TryParse(userId, out var g))
            return g.ToString("D");
        return userId;
    }

    /// <summary>Short id for logs (full sub is still unique enough for support).</summary>
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

    private static string FormatAttrNames(List<AttributeType>? attrs)
    {
        if (attrs == null || attrs.Count == 0) return "(no attrs)";
        return string.Join(",", attrs.Select(a => a.Name ?? "?").OrderBy(s => s));
    }

    /// <summary>True when Cognito returns that the user pool id does not exist in this account/region.</summary>
    private static bool IsCognitoUserPoolMissing(AmazonCognitoIdentityProviderException ex)
    {
        if (ex == null) return false;
        if (!string.Equals(ex.ErrorCode, "ResourceNotFoundException", StringComparison.OrdinalIgnoreCase))
            return false;
        var m = ex.Message ?? "";
        return m.Contains("User pool", StringComparison.OrdinalIgnoreCase)
               && m.Contains("does not exist", StringComparison.OrdinalIgnoreCase);
    }

    private static string? EmailFromCognitoAttributes(List<AttributeType> attrs)
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
        foreach (var a in attrs)
        {
            if (LooksLikeEmail(a.Value) && a.Name is "nickname" or "profile" or "website")
                return a.Value!.Trim();
        }
        return null;
    }

    private async Task<string?> TryGetCognitoEmailAsync(string userId)
    {
        userId = (userId ?? "").Trim();
        if (userId.Length == 0 || userId.StartsWith("dummy-user-", StringComparison.OrdinalIgnoreCase))
            return null;
        if (_cognitoUserPoolIds.Length == 0)
        {
            _logger.LogWarning("Cognito user pool id not configured; cannot resolve emails from Cognito.");
            return null;
        }

        var lookupPreview = NormalizeUserIdForCognitoLookup(userId);
        _logger.LogInformation(
            "AdminCRM email | user={User} | COGNITO_START | pools={Pools} rawEqualsLookup={Same}",
            ShortUserIdForLogs(userId),
            string.Join(",", _cognitoUserPoolIds),
            string.Equals(userId, lookupPreview, StringComparison.Ordinal));

        foreach (var poolId in _cognitoUserPoolIds)
        {
            var em = await TryGetCognitoEmailInPoolAsync(userId, poolId);
            if (!string.IsNullOrEmpty(em))
            {
                _logger.LogInformation(
                    "AdminCRM email | user={User} | COGNITO_OK | pool={Pool} | source=cognito",
                    ShortUserIdForLogs(userId),
                    poolId);
                return em;
            }
        }

        _logger.LogWarning(
            "AdminCRM email | user={User} | COGNITO_FAIL | tried_pools={Pools}",
            ShortUserIdForLogs(userId),
            string.Join(",", _cognitoUserPoolIds));
        return null;
    }

    /// <summary>
    /// AdminGetUser(Username=sub) works when Cognito username equals sub; otherwise ListUsers(sub=...) is required.
    /// Lambda must have cognito-idp:ListUsers on the pool (email-alias sign-in uses non-sub Username).
    /// </summary>
    private async Task<string?> TryGetCognitoEmailInPoolAsync(string userId, string poolId)
    {
        var lookupId = NormalizeUserIdForCognitoLookup(userId);

        void T(string step, string? detail = null)
        {
            _logger.LogInformation(
                "AdminCRM email | user={User} | pool={Pool} | {Step} | {Detail}",
                ShortUserIdForLogs(userId),
                poolId,
                step,
                detail ?? "-");
        }

        async Task<string?> resolveFromListUserAsync(UserType? u, string via)
        {
            if (u == null)
            {
                T("LIST_USERS_ROW", $"{via}: no user row");
                return null;
            }

            var names = FormatAttrNames(u.Attributes);
            T("LIST_USERS_ROW", $"{via}: UsernameKind={DescribeCognitoUsername(u.Username)} UserStatus={u.UserStatus} attrNames=[{names}]");

            var fromList = u.Attributes != null ? EmailFromCognitoAttributes(u.Attributes) : null;
            if (!string.IsNullOrEmpty(fromList))
            {
                T("EMAIL_EXTRACT", $"{via}: from ListUsers attributes");
                return fromList;
            }

            if (string.IsNullOrEmpty(u.Username))
            {
                T("LIST_USERS_ROW", $"{via}: empty Username, cannot AdminGetUser fallback");
                return null;
            }

            try
            {
                T("ADMIN_GET_USER_FALLBACK", $"after ListUsers, UsernameKind={DescribeCognitoUsername(u.Username)}");
                var agu = await _cognito.AdminGetUserAsync(new AdminGetUserRequest
                {
                    UserPoolId = poolId,
                    Username = u.Username
                });
                var aguNames = FormatAttrNames(agu.UserAttributes);
                var extracted = EmailFromCognitoAttributes(agu.UserAttributes);
                T("ADMIN_GET_USER_FALLBACK_RESULT", $"attrNames=[{aguNames}] extracted={(string.IsNullOrEmpty(extracted) ? "no" : "yes")}");
                return extracted;
            }
            catch (Exception ex)
            {
                T("ADMIN_GET_USER_FALLBACK_ERR", ex.Message);
                _logger.LogWarning(ex, "AdminGetUser after ListUsers failed pool {PoolId}", poolId);
                return null;
            }
        }

        async Task<string?> listUsersByFilterAsync(string filterField)
        {
            var filter = filterField == "sub"
                ? $"sub = \"{lookupId}\""
                : $"username = \"{lookupId.Replace("\"", "\\\"")}\"";
            T("LIST_USERS_REQUEST", $"{filterField} filter (value normalized)");
            try
            {
                var list = await _cognito.ListUsersAsync(new ListUsersRequest
                {
                    UserPoolId = poolId,
                    Filter = filter,
                    Limit = 5
                });
                T("LIST_USERS_RESULT", $"filter={filterField} count={list.Users.Count} hasMorePagination={!string.IsNullOrEmpty(list.PaginationToken)}");
                return await resolveFromListUserAsync(list.Users.FirstOrDefault(), $"ListUsers:{filterField}");
            }
            catch (AmazonCognitoIdentityProviderException ex) when (IsCognitoUserPoolMissing(ex))
            {
                T("LIST_USERS_ERR", $"{filterField} POOL_DOES_NOT_EXIST");
                _logger.LogError(
                    "AdminCRM: ListUsers failed — user pool {PoolId} does not exist in this account. Fix AMPLIFY_USER_POOL_ID / cdk.json amplifyUserPoolId to a real Cognito pool ID, then cdk deploy.",
                    poolId);
                return null;
            }
            catch (AmazonCognitoIdentityProviderException ex)
            {
                T("LIST_USERS_ERR", $"{filterField} {ex.ErrorCode}: {ex.Message}");
                throw;
            }
        }

        async Task<string?> listUsersStrategiesAsync(string reason)
        {
            T("LIST_USERS_STRATEGIES", reason);
            try
            {
                var bySub = await listUsersByFilterAsync("sub");
                if (!string.IsNullOrEmpty(bySub))
                    return bySub;
            }
            catch (AmazonCognitoIdentityProviderException ex) when (ex.ErrorCode == "AccessDeniedException" || ex.ErrorCode == "NotAuthorizedException")
            {
                _logger.LogWarning(ex, "Cognito ListUsers denied for pool {PoolId}. Grant cognito-idp:ListUsers on this pool to the API Lambda role.", poolId);
                T("LIST_USERS_DENIED", ex.ErrorCode ?? "denied");
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "ListUsers(sub) failed for {UserId} pool {PoolId}", lookupId, poolId);
                T("LIST_USERS_EXCEPTION", $"sub: {ex.Message}");
            }

            try
            {
                return await listUsersByFilterAsync("username");
            }
            catch (AmazonCognitoIdentityProviderException ex) when (ex.ErrorCode == "AccessDeniedException" || ex.ErrorCode == "NotAuthorizedException")
            {
                _logger.LogWarning(ex, "Cognito ListUsers denied for pool {PoolId}. Grant cognito-idp:ListUsers on this pool to the API Lambda role.", poolId);
                T("LIST_USERS_DENIED", ex.ErrorCode ?? "denied");
            }
            catch (Exception ex)
            {
                _logger.LogDebug(ex, "ListUsers(username) failed for {UserId} pool {PoolId}", lookupId, poolId);
                T("LIST_USERS_EXCEPTION", $"username: {ex.Message}");
            }

            return null;
        }

        T("POOL_ENTER", $"lookupId={ShortUserIdForLogs(lookupId)}");

        try
        {
            var resp = await _cognito.AdminGetUserAsync(new AdminGetUserRequest
            {
                UserPoolId = poolId,
                Username = lookupId
            });
            var agNames = FormatAttrNames(resp.UserAttributes);
            T("ADMIN_GET_USER_OK", $"Username={DescribeCognitoUsername(resp.Username)} attrNames=[{agNames}]");
            var fromAttrs = EmailFromCognitoAttributes(resp.UserAttributes);
            if (!string.IsNullOrEmpty(fromAttrs))
            {
                T("EMAIL_EXTRACT", "from AdminGetUser attributes");
                return fromAttrs;
            }

            T("ADMIN_GET_USER_NO_EMAIL", "trying ListUsers strategies after AdminGetUser returned no extractable email");
            try
            {
                var fromList = await listUsersStrategiesAsync("after AdminGetUser without email");
                if (!string.IsNullOrEmpty(fromList))
                    return fromList;
            }
            catch (AmazonCognitoIdentityProviderException ex) when (ex.ErrorCode == "AccessDeniedException" || ex.ErrorCode == "NotAuthorizedException")
            {
                _logger.LogWarning(ex, "Cognito ListUsers denied for pool {PoolId}. Grant cognito-idp:ListUsers on this pool to the API Lambda role.", poolId);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "ListUsers strategies failed for {UserId} pool {PoolId}", lookupId, poolId);
                T("LIST_USERS_STRATEGIES_ERR", ex.Message);
            }

            T("POOL_GIVE_UP", "no email after AdminGetUser + ListUsers");
            return null;
        }
        catch (UserNotFoundException)
        {
            T("ADMIN_GET_USER", "UserNotFound for Username=lookupId — trying ListUsers by sub/username");
            try
            {
                return await listUsersStrategiesAsync("after UserNotFound");
            }
            catch (AmazonCognitoIdentityProviderException ex) when (ex.ErrorCode == "AccessDeniedException" || ex.ErrorCode == "NotAuthorizedException")
            {
                _logger.LogWarning(ex, "Cognito ListUsers denied for pool {PoolId}. Grant cognito-idp:ListUsers on this pool to the API Lambda role.", poolId);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "ListUsers strategies failed for {UserId} pool {PoolId}", lookupId, poolId);
                T("LIST_USERS_STRATEGIES_ERR", ex.Message);
            }

            T("POOL_GIVE_UP", "UserNotFound path exhausted");
            return null;
        }
        catch (AmazonCognitoIdentityProviderException ex) when (IsCognitoUserPoolMissing(ex))
        {
            _logger.LogError(
                "AdminCRM: AdminGetUser failed — user pool {PoolId} does not exist in this AWS account/region. " +
                "Update infra/cdk.json \"amplifyUserPoolId\" and Lambda AMPLIFY_USER_POOL_ID / COGNITO_EXTRA_USER_POOL_IDS to the Pool Id shown in Cognito console for the pool your users use (must match Amplify VITE_COGNITO_USER_POOL_ID). Then: cdk deploy.",
                poolId);
            T("POOL_DOES_NOT_EXIST", ex.Message);
            return null;
        }
        catch (AmazonCognitoIdentityProviderException ex) when (ex.ErrorCode == "AccessDeniedException" || ex.ErrorCode == "NotAuthorizedException")
        {
            _logger.LogWarning(ex, "Cognito AdminGetUser denied for pool {PoolId}. Check Lambda IAM.", poolId);
            T("ADMIN_GET_USER_DENIED", ex.ErrorCode ?? "denied");
            return null;
        }
        catch (Exception ex)
        {
            T("ADMIN_GET_USER_ERR", $"{ex.GetType().Name}: {ex.Message}");
            _logger.LogWarning(ex, "AdminGetUser unexpected error user {User} pool {Pool}", ShortUserIdForLogs(userId), poolId);
            return null;
        }
    }

    private async Task<string?> TryGetWalletEmailAsync(string userId)
    {
        if (string.IsNullOrWhiteSpace(userId))
            return null;
        try
        {
            var wallets = await _context.QueryAsync<TokenWallet>(
                    userId,
                    new DynamoDBOperationConfig { IndexName = "userId-index" })
                .GetRemainingAsync();
            _logger.LogInformation(
                "AdminCRM email | user={User} | WALLET_QUERY | rows={Count}",
                ShortUserIdForLogs(userId),
                wallets.Count);
            var email = wallets
                .Select(w => (w.Email ?? string.Empty).Trim())
                .FirstOrDefault(e => !string.IsNullOrWhiteSpace(e));
            if (string.IsNullOrWhiteSpace(email))
            {
                _logger.LogInformation(
                    "AdminCRM email | user={User} | WALLET_QUERY | no non-empty Email on wallets",
                    ShortUserIdForLogs(userId));
                return null;
            }

            _logger.LogInformation(
                "AdminCRM email | user={User} | WALLET_OK | source=token-wallet",
                ShortUserIdForLogs(userId));
            return email;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "AdminCRM email | user={User} | WALLET_ERR", ShortUserIdForLogs(userId));
            return null;
        }
    }

    private async Task<int?> TryGetCreditsAsync(string userId)
    {
        if (string.IsNullOrWhiteSpace(userId))
            return null;
        try
        {
            var credits = await _creditsService.GetCreditsBalanceAsync(userId);
            return credits.Balance;
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Could not resolve credits for user {UserId}", userId);
            return null;
        }
    }

    private async Task EnrichListFieldsAsync(List<UserListItem> slice, bool includeCognitoEmailLookup)
    {
        if (includeCognitoEmailLookup && slice.Count > 0)
            _logger.LogInformation("AdminCRM email | ENRICH_BATCH | slice={Count}", slice.Count);

        var tasks = slice.Select(async u =>
        {
            // Email: prefer persisted profile email; fallback to Cognito when available.
            if (includeCognitoEmailLookup && string.IsNullOrWhiteSpace(u.Email) && !IsTestUserRow(u))
            {
                var fromCog = await TryGetCognitoEmailAsync(u.UserId);
                var fromWal = string.IsNullOrEmpty(fromCog) ? await TryGetWalletEmailAsync(u.UserId) : null;
                var em = fromCog ?? fromWal;
                if (!string.IsNullOrEmpty(em))
                {
                    u.Email = em;
                    await _profileService.SetProfileEmailIfEmptyAsync(u.UserId, em);
                }
                else
                {
                    _logger.LogWarning(
                        "AdminCRM email | user={User} | ROW_STILL_NO_EMAIL | after cognito+wallet; Dynamo profile had no email",
                        ShortUserIdForLogs(u.UserId));
                }
            }

            // Credits: always attempt to resolve for list view.
            u.Credits = await TryGetCreditsAsync(u.UserId);
        });
        await Task.WhenAll(tasks);
    }

    private static UserListItem MapDocumentToListItem(Document doc)
    {
        var uid = doc.ContainsKey("userId") ? doc["userId"].AsString()
            : doc.ContainsKey("UserId") ? doc["UserId"].AsString() : "";
        var created = DateTime.UtcNow;
        var createdRaw = doc.ContainsKey("createdAt") ? doc["createdAt"].AsString()
            : doc.ContainsKey("CreatedAt") ? doc["CreatedAt"].AsString() : null;
        if (!string.IsNullOrEmpty(createdRaw) && DateTime.TryParse(createdRaw, out var ca))
            created = ca;
        var email = doc.ContainsKey("email") ? doc["email"].AsString()
            : doc.ContainsKey("Email") ? doc["Email"].AsString() : "";
        var name = doc.ContainsKey("name") ? doc["name"].AsString()
            : doc.ContainsKey("Name") ? doc["Name"].AsString() : "";
        return new UserListItem
        {
            UserId = uid,
            Email = email,
            Name = name,
            Status = "active",
            Plan = "free",
            City = doc.ContainsKey("city") ? doc["city"].AsString()
                : doc.ContainsKey("City") ? doc["City"].AsString() : null,
            State = doc.ContainsKey("state") ? doc["state"].AsString()
                : doc.ContainsKey("State") ? doc["State"].AsString() : null,
            CreatedAt = created
        };
    }

    /// <summary>
    /// GET /api/admin/users/{userId}
    /// Get user details
    /// </summary>
    [HttpGet("{userId}")]
    public async Task<ActionResult<UserDetail>> GetUser(string userId)
    {
        try
        {
            var profile = await _profileService.GetProfileAsync(userId);
            if (profile == null)
                return NotFound(new { error = "User not found" });

            var credits = await _creditsService.GetCreditsBalanceAsync(userId);

            var email = profile.Email;
            if (string.IsNullOrWhiteSpace(email))
            {
                email = await TryGetCognitoEmailAsync(userId) ?? await TryGetWalletEmailAsync(userId) ?? string.Empty;
                if (!string.IsNullOrWhiteSpace(email))
                    await _profileService.SetProfileEmailIfEmptyAsync(userId, email);
            }

            return Ok(new UserDetail
            {
                UserId = profile.UserId,
                Email = email ?? string.Empty,
                Name = profile.Name,
                Status = "active",
                Plan = "free",
                City = profile.City,
                State = profile.State,
                CreatedAt = profile.CreatedAt,
                Credits = credits.Balance,
                LifetimeEarned = credits.LifetimeEarned,
                UnlimitedDiscovery = credits.UnlimitedDiscovery
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting user {UserId}", userId);
            return StatusCode(500, new { error = "Failed to get user" });
        }
    }

    /// <summary>
    /// POST /api/admin/users/{userId}/ban
    /// Ban a user
    /// </summary>
    [HttpPost("{userId}/ban")]
    public async Task<ActionResult> BanUser(string userId, [FromBody] BanUserRequest request)
    {
        try
        {
            var admin = GetAdminIdentity();
            
            // TODO: Implement user ban logic
            // 1. Get user from DynamoDB
            // 2. Update user status to banned
            // 3. Log audit action
            
            await _auditLogService.LogActionAsync(
                admin,
                "user.ban",
                "user",
                userId,
                after: new { status = "banned", reason = request.Reason });

            return Ok(new { message = "User banned successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error banning user {UserId}", userId);
            return StatusCode(500, new { error = "Failed to ban user" });
        }
    }

    /// <summary>
    /// POST /api/admin/users/{userId}/unban
    /// Unban a user
    /// </summary>
    [HttpPost("{userId}/unban")]
    public async Task<ActionResult> UnbanUser(string userId, [FromBody] UnbanUserRequest request)
    {
        try
        {
            var admin = GetAdminIdentity();
            
            // TODO: Implement user unban logic
            
            await _auditLogService.LogActionAsync(
                admin,
                "user.unban",
                "user",
                userId,
                after: new { status = "active", reason = request.Reason });

            return Ok(new { message = "User unbanned successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error unbanning user {UserId}", userId);
            return StatusCode(500, new { error = "Failed to unban user" });
        }
    }

    /// <summary>
    /// POST /api/admin/users/seed-dummy
    /// Create dummy test users for development/testing
    /// </summary>
    [HttpPost("seed-dummy")]
    public async Task<ActionResult<SeedDummyUsersResponse>> SeedDummyUsers()
    {
        try
        {
            var admin = GetAdminIdentity();
            
            var dummyUsers = new[]
            {
                new { UserId = "dummy-user-1", Name = "Sarah Runner", City = "San Francisco", Bio = "Marathon runner looking for training partners. Love long runs on weekends!", SportTags = new[] { "Running", "Yoga", "Hiking" }, Level = "intermediate", Goals = new[] { "Complete a sub-4 hour marathon" }, AvailabilitySchedule = new[] { new AvailabilitySlot { Days = new List<string> { "Mon", "Wed", "Fri" }, TimeStart = "18:00", TimeEnd = "20:00" } }, Mode = "TRAIN" },
                new { UserId = "dummy-user-2", Name = "Mike Cyclist", City = "San Francisco", Bio = "Cycling enthusiast. Looking for weekend ride buddies.", SportTags = new[] { "Cycling", "Gym", "CrossFit" }, Level = "advanced", Goals = new[] { "Complete a century ride" }, AvailabilitySchedule = new[] { new AvailabilitySlot { Days = new List<string> { "Sat", "Sun" }, TimeStart = "08:00", TimeEnd = "12:00" } }, Mode = "VIBE" },
                new { UserId = "dummy-user-3", Name = "Emma Yoga", City = "San Francisco", Bio = "Yoga instructor and fitness enthusiast. Love morning yoga sessions!", SportTags = new[] { "Yoga", "Pilates", "Meditation" }, Level = "pro", Goals = new[] { "Build a yoga community" }, AvailabilitySchedule = new[] { new AvailabilitySlot { Days = new List<string> { "Mon", "Wed", "Fri" }, TimeStart = "06:00", TimeEnd = "08:00" } }, Mode = "VIBE" },
                new { UserId = "dummy-user-4", Name = "Alex Hyrox", City = "San Francisco", Bio = "Hyrox competitor training for next race. Need training partners!", SportTags = new[] { "Hyrox", "CrossFit", "Running", "Gym" }, Level = "advanced", Goals = new[] { "Qualify for Hyrox World Championships" }, AvailabilitySchedule = new[] { new AvailabilitySlot { Days = new List<string> { "Tue", "Thu", "Sat" }, TimeStart = "17:00", TimeEnd = "20:00" } }, Mode = "TRAIN" },
                new { UserId = "dummy-user-5", Name = "Jordan Pickleball", City = "San Francisco", Bio = "Pickleball player looking for doubles partners. Play 3x a week!", SportTags = new[] { "Pickleball", "Tennis", "Volleyball" }, Level = "intermediate", Goals = new[] { "Improve tournament ranking" }, AvailabilitySchedule = new[] { new AvailabilitySlot { Days = new List<string> { "Mon", "Wed", "Fri" }, TimeStart = "19:00", TimeEnd = "21:00" } }, Mode = "VIBE" },
                new { UserId = "dummy-user-6", Name = "Chris Fisher", City = "San Francisco", Bio = "Fishing enthusiast. Love early morning fishing trips!", SportTags = new[] { "Fishing", "Hiking", "Kayaking" }, Level = "beginner", Goals = new[] { "Learn new fishing techniques" }, AvailabilitySchedule = new[] { new AvailabilitySlot { Days = new List<string> { "Sat", "Sun" }, TimeStart = "06:00", TimeEnd = "10:00" } }, Mode = "VIBE" },
                new { UserId = "dummy-user-7", Name = "Maria Soccer", City = "San Francisco", Bio = "Soccer player looking for pickup games and training partners.", SportTags = new[] { "Soccer", "Running", "Gym" }, Level = "intermediate", Goals = new[] { "Join a competitive league" }, AvailabilitySchedule = new[] { new AvailabilitySlot { Days = new List<string> { "Tue", "Thu" }, TimeStart = "18:00", TimeEnd = "20:00" } }, Mode = "TRAIN" },
                new { UserId = "dummy-user-8", Name = "David Swimmer", City = "San Francisco", Bio = "Competitive swimmer. Training for triathlons.", SportTags = new[] { "Swimming", "Cycling", "Running", "Triathlon" }, Level = "advanced", Goals = new[] { "Complete an Ironman" }, AvailabilitySchedule = new[] { new AvailabilitySlot { Days = new List<string> { "Mon", "Wed", "Fri", "Sun" }, TimeStart = "05:00", TimeEnd = "07:00" } }, Mode = "TRAIN" },
            };

            var created = new List<string>();
            var failed = new List<string>();

            foreach (var user in dummyUsers)
            {
                try
                {
                    var profile = new UserProfile
                    {
                        UserId = user.UserId,
                        Email = $"{user.UserId}@test.com",
                        Name = user.Name,
                        City = user.City,
                        Bio = user.Bio,
                        SportTags = user.SportTags.ToList(),
                        Level = user.Level,
                        Goals = user.Goals.ToList(),
                        AvailabilitySchedule = user.AvailabilitySchedule.ToList(),
                        Mode = user.Mode,
                        IsComplete = true,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow,
                    };

                    await _profileService.CreateProfileAsync(profile);
                    created.Add(user.Name);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error creating dummy user {UserId}", user.UserId);
                    failed.Add(user.Name);
                }
            }

            await _auditLogService.LogActionAsync(
                admin,
                "users.seed_dummy",
                "system",
                "seed",
                after: new { created = created.Count, failed = failed.Count });

            return Ok(new SeedDummyUsersResponse
            {
                Created = created,
                Failed = failed,
                Message = $"Created {created.Count} dummy users, {failed.Count} failed"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error seeding dummy users");
            return StatusCode(500, new { error = "Failed to seed dummy users", message = ex.Message });
        }
    }
}

// Request/Response models
public class PagedResponse<T>
{
    public List<T> Items { get; set; } = new();
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalCount { get; set; }
    public int TotalPages { get; set; }
}

public class UserListItem
{
    public string UserId { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string? Plan { get; set; }
    public string? City { get; set; }
    public string? State { get; set; }
    public DateTime CreatedAt { get; set; }
    public int? Credits { get; set; }
}

public class UserDetail
{
    public string UserId { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string? Plan { get; set; }
    public string? City { get; set; }
    public string? State { get; set; }
    public DateTime CreatedAt { get; set; }
    public int Credits { get; set; }
    public int LifetimeEarned { get; set; }
    public bool UnlimitedDiscovery { get; set; }
}

public class BanUserRequest
{
    public string? Reason { get; set; }
}

public class UnbanUserRequest
{
    public string? Reason { get; set; }
}

public class SeedDummyUsersResponse
{
    public List<string> Created { get; set; } = new();
    public List<string> Failed { get; set; } = new();
    public string Message { get; set; } = string.Empty;
}
