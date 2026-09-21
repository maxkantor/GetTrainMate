using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using GetTrainMate.Api.Services.PartnerOutreach;

namespace GetTrainMate.Api.Controllers;

/// <summary>
/// Public partner attribution beacon (non-PII). Used after referral signup/activation.
/// </summary>
[ApiController]
[AllowAnonymous]
[Route("api/public/partner-attribution")]
public class PublicPartnerAttributionController : ControllerBase
{
    private readonly IPartnerOutreachService _svc;

    public PublicPartnerAttributionController(IPartnerOutreachService svc) => _svc = svc;

    public class AttributionBody
    {
        public string? PartnerCode { get; set; }
        public string? Ref { get; set; }
        /// <summary>signup | activated | paid</summary>
        public string Event { get; set; } = "signup";
        public long? RevenueCents { get; set; }
        /// <summary>When true, paid revenue is DirectRevenueCents (org as customer); default false = referral attribution.</summary>
        public bool IsDirectCustomer { get; set; }
    }

    [HttpPost]
    public async Task<IActionResult> Record([FromBody] AttributionBody body)
    {
        var code = (body.PartnerCode ?? body.Ref ?? "").Trim();
        if (string.IsNullOrWhiteSpace(code) || code.Length > 80)
            return BadRequest(new { error = "invalid_code" });
        try
        {
            return Ok(await _svc.RecordPartnerAttributionAsync(
                code, body.Event ?? "signup", body.RevenueCents, body.IsDirectCustomer));
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }
}
