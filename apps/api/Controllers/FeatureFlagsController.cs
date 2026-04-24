using GetTrainMate.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace GetTrainMate.Api.Controllers;

[ApiController]
[Route("api/feature-flags")]
public class FeatureFlagsController : ControllerBase
{
    private readonly ISportsEventLayerService _sportsEventLayerService;

    public FeatureFlagsController(ISportsEventLayerService sportsEventLayerService)
    {
        _sportsEventLayerService = sportsEventLayerService;
    }

    [HttpGet]
    public async Task<ActionResult<Dictionary<string, bool>>> Get()
    {
        var env = ResolveEnvironment();
        var flags = await _sportsEventLayerService.GetFeatureFlagsAsync(env, allowLocalOverrides: !IsProd());
        return Ok(flags);
    }

    private bool IsProd() => string.Equals(ResolveEnvironment(), "prod", StringComparison.OrdinalIgnoreCase);

    private string ResolveEnvironment()
    {
        var asp = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Production";
        if (string.Equals(asp, "Development", StringComparison.OrdinalIgnoreCase)) return "dev";
        return "prod";
    }
}
