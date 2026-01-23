using Microsoft.AspNetCore.Mvc;
using GetTrainMate.Api.Models;
using GetTrainMate.Api.Services;
using System.Linq;

namespace GetTrainMate.Api.Controllers;

[ApiController]
[Route("api/cms")]
public class CmsController : ControllerBase
{
    private readonly ICmsService _cmsService;
    private readonly IAdminService _adminService;
    private readonly ILogger<CmsController> _logger;

    public CmsController(ICmsService cmsService, IAdminService adminService, ILogger<CmsController> logger)
    {
        _cmsService = cmsService;
        _adminService = adminService;
        _logger = logger;
    }

    private async Task<AdminUser> ValidateAdminAsync()
    {
        var token = Request.Headers["X-Admin-Token"].FirstOrDefault()
                   ?? Request.Headers["Authorization"].FirstOrDefault();

        if (string.IsNullOrWhiteSpace(token))
            throw new UnauthorizedAccessException("Missing admin token");

        if (token.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
            token = token.Substring("Bearer ".Length).Trim();

        return await _adminService.ValidateAdminTokenAsync(token);
    }

    [HttpGet]
    public async Task<ActionResult<List<CMSContent>>> ListContent([FromQuery] string? contentType, [FromQuery] string? status, [FromQuery] int limit = 100, [FromQuery] string? q = null)
    {
        try
        {
            await ValidateAdminAsync();
            var items = await _cmsService.ListContentAsync(contentType, status, limit, q);
            return Ok(items);
        }
        catch (UnauthorizedAccessException ex)
        {
            _logger.LogWarning(ex.Message);
            return Unauthorized(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error listing CMS content: {ex.Message}");
            return StatusCode(500, new { error = "Failed to list content" });
        }
    }

    [HttpGet("{contentType}/{contentId}")]
    public async Task<ActionResult<CMSContent>> GetContent(string contentType, string contentId)
    {
        try
        {
            await ValidateAdminAsync();
            var item = await _cmsService.GetContentAsync(contentType, contentId);
            return Ok(item);
        }
        catch (UnauthorizedAccessException ex)
        {
            _logger.LogWarning(ex.Message);
            return Unauthorized(new { error = ex.Message });
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { error = "Content not found" });
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error retrieving CMS content: {ex.Message}");
            return StatusCode(500, new { error = "Failed to retrieve content" });
        }
    }

    [HttpPost]
    public async Task<ActionResult<CMSContent>> CreateContent([FromBody] CreateContentRequest request)
    {
        try
        {
            var admin = await ValidateAdminAsync();
            var content = await _cmsService.CreateContentAsync(admin.AdminId, request);
            return Ok(content);
        }
        catch (UnauthorizedAccessException ex)
        {
            _logger.LogWarning(ex.Message);
            return Unauthorized(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error creating CMS content: {ex.Message}");
            return StatusCode(500, new { error = "Failed to create content" });
        }
    }

    [HttpPut("{contentType}/{contentId}")]
    public async Task<ActionResult<CMSContent>> UpdateContent(string contentType, string contentId, [FromBody] CreateContentRequest request)
    {
        try
        {
            await ValidateAdminAsync();
            var content = await _cmsService.UpdateContentAsync(contentType, contentId, request);
            return Ok(content);
        }
        catch (UnauthorizedAccessException ex)
        {
            _logger.LogWarning(ex.Message);
            return Unauthorized(new { error = ex.Message });
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { error = "Content not found" });
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error updating CMS content: {ex.Message}");
            return StatusCode(500, new { error = "Failed to update content" });
        }
    }

    [HttpPost("{contentType}/{contentId}/publish")]
    public async Task<ActionResult<CMSContent>> PublishContent(string contentType, string contentId)
    {
        try
        {
            await ValidateAdminAsync();
            var content = await _cmsService.PublishContentAsync(contentType, contentId);
            return Ok(content);
        }
        catch (UnauthorizedAccessException ex)
        {
            _logger.LogWarning(ex.Message);
            return Unauthorized(new { error = ex.Message });
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { error = "Content not found" });
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error publishing CMS content: {ex.Message}");
            return StatusCode(500, new { error = "Failed to publish content" });
        }
    }

    [HttpPost("{contentType}/{contentId}/archive")]
    public async Task<ActionResult<CMSContent>> ArchiveContent(string contentType, string contentId)
    {
        try
        {
            await ValidateAdminAsync();
            var content = await _cmsService.ArchiveContentAsync(contentType, contentId);
            return Ok(content);
        }
        catch (UnauthorizedAccessException ex)
        {
            _logger.LogWarning(ex.Message);
            return Unauthorized(new { error = ex.Message });
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { error = "Content not found" });
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error archiving CMS content: {ex.Message}");
            return StatusCode(500, new { error = "Failed to archive content" });
        }
    }

    [HttpDelete("{contentType}/{contentId}")]
    public async Task<ActionResult> DeleteContent(string contentType, string contentId)
    {
        try
        {
            await ValidateAdminAsync();
            await _cmsService.DeleteContentAsync(contentType, contentId);
            return NoContent();
        }
        catch (UnauthorizedAccessException ex)
        {
            _logger.LogWarning(ex.Message);
            return Unauthorized(new { error = ex.Message });
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { error = "Content not found" });
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error deleting CMS content: {ex.Message}");
            return StatusCode(500, new { error = "Failed to delete content" });
        }
    }
}
