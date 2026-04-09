using Microsoft.AspNetCore.Mvc;
using GetTrainMate.Api.Models;
using GetTrainMate.Api.Services;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Linq;

namespace GetTrainMate.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class MatchController : ControllerBase
{
    private readonly IMatchService _matchService;
    private readonly IChatService _chatService;
    private readonly IProfileService _profileService;
    private readonly ICreditsService _creditsService;
    private readonly ILogger<MatchController> _logger;

    public MatchController(
        IMatchService matchService,
        IChatService chatService,
        IProfileService profileService,
        ICreditsService creditsService,
        ILogger<MatchController> logger)
    {
        _matchService = matchService;
        _chatService = chatService;
        _profileService = profileService;
        _creditsService = creditsService;
        _logger = logger;
    }

    [HttpPost("seed-demo")]
    public async Task<ActionResult<object>> SeedDemoProfiles()
    {
        try
        {
            var userId = GetUserIdFromToken();
            if (string.IsNullOrEmpty(userId))
                return Unauthorized(new { message = "Invalid token" });
            var created = await _matchService.SeedDemoProfilesAsync();
            return Ok(new { message = $"Added {created} demo profiles. Refresh to discover!", created });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error seeding demo profiles");
            return StatusCode(500, new { message = "Error seeding demo profiles" });
        }
    }

    [HttpGet("compatibility/{targetUserId}")]
    public async Task<ActionResult<CompatibilityInfo>> GetCompatibility(string targetUserId)
    {
        try
        {
            var userId = GetUserIdFromToken();
            if (string.IsNullOrEmpty(userId))
                return Unauthorized(new { message = "Invalid token" });

            var info = await _matchService.GetCompatibilityAsync(userId, targetUserId);
            if (info == null)
                return NotFound(new { message = "Profile not found" });
            return Ok(info);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting compatibility");
            return StatusCode(500, new { message = "Error retrieving compatibility" });
        }
    }

    [HttpGet("sent-requests")]
    public async Task<ActionResult<List<SentRequestItem>>> GetSentRequests()
    {
        try
        {
            var userId = GetUserIdFromToken();
            if (string.IsNullOrEmpty(userId))
                return Unauthorized(new { message = "Invalid token" });

            var profile = await _profileService.GetProfileAsync(userId);
            if (profile != null && !profile.DiscoverCanReviewLikedProfiles)
                return StatusCode(403, new { code = "FEATURE_DISABLED", message = "Sent requests are not enabled for this account." });

            var list = await _matchService.ListSentRequestsAsync(userId);
            return Ok(list);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error listing sent requests");
            return StatusCode(500, new { message = "Error listing sent requests" });
        }
    }

    /// <summary>People who liked you (pending one-way). Requires reveal-likes entitlement; otherwise returns locked payload.</summary>
    [HttpGet("incoming-likes")]
    public async Task<ActionResult<IncomingLikesResponse>> GetIncomingLikes()
    {
        try
        {
            var userId = GetUserIdFromToken();
            if (string.IsNullOrEmpty(userId))
                return Unauthorized(new { message = "Invalid token" });

            var profile = await _profileService.GetProfileAsync(userId);
            if (profile != null && !profile.DiscoverCanReviewLikedProfiles)
                return StatusCode(403, new { code = "FEATURE_DISABLED", message = "This list is not enabled for this account." });

            var credits = await _creditsService.GetCreditsBalanceAsync(userId);
            if (!credits.RevealLikesUnlocked)
            {
                return Ok(new IncomingLikesResponse
                {
                    Unlocked = false,
                    RequiredCredits = CreditRules.RevealLikes,
                    Items = new List<SentRequestItem>()
                });
            }

            var items = await _matchService.ListIncomingPendingLikesAsync(userId);
            return Ok(new IncomingLikesResponse
            {
                Unlocked = true,
                Items = items
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error listing incoming likes");
            return StatusCode(500, new { message = "Error listing incoming likes" });
        }
    }

    [HttpGet("skipped-profiles")]
    public async Task<ActionResult<List<SkippedProfileItem>>> GetSkippedProfiles()
    {
        try
        {
            var userId = GetUserIdFromToken();
            if (string.IsNullOrEmpty(userId))
                return Unauthorized(new { message = "Invalid token" });

            var profile = await _profileService.GetProfileAsync(userId);
            if (profile != null && !profile.DiscoverCanReviewSkippedProfiles)
                return StatusCode(403, new { code = "FEATURE_DISABLED", message = "Skipped profiles review is not enabled for this account." });

            var list = await _matchService.ListSkippedProfilesAsync(userId);
            return Ok(list);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error listing skipped profiles");
            return StatusCode(500, new { message = "Error listing skipped profiles" });
        }
    }

    [HttpGet("discover")]
    public async Task<ActionResult<List<MatchFeedItem>>> GetDiscoveryFeed([FromQuery] int limit = 20)
    {
        try
        {
            var userId = GetUserIdFromToken();
            if (string.IsNullOrEmpty(userId))
                return Unauthorized(new { message = "Invalid token" });

            var controls = await _matchService.GetAdminDiscoverControlsAsync();
            var isAdmin = User.Claims.Any(c =>
                c.Type == "cognito:groups" &&
                c.Value.Contains("Admin", StringComparison.OrdinalIgnoreCase));
            var feed = await _matchService.GetDiscoveryFeedAsync(
                userId,
                limit,
                isAdmin && controls.IgnoreSkippedProfilesInDiscoverForAdmin
            );
            return Ok(feed);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting discovery feed");
            return StatusCode(500, new { message = "Error retrieving discovery feed" });
        }
    }

    [HttpPost("undo-pass")]
    public async Task<ActionResult<object>> UndoPass([FromBody] PassRequest request)
    {
        try
        {
            var userId = GetUserIdFromToken();
            if (string.IsNullOrEmpty(userId))
                return Unauthorized(new { message = "Invalid token" });

            if (string.IsNullOrEmpty(request.TargetUserId))
                return BadRequest(new { message = "TargetUserId is required" });

            var restored = await _matchService.UndoPassAsync(userId, request.TargetUserId);
            return Ok(new { restored });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error undoing pass");
            return StatusCode(500, new { message = "Error undoing pass" });
        }
    }

    [HttpGet("last-skipped")]
    public async Task<ActionResult<DiscoverSkipRecord?>> GetLastSkipped()
    {
        try
        {
            var userId = GetUserIdFromToken();
            if (string.IsNullOrEmpty(userId))
                return Unauthorized(new { message = "Invalid token" });
            var record = await _matchService.GetLastSkippedProfileAsync(userId);
            return Ok(record);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting last skipped profile");
            return StatusCode(500, new { message = "Error retrieving last skipped profile" });
        }
    }

    [HttpPost("like")]
    public async Task<ActionResult<MatchResponse>> LikeUser([FromBody] LikeRequest request)
    {
        try
        {
            var userId = GetUserIdFromToken();
            if (string.IsNullOrEmpty(userId))
                return Unauthorized(new { code = "NOT_AUTHENTICATED", message = "Invalid token" });

            if (string.IsNullOrEmpty(request.TargetUserId))
                return BadRequest(new { code = "VALIDATION_ERROR", message = "TargetUserId is required" });

            var result = await _matchService.LikeUserAsync(userId, request.TargetUserId);
            if (result.IsMatched && !string.IsNullOrEmpty(result.MatchId))
            {
                var match = await _matchService.GetMatchByIdAsync(result.MatchId);
                if (match != null)
                    await _chatService.GetOrCreateThreadForMatchAsync(result.MatchId, match.UserId1, match.UserId2);
            }
            return Ok(result);
        }
        catch (InsufficientCreditsException ex)
        {
            return StatusCode(402, new { code = InsufficientCreditsException.ErrorCode, message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error liking user");
            return StatusCode(500, new { message = "Error processing like" });
        }
    }

    [HttpPost("pass")]
    public async Task<ActionResult<MatchResponse>> PassUser([FromBody] PassRequest request)
    {
        try
        {
            var userId = GetUserIdFromToken();
            if (string.IsNullOrEmpty(userId))
                return Unauthorized(new { message = "Invalid token" });

            if (string.IsNullOrEmpty(request.TargetUserId))
                return BadRequest(new { message = "TargetUserId is required" });

            var result = await _matchService.PassUserAsync(userId, request.TargetUserId);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error passing user");
            return StatusCode(500, new { message = "Error processing pass" });
        }
    }

    /// <summary>Withdraw a pending one-way invite (interaction SENT, match not mutual).</summary>
    [HttpPost("cancel-sent-invite")]
    public async Task<ActionResult> CancelSentInvite([FromBody] CancelSentInviteRequest request)
    {
        try
        {
            var userId = GetUserIdFromToken();
            if (string.IsNullOrEmpty(userId))
                return Unauthorized(new { code = "NOT_AUTHENTICATED", message = "Invalid token" });

            if (string.IsNullOrEmpty(request.TargetUserId))
                return BadRequest(new { code = "VALIDATION_ERROR", message = "TargetUserId is required" });

            var profile = await _profileService.GetProfileAsync(userId);
            if (profile != null && !profile.DiscoverCanReviewLikedProfiles)
                return StatusCode(403, new { code = "FEATURE_DISABLED", message = "Sent requests are not enabled for this account." });

            await _matchService.CancelSentInviteAsync(userId, request.TargetUserId);
            return Ok(new { success = true });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { code = "CANCEL_NOT_ALLOWED", message = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { code = "VALIDATION_ERROR", message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error cancelling sent invite");
            return StatusCode(500, new { message = "Error cancelling invite" });
        }
    }

    [HttpGet("my-matches")]
    public async Task<ActionResult<List<Match>>> GetMyMatches()
    {
        try
        {
            var userId = GetUserIdFromToken();
            if (string.IsNullOrEmpty(userId))
                return Unauthorized(new { message = "Invalid token" });

            var matches = await _matchService.GetUserMatchesAsync(userId);
            return Ok(matches);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting user matches");
            return StatusCode(500, new { message = "Error retrieving matches" });
        }
    }

    private string? GetUserIdFromToken()
    {
        // Prefer claims set by JWT middleware
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? User.FindFirst("sub")?.Value;

        // Fallback: parse Authorization header when middleware didn't validate (e.g. expired token still has valid sub)
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
                        _logger.LogDebug("MatchController: extracted userId from JWT manually: {UserId}", userId);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "MatchController: failed to parse JWT manually");
                }
            }
        }

        return userId;
    }
}
