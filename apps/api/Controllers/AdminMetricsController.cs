using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using GetTrainMate.Api.Services;
using Amazon.DynamoDBv2.DataModel;

namespace GetTrainMate.Api.Controllers;

[ApiController]
[Route("api/admin/metrics")]
[Authorize]
public class AdminMetricsController : ControllerBase
{
    private readonly IDynamoDBContext _context;
    private readonly ILogger<AdminMetricsController> _logger;

    public AdminMetricsController(
        IDynamoDBContext context,
        ILogger<AdminMetricsController> logger)
    {
        _context = context;
        _logger = logger;
    }

    /// <summary>
    /// GET /api/admin/metrics?range=7d|30d
    /// Get dashboard metrics
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<MetricsResponse>> GetMetrics([FromQuery] string range = "7d")
    {
        try
        {
            // TODO: Implement actual metrics calculation
            // For now, return placeholder data
            
            var days = range == "30d" ? 30 : 7;
            var fromDate = DateTime.UtcNow.AddDays(-days);

            return Ok(new MetricsResponse
            {
                Range = range,
                FromDate = fromDate,
                ToDate = DateTime.UtcNow,
                TotalUsers = 0,
                ActiveUsers = 0,
                NewUsers = 0,
                TotalMatches = 0,
                TotalMessages = 0,
                TotalEvents = 0,
                PremiumSubscriptions = 0,
                Revenue = 0,
                RecentActivity = new List<ActivityItem>()
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting metrics");
            return StatusCode(500, new { error = "Failed to get metrics" });
        }
    }
}

// Response models
public class MetricsResponse
{
    public string Range { get; set; } = string.Empty;
    public DateTime FromDate { get; set; }
    public DateTime ToDate { get; set; }
    public int TotalUsers { get; set; }
    public int ActiveUsers { get; set; }
    public int NewUsers { get; set; }
    public int TotalMatches { get; set; }
    public int TotalMessages { get; set; }
    public int TotalEvents { get; set; }
    public int PremiumSubscriptions { get; set; }
    public decimal Revenue { get; set; }
    public List<ActivityItem> RecentActivity { get; set; } = new();
}

public class ActivityItem
{
    public string Type { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; }
}
