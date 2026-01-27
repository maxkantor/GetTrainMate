using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Amazon.SimpleSystemsManagement;
using Amazon.SimpleSystemsManagement.Model;
using Microsoft.Extensions.Configuration;

namespace GetTrainMate.Api.Controllers;

[ApiController]
[Route("api/admin/login")]
[AllowAnonymous] // Allow unauthenticated access for login
public class AdminLoginController : ControllerBase
{
    private readonly IAmazonSimpleSystemsManagement _ssm;
    private readonly IConfiguration _configuration;
    private readonly ILogger<AdminLoginController> _logger;

    public AdminLoginController(
        IAmazonSimpleSystemsManagement ssm,
        IConfiguration configuration,
        ILogger<AdminLoginController> logger)
    {
        _ssm = ssm;
        _configuration = configuration;
        _logger = logger;
    }

    /// <summary>
    /// POST /api/admin/login
    /// Validate admin credentials against SSM Parameter Store
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<AdminLoginResponse>> Login([FromBody] AdminLoginRequest request)
    {
        try
        {
            if (string.IsNullOrEmpty(request.Email) || string.IsNullOrEmpty(request.Password))
            {
                return BadRequest(new { error = "Email and password are required" });
            }

            // Get admin email from allowlist
            var allowlist = _configuration["ADMIN_ALLOWLIST"] ?? "mykantor@bellsouth.net";
            var allowedEmails = allowlist.Split(',')
                .Select(e => e.Trim().ToLowerInvariant())
                .ToList();

            var emailLower = request.Email.Trim().ToLowerInvariant();
            if (!allowedEmails.Contains(emailLower))
            {
                return Unauthorized(new { error = "Invalid email" });
            }

            // Get password from SSM Parameter Store
            var ssmPath = $"/gettrainmate/admin/password";
            string storedPassword;

            try
            {
                var ssmRequest = new GetParameterRequest
                {
                    Name = ssmPath,
                    WithDecryption = true
                };

                var ssmResponse = await _ssm.GetParameterAsync(ssmRequest);
                storedPassword = ssmResponse.Parameter.Value;
            }
            catch (ParameterNotFoundException)
            {
                _logger.LogWarning("Admin password not found in SSM at {Path}. Creating it now.", ssmPath);
                
                // Create the parameter if it doesn't exist (first time setup)
                var putRequest = new PutParameterRequest
                {
                    Name = ssmPath,
                    Value = request.Password, // Use provided password as initial value
                    Type = ParameterType.SecureString,
                    Description = "Admin portal password"
                };

                await _ssm.PutParameterAsync(putRequest);
                storedPassword = request.Password;
            }

            // Validate password
            if (request.Password != storedPassword)
            {
                return Unauthorized(new { error = "Invalid password" });
            }

            // Generate a simple session token (or use JWT if preferred)
            var sessionToken = Guid.NewGuid().ToString();
            var expiresAt = DateTime.UtcNow.AddDays(7); // 7 day session

            return Ok(new AdminLoginResponse
            {
                Success = true,
                SessionToken = sessionToken,
                ExpiresAt = expiresAt,
                Email = request.Email
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during admin login");
            return StatusCode(500, new { error = "Login failed" });
        }
    }

    /// <summary>
    /// POST /api/admin/login/validate-session
    /// Validate a cached session token
    /// </summary>
    [HttpPost("validate-session")]
    public async Task<ActionResult<AdminSessionResponse>> ValidateSession([FromBody] ValidateSessionRequest request)
    {
        try
        {
            // For simplicity, we'll just check if the token format is valid
            // In production, you might want to store sessions in DynamoDB
            if (string.IsNullOrEmpty(request.SessionToken))
            {
                return Unauthorized(new { error = "Invalid session" });
            }

            // Basic validation - in production, check against stored sessions
            return Ok(new AdminSessionResponse
            {
                Valid = true,
                Email = request.Email
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error validating session");
            return StatusCode(500, new { error = "Validation failed" });
        }
    }
}

// Request/Response models
public class AdminLoginRequest
{
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}

public class AdminLoginResponse
{
    public bool Success { get; set; }
    public string SessionToken { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public string Email { get; set; } = string.Empty;
}

public class ValidateSessionRequest
{
    public string SessionToken { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
}

public class AdminSessionResponse
{
    public bool Valid { get; set; }
    public string Email { get; set; } = string.Empty;
}
