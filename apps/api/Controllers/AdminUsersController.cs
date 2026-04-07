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
        var extraRaw = ResolveExtraUserPoolIdsRaw(configuration);
        var amplifyPool = NormalizeUserPoolId(Environment.GetEnvironmentVariable("AMPLIFY_USER_POOL_ID"));
        if (!string.IsNullOrEmpty(amplifyPool))
            extraRaw = string.IsNullOrEmpty(extraRaw) ? amplifyPool : $"{extraRaw},{amplifyPool}";
        _cognitoUserPoolIds = string.Join(',', primary, extraRaw)
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(s => !string.IsNullOrWhiteSpace(s))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();
        _logger = logger;
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

    private static string? EmailFromCognitoAttributes(List<AttributeType> attrs)
    {
        var email = attrs.FirstOrDefault(a => a.Name == "email")?.Value;
        if (!string.IsNullOrEmpty(email))
            return email;
        var pref = attrs.FirstOrDefault(a => a.Name == "preferred_username")?.Value;
        if (!string.IsNullOrEmpty(pref) && pref.Contains('@', StringComparison.Ordinal))
            return pref;
        return pref;
    }

    private async Task<string?> TryGetCognitoEmailAsync(string userId)
    {
        if (userId.StartsWith("dummy-user-", StringComparison.OrdinalIgnoreCase))
            return null;
        if (_cognitoUserPoolIds.Length == 0)
        {
            _logger.LogWarning("Cognito user pool id not configured; cannot resolve emails from Cognito.");
            return null;
        }

        foreach (var poolId in _cognitoUserPoolIds)
        {
            var em = await TryGetCognitoEmailInPoolAsync(userId, poolId);
            if (!string.IsNullOrEmpty(em))
                return em;
        }

        return null;
    }

    /// <summary>
    /// AdminGetUser(Username=sub) works when Cognito username equals sub; otherwise ListUsers(sub=...) is required.
    /// Lambda must have cognito-idp:ListUsers on the pool (email-alias sign-in uses non-sub Username).
    /// </summary>
    private async Task<string?> TryGetCognitoEmailInPoolAsync(string userId, string poolId)
    {
        try
        {
            var resp = await _cognito.AdminGetUserAsync(new AdminGetUserRequest
            {
                UserPoolId = poolId,
                Username = userId
            });
            return EmailFromCognitoAttributes(resp.UserAttributes);
        }
        catch (UserNotFoundException)
        {
            // Username is often the email while sub is the stable id — find user by sub.
            try
            {
                var list = await _cognito.ListUsersAsync(new ListUsersRequest
                {
                    UserPoolId = poolId,
                    Filter = $"sub = \"{userId}\"",
                    Limit = 2
                });
                var u = list.Users.FirstOrDefault();
                if (u?.Attributes != null)
                    return EmailFromCognitoAttributes(u.Attributes);
            }
            catch (AmazonCognitoIdentityProviderException ex) when (ex.ErrorCode == "AccessDeniedException" || ex.ErrorCode == "NotAuthorizedException")
            {
                _logger.LogWarning(ex, "Cognito ListUsers denied for pool {PoolId}. Grant cognito-idp:ListUsers on this pool to the API Lambda role.", poolId);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "ListUsers by sub failed for {UserId} pool {PoolId}", userId, poolId);
            }

            return null;
        }
        catch (AmazonCognitoIdentityProviderException ex) when (ex.ErrorCode == "AccessDeniedException" || ex.ErrorCode == "NotAuthorizedException")
        {
            _logger.LogWarning(ex, "Cognito AdminGetUser denied for pool {PoolId}. Check Lambda IAM.", poolId);
            return null;
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Could not resolve email from Cognito for user {UserId} pool {PoolId}", userId, poolId);
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
            var email = wallets
                .Select(w => (w.Email ?? string.Empty).Trim())
                .FirstOrDefault(e => !string.IsNullOrWhiteSpace(e));
            return string.IsNullOrWhiteSpace(email) ? null : email;
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Could not resolve wallet email for user {UserId}", userId);
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
        var tasks = slice.Select(async u =>
        {
            // Email: prefer persisted profile email; fallback to Cognito when available.
            if (includeCognitoEmailLookup && string.IsNullOrWhiteSpace(u.Email) && !IsTestUserRow(u))
            {
                var em = await TryGetCognitoEmailAsync(u.UserId) ?? await TryGetWalletEmailAsync(u.UserId);
                if (!string.IsNullOrEmpty(em))
                {
                    u.Email = em;
                    await _profileService.SetProfileEmailIfEmptyAsync(u.UserId, em);
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
