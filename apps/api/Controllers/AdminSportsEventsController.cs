using GetTrainMate.Api.Models;
using GetTrainMate.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GetTrainMate.Api.Controllers;

[ApiController]
[Route("api/admin/sports-events")]
[Authorize]
public class AdminSportsEventsController : ControllerBase
{
    private readonly ISportsEventLayerService _sportsEventLayerService;

    public AdminSportsEventsController(ISportsEventLayerService sportsEventLayerService)
    {
        _sportsEventLayerService = sportsEventLayerService;
    }

    [HttpGet("flags")]
    public async Task<ActionResult<Dictionary<string, bool>>> GetFlags()
    {
        var env = ResolveEnvironment();
        var flags = await _sportsEventLayerService.GetFeatureFlagsAsync(env, allowLocalOverrides: true);
        return Ok(flags);
    }

    [HttpPut("flags/{flagKey}")]
    public async Task<ActionResult<FeatureFlag>> SetFlag(string flagKey, [FromBody] FeatureFlag flag)
    {
        flag.FlagKey = flagKey;
        if (string.IsNullOrWhiteSpace(flag.Environment))
        {
            flag.Environment = ResolveEnvironment();
        }
        var saved = await _sportsEventLayerService.UpsertFeatureFlagAsync(flag);
        return Ok(saved);
    }

    [HttpGet]
    public async Task<ActionResult<List<EventConfig>>> GetAll()
    {
        var all = await _sportsEventLayerService.GetAllEventConfigsAsync();
        return Ok(all);
    }

    [HttpPut("{eventId}")]
    public async Task<ActionResult<EventConfig>> UpsertEvent(string eventId, [FromBody] EventConfig config)
    {
        if (string.IsNullOrWhiteSpace(eventId))
        {
            return BadRequest("Event ID is required.");
        }

        if (string.IsNullOrWhiteSpace(config.Label) || string.IsNullOrWhiteSpace(config.Sport))
        {
            return BadRequest("Label and sport are required.");
        }

        if (!DateTime.TryParse(config.StartDate, out var start) || !DateTime.TryParse(config.EndDate, out var end))
        {
            return BadRequest("StartDate and EndDate must be valid ISO date/time values.");
        }

        if (start >= end)
        {
            return BadRequest("StartDate must be before EndDate.");
        }

        config.EventId = eventId;
        var saved = await _sportsEventLayerService.UpsertEventConfigAsync(config);
        return Ok(saved);
    }

    private string ResolveEnvironment()
    {
        var asp = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Production";
        if (string.Equals(asp, "Development", StringComparison.OrdinalIgnoreCase)) return "dev";
        return "prod";
    }
}
