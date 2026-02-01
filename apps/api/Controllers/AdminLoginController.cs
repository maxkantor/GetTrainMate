using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Amazon.SimpleSystemsManagement;
using Amazon.SimpleSystemsManagement.Model;
using GetTrainMate.Api.Models;
using GetTrainMate.Api.Services;

namespace GetTrainMate.Api.Controllers;

[ApiController]
[Route("api/admin/login")]
[AllowAnonymous]
public class AdminLoginController : ControllerBase
{
    private readonly IAdminService _adminService;
    private readonly IAmazonSimpleSystemsManagement _ssm;
    private readonly ILogger<AdminLoginController> _logger;

    public AdminLoginController(
        IAdminService adminService,
        IAmazonSimpleSystemsManagement ssm,
        ILogger<AdminLoginController> logger)
    {
        _adminService = adminService;
        _ssm = ssm;
        _logger = logger;
    }

    /// <summary>
    /// POST /api/admin/login
    /// Uses AdminService: SSM password, AdminUser in DynamoDB, returns token for X-Admin-Token.
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<AdminLoginApiResponse>> Login([FromBody] AdminLoginRequest request)
    {
        try
        {
            if (string.IsNullOrEmpty(request.Email) || string.IsNullOrEmpty(request.Password))
                return BadRequest(new { error = "Email and password are required" });

            try
            {
                var response = await _adminService.LoginAsync(request.Email, request.Password);
                return Ok(new AdminLoginApiResponse
                {
                    Success = true,
                    Token = response.Token,
                    SessionToken = response.Token,
                    ExpiresAt = DateTime.UtcNow.AddDays(7),
                    Email = response.Admin.Email,
                    Admin = response.Admin
                });
            }
            catch (UnauthorizedAccessException ex) when (ex.Message.Contains("not found"))
            {
                _logger.LogInformation("Admin user not found, initializing for {Email}", request.Email);
                try
                {
                    await _ssm.GetParameterAsync(new GetParameterRequest { Name = "/gettrainmate/admin/password", WithDecryption = true });
                }
                catch (ParameterNotFoundException)
                {
                    await _ssm.PutParameterAsync(new PutParameterRequest
                    {
                        Name = "/gettrainmate/admin/password",
                        Value = request.Password,
                        Type = ParameterType.SecureString,
                        Description = "Admin portal password"
                    });
                }
                await _adminService.InitializeAdminAsync(request.Email, "Admin");
                var r = await _adminService.LoginAsync(request.Email, request.Password);
                return Ok(new AdminLoginApiResponse
                {
                    Success = true,
                    Token = r.Token,
                    SessionToken = r.Token,
                    ExpiresAt = DateTime.UtcNow.AddDays(7),
                    Email = r.Admin.Email,
                    Admin = r.Admin
                });
            }
        }
        catch (UnauthorizedAccessException)
        {
            return Unauthorized(new { error = "Invalid credentials" });
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

public class AdminLoginApiResponse
{
    public bool Success { get; set; }
    public string Token { get; set; } = string.Empty;
    public string SessionToken { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public string Email { get; set; } = string.Empty;
    public AdminUserDto? Admin { get; set; }
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
