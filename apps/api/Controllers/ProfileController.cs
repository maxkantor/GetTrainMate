using Microsoft.AspNetCore.Mvc;
using GetTrainMate.Api.Models;
using GetTrainMate.Api.Services;
using GetTrainMate.Api.Validation;
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
    public async Task<ActionResult<UserProfile>> UpdateMyProfile([FromBody] UpdateProfileRequest? request)
    {
        var requestId = System.Diagnostics.Activity.Current?.Id ?? Guid.NewGuid().ToString("N")[..12];
        _logger.LogInformation("UpdateMyProfile requestId={RequestId}", requestId);

        if (request == null)
        {
            _logger.LogWarning("UpdateMyProfile requestId={RequestId}: body is null", requestId);
            return BadRequest(new { message = "Request body is required", requestId, errors = new { _ = new[] { "Body must be valid JSON" } } });
        }

        try
        {
            var userId = GetUserIdFromToken();
            if (string.IsNullOrEmpty(userId))
            {
                _logger.LogWarning("UpdateMyProfile requestId={RequestId}: no userId in token", requestId);
                return Unauthorized(new { message = "Authentication required. Please login again.", requestId });
            }

            // Server-side validation: return 400 with field errors (never 500)
            var validationErrors = ProfileRequestValidator.Validate(request);
            if (validationErrors.Count > 0)
            {
                _logger.LogWarning("UpdateMyProfile requestId={RequestId} userId={UserId}: validation failed: {Errors}", requestId, userId, string.Join("; ", validationErrors.Select(e => e.Key + ": " + string.Join(", ", e.Value))));
                return BadRequest(new { message = "Validation failed", requestId, errors = validationErrors });
            }

            _logger.LogDebug("UpdateMyProfile requestId={RequestId} userId={UserId} updating profile", requestId, userId);

            var profile = await _profileService.UpdateProfileAsync(userId, request);

            if (string.IsNullOrEmpty(profile.Email))
                profile.Email = GetEmailFromToken() ?? "";

            _logger.LogInformation("UpdateMyProfile requestId={RequestId} userId={UserId} success IsComplete={IsComplete}", requestId, userId, profile.IsComplete);
            return Ok(profile);
        }
        catch (Amazon.DynamoDBv2.AmazonDynamoDBException dbEx)
        {
            _logger.LogError(dbEx, "UpdateMyProfile requestId={RequestId}: DynamoDB error", requestId);
            return StatusCode(500, new { message = "Error saving profile. Please try again.", requestId });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "UpdateMyProfile requestId={RequestId}: unexpected error", requestId);
            return StatusCode(500, new { message = "Error updating profile", requestId });
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

            // Use PhotoUrls; if empty but user has photoKey, add public URL so the correct photo is shown (not a placeholder)
            var photoUrls = profile.PhotoUrls?.ToList() ?? new List<string>();
            if (photoUrls.Count == 0 && !string.IsNullOrEmpty(profile.PhotoKey))
                photoUrls.Add(_storageService.GetPublicUrl(profile.PhotoKey));

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
                PhotoUrls = photoUrls,
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
        // Try authenticated user claims first
        var email = User.FindFirst(ClaimTypes.Email)?.Value 
            ?? User.FindFirst("email")?.Value;
        
        // If not found, try manual JWT parsing
        if (string.IsNullOrEmpty(email))
        {
            var authHeader = Request.Headers["Authorization"].FirstOrDefault();
            if (!string.IsNullOrEmpty(authHeader) && authHeader.StartsWith("Bearer "))
            {
                var token = authHeader.Substring("Bearer ".Length).Trim();
                try
                {
                    var handler = new JwtSecurityTokenHandler();
                    var jsonToken = handler.ReadJwtToken(token);
                    email = jsonToken.Claims.FirstOrDefault(c => c.Type == "email" || c.Type == ClaimTypes.Email)?.Value;
                }
                catch (Exception ex)
                {
                    _logger.LogDebug(ex, "Failed to extract email from JWT token");
                }
            }
        }
        
        return email;
    }

    private string? GetNameFromToken()
    {
        // Try authenticated user claims first
        var name = User.FindFirst(ClaimTypes.Name)?.Value 
            ?? User.FindFirst("name")?.Value
            ?? User.FindFirst("given_name")?.Value;
        
        // If not found, try manual JWT parsing
        if (string.IsNullOrEmpty(name))
        {
            var authHeader = Request.Headers["Authorization"].FirstOrDefault();
            if (!string.IsNullOrEmpty(authHeader) && authHeader.StartsWith("Bearer "))
            {
                var token = authHeader.Substring("Bearer ".Length).Trim();
                try
                {
                    var handler = new JwtSecurityTokenHandler();
                    var jsonToken = handler.ReadJwtToken(token);
                    name = jsonToken.Claims.FirstOrDefault(c => c.Type == "name" || c.Type == "given_name" || c.Type == ClaimTypes.Name)?.Value;
                }
                catch (Exception ex)
                {
                    _logger.LogDebug(ex, "Failed to extract name from JWT token");
                }
            }
        }
        
        return name;
    }
}
