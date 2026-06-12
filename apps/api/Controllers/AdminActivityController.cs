using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using GetTrainMate.Api.Models;
using GetTrainMate.Api.Services;

namespace GetTrainMate.Api.Controllers;

[ApiController]
[Route("api/admin/activity")]
[Authorize]
public class AdminActivityController : ControllerBase
{
    private readonly IActivityAnalyticsService _analytics;
    private readonly ILogger<AdminActivityController> _logger;

    public AdminActivityController(
        IActivityAnalyticsService analytics,
        ILogger<AdminActivityController> logger)
    {
        _analytics = analytics;
        _logger = logger;
    }

    /// <summary>
    /// GET /api/admin/activity?eventType=&from=&to=&page=&pageSize=
    /// Paginated user activity stream (page views, signups, product events).
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<PagedResponse<ActivityEventRecord>>> GetActivity(
        [FromQuery] string? eventType = null,
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        try
        {
            var (items, totalCount) = await _analytics.GetEventsAsync(
                eventType,
                from,
                to,
                page,
                pageSize);

            return Ok(new PagedResponse<ActivityEventRecord>
            {
                Items = items,
                Page = page,
                PageSize = pageSize,
                TotalCount = totalCount,
                TotalPages = Math.Max(1, (int)Math.Ceiling(totalCount / (double)Math.Max(1, pageSize))),
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error loading admin activity feed");
            return StatusCode(500, new { error = "Failed to load activity" });
        }
    }
}
