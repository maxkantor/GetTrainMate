using GetTrainMate.Api.Models;
using GetTrainMate.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GetTrainMate.Api.Controllers;

/// <summary>Anonymous landing match preview — real DB matches or labeled demo; never exposes distance/location.</summary>
[ApiController]
[Route("api/public")]
public class PublicMatchPreviewController : ControllerBase
{
    private readonly ILandingMatchPreviewService _preview;
    private readonly ILogger<PublicMatchPreviewController> _logger;

    public PublicMatchPreviewController(
        ILandingMatchPreviewService preview,
        ILogger<PublicMatchPreviewController> logger)
    {
        _preview = preview;
        _logger = logger;
    }

    [HttpPost("match-preview")]
    [AllowAnonymous]
    public async Task<ActionResult<LandingMatchPreviewResponse>> MatchPreview(
        [FromBody] LandingMatchPreviewRequest? body,
        CancellationToken cancellationToken)
    {
        if (body == null)
            return BadRequest(new { error = "Body required." });

        if (string.IsNullOrWhiteSpace(body.SportTag) || string.IsNullOrWhiteSpace(body.Level) || string.IsNullOrWhiteSpace(body.TimePref))
            return BadRequest(new { error = "sportTag, level, and timePref are required." });

        try
        {
            var result = await _preview.GetPreviewAsync(body, cancellationToken).ConfigureAwait(false);
            return Ok(result);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "match-preview failed");
            return StatusCode(503, new { error = "Preview temporarily unavailable." });
        }
    }

    [HttpGet("landing-showcase")]
    [AllowAnonymous]
    public async Task<ActionResult<LandingShowcaseResponse>> LandingShowcase(CancellationToken cancellationToken)
    {
        try
        {
            var result = await _preview.GetShowcaseAsync(cancellationToken).ConfigureAwait(false);
            _logger.LogInformation(
                "landing-showcase response kind={Kind} deck={DeckLen} activity={ActLen}",
                result.Kind,
                result.Deck?.Count ?? 0,
                result.Activity?.Count ?? 0);
            if (result.Deck is { Count: > 0 })
            {
                foreach (var c in result.Deck.Take(4))
                {
                    var u = (c.PhotoUrl ?? string.Empty).Trim();
                    _logger.LogDebug(
                        "landing-showcase deck card name={Name} hasPhotoUrl={Has} looksPresigned={Sig}",
                        c.Name,
                        u.Length > 0,
                        u.Contains("X-Amz-Algorithm", StringComparison.OrdinalIgnoreCase)
                        || u.Contains("AWSAccessKeyId", StringComparison.OrdinalIgnoreCase));
                }
            }

            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "landing-showcase failed");
            return StatusCode(503, new { error = "Showcase temporarily unavailable." });
        }
    }
}
