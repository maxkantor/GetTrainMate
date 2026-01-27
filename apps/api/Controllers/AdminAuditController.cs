using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using GetTrainMate.Api.Models;
using GetTrainMate.Api.Services;
using System.Security.Claims;

namespace GetTrainMate.Api.Controllers;

[ApiController]
[Route("api/admin/audit")]
[Authorize]
public class AdminAuditController : ControllerBase
{
    private readonly IAuditLogService _auditLogService;
    private readonly ILogger<AdminAuditController> _logger;

    public AdminAuditController(
        IAuditLogService auditLogService,
        ILogger<AdminAuditController> logger)
    {
        _auditLogService = auditLogService;
        _logger = logger;
    }

    /// <summary>
    /// GET /api/admin/audit?adminSub=&targetType=&targetId=&from=&to=&page=&pageSize=
    /// Get audit logs with filtering and pagination
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<PagedResponse<AuditLog>>> GetAuditLogs(
        [FromQuery] string? adminSub = null,
        [FromQuery] string? targetType = null,
        [FromQuery] string? targetId = null,
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        try
        {
            var logs = await _auditLogService.GetLogsAsync(
                adminSub,
                targetType,
                targetId,
                from,
                to,
                page,
                pageSize);

            return Ok(new PagedResponse<AuditLog>
            {
                Items = logs,
                Page = page,
                PageSize = pageSize,
                TotalCount = logs.Count, // TODO: Get actual total count
                TotalPages = (int)Math.Ceiling(logs.Count / (double)pageSize)
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting audit logs");
            return StatusCode(500, new { error = "Failed to get audit logs" });
        }
    }
}
