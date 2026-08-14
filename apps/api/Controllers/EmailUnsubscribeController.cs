using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using GetTrainMate.Api.Services.PartnerOutreach;

namespace GetTrainMate.Api.Controllers;

[ApiController]
[AllowAnonymous]
[Route("email")]
public class EmailUnsubscribeController : ControllerBase
{
    private readonly IPartnerOutreachService _svc;
    private readonly IConfiguration _cfg;

    public EmailUnsubscribeController(IPartnerOutreachService svc, IConfiguration cfg)
    {
        _svc = svc;
        _cfg = cfg;
    }

    [HttpGet("unsubscribe")]
    [HttpPost("unsubscribe")]
    public async Task<IActionResult> Unsubscribe([FromQuery] string? t)
    {
        var secret = Environment.GetEnvironmentVariable("PARTNER_UNSUBSCRIBE_SIGNING_SECRET")
            ?? Environment.GetEnvironmentVariable("GETTRAINMATE_UNSUBSCRIBE_SECRET")
            ?? "";
        if (string.IsNullOrWhiteSpace(t) || string.IsNullOrWhiteSpace(secret)
            || !UnsubscribeToken.TryValidate(t, secret, out var recipientId, out _))
        {
            return BadRequest("This unsubscribe link is invalid or expired.");
        }
        await _svc.UnsubscribeAsync(recipientId);
        var site = (_cfg["Frontend:BaseUrl"] ?? "https://gettrainmate.com").TrimEnd('/');
        if (string.Equals(Request.Method, "GET", StringComparison.OrdinalIgnoreCase))
            return Redirect($"{site}/email/unsubscribed");
        return Ok(new { ok = true });
    }
}
