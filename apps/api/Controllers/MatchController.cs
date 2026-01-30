using Microsoft.AspNetCore.Mvc;
using GetTrainMate.Api.Models;
using GetTrainMate.Api.Services;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace GetTrainMate.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class MatchController : ControllerBase
{
    private readonly IMatchService _matchService;
    private readonly ILogger<MatchController> _logger;

    public MatchController(
        IMatchService matchService,
        ILogger<MatchController> logger)
    {
        _matchService = matchService;
        _logger = logger;
    }

    [HttpGet("discover")]
    public async Task<ActionResult<List<MatchFeedItem>>> GetDiscoveryFeed([FromQuery] int limit = 20)
    {
        try
        {
            var userId = GetUserIdFromToken();
            if (string.IsNullOrEmpty(userId))
                return Unauthorized(new { message = "Invalid token" });

            var feed = await _matchService.GetDiscoveryFeedAsync(userId, limit);
            return Ok(feed);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting discovery feed");
            return StatusCode(500, new { message = "Error retrieving discovery feed" });
        }
    }

    [HttpPost("like")]
    public async Task<ActionResult<MatchResponse>> LikeUser([FromBody] LikeRequest request)
    {
        try
        {
            var userId = GetUserIdFromToken();
            if (string.IsNullOrEmpty(userId))
                return Unauthorized(new { message = "Invalid token" });

            if (string.IsNullOrEmpty(request.TargetUserId))
                return BadRequest(new { message = "TargetUserId is required" });

            var result = await _matchService.LikeUserAsync(userId, request.TargetUserId);
            return Ok(result);
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
