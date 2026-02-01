using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using GetTrainMate.Api.Models;
using GetTrainMate.Api.Services;
using System.Linq;

namespace GetTrainMate.Api.Controllers;

[ApiController]
[Route("api/admin/billing")]
[AllowAnonymous]
public class AdminBillingController : ControllerBase
{
    private readonly IBillingService _billingService;
    private readonly IAdminService _adminService;
    private readonly ILogger<AdminBillingController> _logger;

    public AdminBillingController(
        IBillingService billingService,
        IAdminService adminService,
        ILogger<AdminBillingController> logger)
    {
        _billingService = billingService;
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

    [HttpGet("plans")]
    public async Task<ActionResult<List<BillingPlanAdminDto>>> GetPlans()
    {
        try
        {
            await ValidateAdminAsync();
            var plans = await _billingService.GetAllPlansForAdminAsync();
            return Ok(plans.Select(p => new BillingPlanAdminDto
            {
                Key = p.Key,
                DisplayName = p.DisplayName,
                MonthlyPrice = p.MonthlyPrice,
                Features = p.Features,
                IsActive = p.IsActive,
                SortOrder = p.SortOrder,
                StripePriceIdMonthly = p.StripePriceIdMonthly ?? "",
            }).ToList());
        }
        catch (UnauthorizedAccessException ex)
        {
            _logger.LogWarning(ex.Message);
            return Unauthorized(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching billing plans");
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpPut("plans/{key}")]
    public async Task<ActionResult> UpdatePlan(string key, [FromBody] UpdatePlanRequest request)
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

        var plan = await _billingService.GetPlanByKeyAsync(key);
        if (plan == null)
            return NotFound(new { error = $"Plan {key} not found" });

        plan.DisplayName = request.DisplayName ?? plan.DisplayName;
        plan.MonthlyPrice = request.MonthlyPrice ?? plan.MonthlyPrice;
        plan.Features = request.Features ?? plan.Features;
        plan.IsActive = request.IsActive ?? plan.IsActive;
        plan.SortOrder = request.SortOrder ?? plan.SortOrder;
        await _billingService.SavePlanAsync(plan);
        return Ok(new { message = "Plan updated" });
    }

    [HttpPost("plans/seed")]
    public async Task<ActionResult> SeedPlans()
    {
        try
        {
            await ValidateAdminAsync();
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { error = ex.Message });
        }

        var defaults = new[]
        {
            new BillingPlan
            {
                Key = "free",
                DisplayName = "Free",
                MonthlyPrice = 0,
                Features = new List<string> { "10 matches per day", "5 messages per day", "Basic filters" },
                IsActive = true,
                SortOrder = 1,
                CreatedAt = DateTime.UtcNow,
            },
            new BillingPlan
            {
                Key = "pro",
                DisplayName = "Pro",
                MonthlyPrice = 5.99m,
                Features = new List<string> { "Unlimited matches", "Unlimited messaging", "Advanced filters", "AI compatibility" },
                IsActive = true,
                SortOrder = 2,
                CreatedAt = DateTime.UtcNow,
            },
            new BillingPlan
            {
                Key = "elite",
                DisplayName = "Elite",
                MonthlyPrice = 9.99m,
                Features = new List<string> { "Unlimited matches", "Unlimited messaging", "Advanced filters", "AI compatibility", "See who liked you", "Priority placement" },
                IsActive = true,
                SortOrder = 3,
                CreatedAt = DateTime.UtcNow,
            },
        };

        foreach (var plan in defaults)
        {
            var existing = await _billingService.GetPlanByKeyAsync(plan.Key);
            if (existing != null)
            {
                plan.CreatedAt = existing.CreatedAt;
            }
            await _billingService.SavePlanAsync(plan);
        }

        return Ok(new { message = "Plans seeded. Prices are sent directly from plans." });
    }
}

public class BillingPlanAdminDto
{
    public string Key { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public decimal MonthlyPrice { get; set; }
    public List<string> Features { get; set; } = new();
    public bool IsActive { get; set; }
    public int SortOrder { get; set; }
    public string StripePriceIdMonthly { get; set; } = string.Empty;
}

public class UpdatePlanRequest
{
    public string? DisplayName { get; set; }
    public decimal? MonthlyPrice { get; set; }
    public List<string>? Features { get; set; }
    public bool? IsActive { get; set; }
    public int? SortOrder { get; set; }
    public string? StripePriceIdMonthly { get; set; }
}
