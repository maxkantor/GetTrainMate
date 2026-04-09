using System.Security.Claims;
using GetTrainMate.Api.Constants;
using GetTrainMate.Api.Models;
using GetTrainMate.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GetTrainMate.Api.Controllers;

/// <summary>Server-authoritative premium actions (boost, reveal) and public credit catalog for UI.</summary>
[ApiController]
[Route("api/premium")]
public class PremiumController : ControllerBase
{
    private readonly ICreditsService _credits;
    private readonly ILogger<PremiumController> _logger;

    public PremiumController(ICreditsService credits, ILogger<PremiumController> logger)
    {
        _credits = credits;
        _logger = logger;
    }

    private string? UserId => User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("sub")?.Value;

    /// <summary>Costs and labels for premium actions (display-only on client; server enforces <see cref="CreditRules"/>).</summary>
    [HttpGet("catalog")]
    [AllowAnonymous]
    public ActionResult<PremiumCatalogResponse> GetCatalog()
    {
        var costs = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        foreach (var key in new[]
                 {
                     PremiumActionType.UnlockChat, PremiumActionType.AiIcebreaker, PremiumActionType.AiCoachMessage,
                     PremiumActionType.DeeperMatchInsight, PremiumActionType.ProfileBoost24h, PremiumActionType.RevealLikes,
                     PremiumActionType.AiWorkoutPlan, PremiumActionType.AiProfileRewrite,
                 })
            costs[key] = CreditRules.CostForPremiumAction(key);

        return Ok(new PremiumCatalogResponse
        {
            Costs = costs,
            Labels = PremiumMonetizationLabels.ActionLabels,
        });
    }

    [HttpPost("profile-boost")]
    [Authorize]
    public async Task<ActionResult<CreditsBalanceDto>> ActivateProfileBoost(CancellationToken cancellationToken)
    {
        var userId = UserId;
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();
        cancellationToken.ThrowIfCancellationRequested();
        try
        {
            var next = await _credits.ActivateProfileBoost24hAsync(userId);
            return Ok(next);
        }
        catch (InsufficientCreditsException)
        {
            var bal = await _credits.GetCreditsBalanceAsync(userId);
            return StatusCode(402, new { code = "INSUFFICIENT_CREDITS", message = $"You need {CreditRules.ProfileBoost24h} credits for Profile Boost (24h).", balance = bal.Balance, required = CreditRules.ProfileBoost24h });
        }
    }

    [HttpPost("reveal-likes")]
    [Authorize]
    public async Task<ActionResult<CreditsBalanceDto>> UnlockRevealLikes(CancellationToken cancellationToken)
    {
        var userId = UserId;
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();
        cancellationToken.ThrowIfCancellationRequested();
        try
        {
            var next = await _credits.UnlockRevealLikesAsync(userId);
            return Ok(next);
        }
        catch (InsufficientCreditsException)
        {
            var bal = await _credits.GetCreditsBalanceAsync(userId);
            return StatusCode(402, new { code = "INSUFFICIENT_CREDITS", message = $"You need {CreditRules.RevealLikes} credits to reveal likes.", balance = bal.Balance, required = CreditRules.RevealLikes });
        }
    }
}

public class PremiumCatalogResponse
{
    public Dictionary<string, int> Costs { get; set; } = new();
    public IReadOnlyDictionary<string, string> Labels { get; set; } = new Dictionary<string, string>();
}
