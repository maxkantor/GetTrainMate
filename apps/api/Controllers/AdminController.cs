using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using GetTrainMate.Api.Models;
using GetTrainMate.Api.Services;

namespace GetTrainMate.Api.Controllers;

[ApiController]
[Route("api/admin")]
public class AdminController : ControllerBase
{
    private readonly IAdminService _adminService;
    private readonly ILogger<AdminController> _logger;

    public AdminController(IAdminService adminService, ILogger<AdminController> logger)
    {
        _adminService = adminService;
        _logger = logger;
    }

    private string GetAdminId()
    {
        return User.FindFirst("admin_id")?.Value 
            ?? throw new UnauthorizedAccessException("Admin ID not found");
    }

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult<AdminTokenResponse>> Login([FromBody] AdminLoginRequest request)
    {
        try
        {
            if (string.IsNullOrEmpty(request.Email) || string.IsNullOrEmpty(request.Password))
                return BadRequest(new { error = "Email and password required" });

            var response = await _adminService.LoginAsync(request.Email, request.Password);
            return Ok(response);
        }
        catch (UnauthorizedAccessException)
        {
            _logger.LogWarning($"Failed admin login attempt for: {request.Email}");
            return Unauthorized(new { error = "Invalid credentials" });
        }
        catch (Exception ex)
        {
            _logger.LogError($"Admin login error: {ex.Message}");
            return StatusCode(500, new { error = "Login failed" });
        }
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<ActionResult<AdminUserDto>> GetCurrentAdmin()
    {
        try
        {
            var adminId = GetAdminId();
            var admin = await _adminService.GetAdminAsync(adminId);

            return Ok(new AdminUserDto
            {
                AdminId = admin.AdminId,
                Email = admin.Email,
                Name = admin.Name,
                Permissions = admin.Permissions,
                IsActive = admin.IsActive
            });
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { error = "Admin not found" });
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error retrieving current admin: {ex.Message}");
            return StatusCode(500, new { error = "Failed to retrieve admin info" });
        }
    }

    [HttpGet("{adminId}")]
    [Authorize]
    public async Task<ActionResult<AdminUserDto>> GetAdmin(string adminId)
    {
        try
        {
            var admin = await _adminService.GetAdminAsync(adminId);

            return Ok(new AdminUserDto
            {
                AdminId = admin.AdminId,
                Email = admin.Email,
                Name = admin.Name,
                Permissions = admin.Permissions,
                IsActive = admin.IsActive
            });
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { error = "Admin not found" });
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error retrieving admin: {ex.Message}");
            return StatusCode(500, new { error = "Failed to retrieve admin" });
        }
    }

    [HttpPut("{adminId}")]
    [Authorize]
    public async Task<ActionResult> UpdateAdmin(string adminId, [FromBody] AdminUser adminUpdate)
    {
        try
        {
            var currentAdminId = GetAdminId();
            
            // Only allow self-updates or super admin updates
            if (currentAdminId != adminId)
            {
                _logger.LogWarning($"Unauthorized admin update attempt by {currentAdminId}");
                return Forbid();
            }

            var admin = await _adminService.GetAdminAsync(adminId);
            admin.Name = adminUpdate.Name ?? admin.Name;
            admin.IsActive = adminUpdate.IsActive;

            await _adminService.UpdateAdminAsync(admin);
            return Ok(new { message = "Admin updated successfully" });
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { error = "Admin not found" });
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error updating admin: {ex.Message}");
            return StatusCode(500, new { error = "Failed to update admin" });
        }
    }
}
