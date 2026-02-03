using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using GetTrainMate.Api.Models;
using GetTrainMate.Api.Services;
using System.Linq;

namespace GetTrainMate.Api.Controllers;

[ApiController]
[Route("api/admin/credit-packs")]
[AllowAnonymous]
public class AdminCreditPacksController : ControllerBase
{
    private readonly ICreditsService _creditsService;
    private readonly IAdminService _adminService;
    private readonly ILogger<AdminCreditPacksController> _logger;

    public AdminCreditPacksController(
        ICreditsService creditsService,
        IAdminService adminService,
        ILogger<AdminCreditPacksController> logger)
    {
        _creditsService = creditsService;
        _adminService = adminService;
        _logger = logger;
    }

    private async Task ValidateAdminAsync()
    {
        var token = Request.Headers["X-Admin-Token"].FirstOrDefault()
            ?? (Request.Headers["Authorization"].FirstOrDefault()?.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase) == true
                ? Request.Headers["Authorization"].FirstOrDefault()!.Substring("Bearer ".Length).Trim()
                : null);

        if (string.IsNullOrWhiteSpace(token))
            throw new UnauthorizedAccessException("Missing admin token");

        await _adminService.ValidateAdminTokenAsync(token);
    }

    [HttpGet]
    public async Task<ActionResult<List<CreditPackAdminDto>>> GetPacks()
    {
        try
        {
            await ValidateAdminAsync();
            var packs = await _creditsService.GetAllCreditPacksForAdminAsync();
            return Ok(packs.Select(p => new CreditPackAdminDto
            {
                Key = p.Key,
                Title = p.Title,
                PriceUsd = p.PriceUsd,
                Credits = p.Credits,
                IsActive = p.IsActive,
                SortOrder = p.SortOrder,
                IsBestValue = p.IsBestValue,
                StripePriceId = p.StripePriceId ?? "",
            }).ToList());
        }
        catch (UnauthorizedAccessException ex)
        {
            _logger.LogWarning(ex.Message);
            return Unauthorized(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching credit packs");
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpPut("{key}")]
    public async Task<ActionResult> UpdatePack(string key, [FromBody] UpdateCreditPackRequest request)
    {
        try
        {
            await ValidateAdminAsync();
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { error = ex.Message });
        }

        if (request == null)
            return BadRequest(new { error = "Request body required" });

        var packs = await _creditsService.GetAllCreditPacksForAdminAsync();
        var pack = packs.FirstOrDefault(p => string.Equals(p.Key, key, StringComparison.OrdinalIgnoreCase));
        if (pack == null)
            return NotFound(new { error = $"Pack {key} not found" });

        pack.Title = request.Title ?? pack.Title;
        pack.PriceUsd = request.PriceUsd ?? pack.PriceUsd;
        pack.Credits = request.Credits ?? pack.Credits;
        pack.IsActive = request.IsActive ?? pack.IsActive;
        pack.SortOrder = request.SortOrder ?? pack.SortOrder;
        pack.IsBestValue = request.IsBestValue ?? pack.IsBestValue;
        await _creditsService.SaveCreditPackAsync(pack);
        return Ok(new { message = "Pack updated" });
    }

    [HttpPost("seed")]
    public async Task<ActionResult> SeedPacks()
    {
        try
        {
            await ValidateAdminAsync();
            await _creditsService.SeedDefaultCreditPacksIfEmptyAsync();
            return Ok(new { message = "Credit packs seeded." });
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error seeding credit packs");
            return StatusCode(500, new { error = ex.Message });
        }
    }
}

public class CreditPackAdminDto
{
    public string Key { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public decimal PriceUsd { get; set; }
    public int Credits { get; set; }
    public bool IsActive { get; set; }
    public int SortOrder { get; set; }
    public bool IsBestValue { get; set; }
    public string StripePriceId { get; set; } = string.Empty;
}

public class UpdateCreditPackRequest
{
    public string? Title { get; set; }
    public decimal? PriceUsd { get; set; }
    public int? Credits { get; set; }
    public bool? IsActive { get; set; }
    public int? SortOrder { get; set; }
    public bool? IsBestValue { get; set; }
}
