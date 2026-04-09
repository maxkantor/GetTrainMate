using System.ComponentModel.DataAnnotations;
using GetTrainMate.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GetTrainMate.Api.Controllers;

/// <summary>Public pre-signup checks (Cognito). No auth required.</summary>
[ApiController]
[Route("api/public/auth")]
public class PublicRegistrationController : ControllerBase
{
    private readonly ICognitoRegistrationCheckService _registrationCheck;
    private readonly ILogger<PublicRegistrationController> _logger;

    public PublicRegistrationController(
        ICognitoRegistrationCheckService registrationCheck,
        ILogger<PublicRegistrationController> logger)
    {
        _registrationCheck = registrationCheck;
        _logger = logger;
    }

    /// <summary>
    /// Returns whether the email can start a new signup (no duplicate Cognito user for that email).
    /// Prevents sending another verification email when an account already exists or signup is pending.
    /// </summary>
    [HttpPost("check-email")]
    [AllowAnonymous]
    public async Task<ActionResult<CheckRegistrationEmailResponse>> CheckEmail(
        [FromBody] CheckRegistrationEmailRequest? body,
        CancellationToken cancellationToken)
    {
        if (body == null || string.IsNullOrWhiteSpace(body.Email))
            return BadRequest(new { error = "Email is required." });

        var email = body.Email.Trim();
        if (email.Length > 254)
            return BadRequest(new { error = "Email is too long." });

        var (status, message, cognitoUsername) =
            await _registrationCheck.CheckEmailForRegistrationAsync(email, cancellationToken).ConfigureAwait(false);

        // Fail-open when Cognito check errors so signup can still proceed (Amplify enforces duplicates).
        var available = status == EmailRegistrationStatus.Available || status == EmailRegistrationStatus.Error;
        if (status == EmailRegistrationStatus.Error)
            _logger.LogDebug("Check-email service error; allowing signup attempt for {EmailPrefix}…", email.Length > 4 ? email[..4] : email);

        return Ok(new CheckRegistrationEmailResponse
        {
            Available = available,
            Status = status.ToString(),
            Message = message,
            ResendUsername = status == EmailRegistrationStatus.ExistsUnconfirmed ? cognitoUsername : null,
        });
    }
}

public class CheckRegistrationEmailRequest
{
    [Required]
    public string Email { get; set; } = "";
}

public class CheckRegistrationEmailResponse
{
    public bool Available { get; set; }

    /// <summary>Available | ExistsConfirmed | ExistsUnconfirmed | Error</summary>
    public string Status { get; set; } = "";

    public string? Message { get; set; }

    /// <summary>Internal Cognito username for <c>resendSignUpCode</c> when signup is UNCONFIRMED.</summary>
    public string? ResendUsername { get; set; }
}
