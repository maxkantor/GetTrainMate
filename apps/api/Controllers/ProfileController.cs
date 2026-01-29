using Microsoft.AspNetCore.Mvc;
using GetTrainMate.Api.Models;
using GetTrainMate.Api.Services;
using System.Security.Claims;
using System.IdentityModel.Tokens.Jwt;

namespace GetTrainMate.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ProfileController : ControllerBase
{
    private readonly IProfileService _profileService;
    private readonly IStorageService _storageService;
    private readonly ILogger<ProfileController> _logger;

    public ProfileController(
        IProfileService profileService,
        IStorageService storageService,
        ILogger<ProfileController> logger)
    {
        _profileService = profileService;
        _storageService = storageService;
        _logger = logger;
    }

    [HttpGet("me")]
    public async Task<ActionResult<UserProfile>> GetMyProfile()
    {
        try
        {
            var userId = GetUserIdFromToken();
            if (string.IsNullOrEmpty(userId))
            {
                _logger.LogWarning("GetMyProfile: No userId found in token");
                return Unauthorized(new { message = "Authentication required. Please login again." });
            }

            _logger.LogDebug("GetMyProfile: Fetching profile for userId {UserId}", userId);
            
            UserProfile? profile = null;
            try
            {
                profile = await _profileService.GetProfileAsync(userId);
            }
            catch (Exception profileEx)
            {
                _logger.LogError(profileEx, "Error fetching profile from DynamoDB for user {UserId}", userId);
                // Continue to return empty profile instead of failing
            }
            
            if (profile == null)
            {
                _logger.LogDebug("GetMyProfile: No profile found, returning empty profile structure for userId {UserId}", userId);
                // Return empty profile structure if doesn't exist
                return Ok(new UserProfile
                {
                    UserId = userId,
                    Email = GetEmailFromToken() ?? "",
                    Name = GetNameFromToken() ?? "",
                    IsComplete = false,
                    SportTags = new List<string>(),
                    Goals = new List<string>(),
                    AvailabilitySchedule = new List<AvailabilitySlot>(),
                    PhotoUrls = new List<string>()
                });
            }

            _logger.LogDebug("GetMyProfile: Returning profile for userId {UserId}, IsComplete: {IsComplete}", userId, profile.IsComplete);
            return Ok(profile);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting user profile: {Error}", ex.Message);
            return StatusCode(500, new { message = "Error retrieving profile", error = ex.Message });
        }
    }

    public class UploadPhotoRequest
    {
        public string? ContentType { get; set; }
    }

    [HttpPost("me/photos/upload-url")]
    public ActionResult GetPhotoUploadUrl([FromBody] UploadPhotoRequest request)
    {
        try
        {
            var userId = GetUserIdFromToken();
            if (string.IsNullOrEmpty(userId))
                return Unauthorized(new { message = "Invalid token" });

            var contentType = string.IsNullOrWhiteSpace(request.ContentType) ? "application/octet-stream" : request.ContentType!;
            var extension = contentType switch
            {
                "image/jpeg" => ".jpg",
                "image/png" => ".png",
                "image/webp" => ".webp",
                _ => ""
            };

            var key = $"profiles/{userId}/{Guid.NewGuid()}{extension}";
            var uploadUrl = _storageService.GetPresignedUploadUrl(key, contentType, TimeSpan.FromMinutes(10));
            var publicUrl = _storageService.GetPublicUrl(key);
            return Ok(new { key, uploadUrl, publicUrl });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating upload URL");
            return StatusCode(500, new { message = "Error generating upload URL" });
        }
    }

    public class GetPhotoUrlRequest
    {
        public string Key { get; set; } = string.Empty;
    }

    [HttpPost("me/photos/url")]
    public ActionResult GetPhotoUrl([FromBody] GetPhotoUrlRequest request)
    {
        try
        {
            var userId = GetUserIdFromToken();
            if (string.IsNullOrEmpty(userId))
                return Unauthorized(new { message = "Invalid token" });

            if (string.IsNullOrWhiteSpace(request.Key))
                return BadRequest(new { message = "Key is required" });

            // Verify the key belongs to this user
            if (!request.Key.StartsWith($"profiles/{userId}/"))
                return StatusCode(403, new { message = "You can only access your own photos" });

            // Generate signed URL valid for 1 hour
            var signedUrl = _storageService.GetPresignedDownloadUrl(request.Key, TimeSpan.FromHours(1));
            return Ok(new { url = signedUrl });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating photo URL");
            return StatusCode(500, new { message = "Error generating photo URL" });
        }
    }

    public class AddPhotoRequest
    {
        public string Url { get; set; } = string.Empty;
    }

    [HttpPost("me/photos")]
    public async Task<ActionResult<UserProfile>> AddPhoto([FromBody] AddPhotoRequest request)
    {
        try
        {
            var userId = GetUserIdFromToken();
            if (string.IsNullOrEmpty(userId))
                return Unauthorized(new { message = "Invalid token" });

            if (string.IsNullOrWhiteSpace(request.Url))
                return BadRequest(new { message = "Url is required" });

            var profile = await _profileService.AddPhotoUrlAsync(userId, request.Url);
            return Ok(profile);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error adding photo to profile");
            return StatusCode(500, new { message = "Error adding photo" });
        }
    }

    [HttpPut("me")]
    public async Task<ActionResult<UserProfile>> UpdateMyProfile([FromBody] UpdateProfileRequest request)
    {
        try
        {
            var userId = GetUserIdFromToken();
            if (string.IsNullOrEmpty(userId))
                return Unauthorized(new { message = "Invalid token" });

            var profile = await _profileService.UpdateProfileAsync(userId, request);
            
            // Update email from token if creating for first time
            if (string.IsNullOrEmpty(profile.Email))
            {
                profile.Email = GetEmailFromToken() ?? "";
            }

            return Ok(profile);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating user profile");
            return StatusCode(500, new { message = "Error updating profile" });
        }
    }

    [HttpGet("{userId}")]
    public async Task<ActionResult<UserProfile>> GetProfile(string userId)
    {
        try
        {
            var requestingUserId = GetUserIdFromToken();
            if (string.IsNullOrEmpty(requestingUserId))
                return Unauthorized(new { message = "Invalid token" });

            var profile = await _profileService.GetProfileAsync(userId);
            
            if (profile == null)
                return NotFound(new { message = "Profile not found" });

            // Return limited public profile info (exclude sensitive data)
            return Ok(new
            {
                profile.UserId,
                profile.Name,
                profile.City,
                profile.Bio,
                profile.SportTags,
                profile.Level,
                profile.Mode,
                profile.PhotoUrls,
                profile.IsComplete
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting profile for user {UserId}", userId);
            return StatusCode(500, new { message = "Error retrieving profile" });
        }
    }

    private string? GetUserIdFromToken()
    {
        // Try to get from authenticated user claims first
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value 
            ?? User.FindFirst("sub")?.Value;
        
        // If not found and user is authenticated, log for debugging
        if (string.IsNullOrEmpty(userId) && User.Identity?.IsAuthenticated == true)
        {
            _logger.LogWarning("User authenticated but no 'sub' or NameIdentifier claim found. Available claims: {Claims}", 
                string.Join(", ", User.Claims.Select(c => $"{c.Type}={c.Value}")));
        }
        
        // If still not found and we have a token, try to parse it manually
        if (string.IsNullOrEmpty(userId))
        {
            var authHeader = Request.Headers["Authorization"].FirstOrDefault();
            if (!string.IsNullOrEmpty(authHeader) && authHeader.StartsWith("Bearer "))
            {
                var token = authHeader.Substring("Bearer ".Length).Trim();
                try
                {
                    var handler = new System.IdentityModel.Tokens.Jwt.JwtSecurityTokenHandler();
                    var jsonToken = handler.ReadJwtToken(token);
                    userId = jsonToken.Claims.FirstOrDefault(c => c.Type == "sub" || c.Type == ClaimTypes.NameIdentifier)?.Value;
                    
                    if (!string.IsNullOrEmpty(userId))
                    {
                        _logger.LogDebug("Extracted userId from JWT token manually: {UserId}", userId);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to parse JWT token manually");
                }
            }
        }
        
        return userId;
    }

    private string? GetEmailFromToken()
    {
        return User.FindFirst(ClaimTypes.Email)?.Value 
            ?? User.FindFirst("email")?.Value;
    }

    private string? GetNameFromToken()
    {
        return User.FindFirst(ClaimTypes.Name)?.Value 
            ?? User.FindFirst("name")?.Value;
    }
}
