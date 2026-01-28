using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using GetTrainMate.Api.Models;
using GetTrainMate.Api.Services;
using Amazon.DynamoDBv2.DataModel;
using System.Security.Claims;
using Microsoft.Extensions.DependencyInjection;

namespace GetTrainMate.Api.Controllers;

[ApiController]
[Route("api/admin/users")]
[Authorize]
public class AdminUsersController : ControllerBase
{
    private readonly IDynamoDBContext _context;
    private readonly IAuditLogService _auditLogService;
    private readonly IProfileService _profileService;
    private readonly ILogger<AdminUsersController> _logger;

    public AdminUsersController(
        IDynamoDBContext context,
        IAuditLogService auditLogService,
        IProfileService profileService,
        ILogger<AdminUsersController> logger)
    {
        _context = context;
        _auditLogService = auditLogService;
        _profileService = profileService;
        _logger = logger;
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
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        try
        {
            // TODO: Implement user listing with DynamoDB query/scan
            // For now, return placeholder
            return Ok(new PagedResponse<UserListItem>
            {
                Items = new List<UserListItem>(),
                Page = page,
                PageSize = pageSize,
                TotalCount = 0,
                TotalPages = 0
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error listing users");
            return StatusCode(500, new { error = "Failed to list users" });
        }
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
            // TODO: Implement user detail retrieval
            return NotFound(new { error = "User not found" });
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
                new { UserId = "dummy-user-1", Name = "Sarah Runner", City = "San Francisco", Bio = "Marathon runner looking for training partners. Love long runs on weekends!", SportTags = new[] { "Running", "Yoga", "Hiking" }, Level = "intermediate", Goals = "Complete a sub-4 hour marathon", Mode = "TRAIN" },
                new { UserId = "dummy-user-2", Name = "Mike Cyclist", City = "San Francisco", Bio = "Cycling enthusiast. Looking for weekend ride buddies.", SportTags = new[] { "Cycling", "Gym", "CrossFit" }, Level = "advanced", Goals = "Complete a century ride", Mode = "VIBE" },
                new { UserId = "dummy-user-3", Name = "Emma Yoga", City = "San Francisco", Bio = "Yoga instructor and fitness enthusiast. Love morning yoga sessions!", SportTags = new[] { "Yoga", "Pilates", "Meditation" }, Level = "pro", Goals = "Build a yoga community", Mode = "VIBE" },
                new { UserId = "dummy-user-4", Name = "Alex Hyrox", City = "San Francisco", Bio = "Hyrox competitor training for next race. Need training partners!", SportTags = new[] { "Hyrox", "CrossFit", "Running", "Gym" }, Level = "advanced", Goals = "Qualify for Hyrox World Championships", Mode = "TRAIN" },
                new { UserId = "dummy-user-5", Name = "Jordan Pickleball", City = "San Francisco", Bio = "Pickleball player looking for doubles partners. Play 3x a week!", SportTags = new[] { "Pickleball", "Tennis", "Volleyball" }, Level = "intermediate", Goals = "Improve tournament ranking", Mode = "VIBE" },
                new { UserId = "dummy-user-6", Name = "Chris Fisher", City = "San Francisco", Bio = "Fishing enthusiast. Love early morning fishing trips!", SportTags = new[] { "Fishing", "Hiking", "Kayaking" }, Level = "beginner", Goals = "Learn new fishing techniques", Mode = "VIBE" },
                new { UserId = "dummy-user-7", Name = "Maria Soccer", City = "San Francisco", Bio = "Soccer player looking for pickup games and training partners.", SportTags = new[] { "Soccer", "Running", "Gym" }, Level = "intermediate", Goals = "Join a competitive league", Mode = "TRAIN" },
                new { UserId = "dummy-user-8", Name = "David Swimmer", City = "San Francisco", Bio = "Competitive swimmer. Training for triathlons.", SportTags = new[] { "Swimming", "Cycling", "Running", "Triathlon" }, Level = "advanced", Goals = "Complete an Ironman", Mode = "TRAIN" },
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
                        Goals = user.Goals,
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
    public DateTime CreatedAt { get; set; }
}

public class UserDetail
{
    public string UserId { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string? Plan { get; set; }
    public DateTime CreatedAt { get; set; }
    // Add more fields as needed
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
