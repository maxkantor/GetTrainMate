using Microsoft.AspNetCore.Mvc;

namespace GetTrainMate.Api.Controllers;

[ApiController]
[Route("api")]
public class HealthController : ControllerBase
{
    private readonly ILogger<HealthController> _logger;

    public HealthController(ILogger<HealthController> logger)
    {
        _logger = logger;
    }

    /// <summary>
    /// Health check endpoint
    /// </summary>
    [HttpGet("health")]
    public IActionResult Health()
    {
        _logger.LogInformation("Health check called");
        return Ok(new { status = "healthy", timestamp = DateTime.UtcNow });
    }
}
