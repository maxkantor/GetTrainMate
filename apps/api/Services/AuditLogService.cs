using Amazon.DynamoDBv2.DataModel;
using Amazon.DynamoDBv2.DocumentModel;
using GetTrainMate.Api.Models;
using System.Text.Json;
using Microsoft.AspNetCore.Http;

namespace GetTrainMate.Api.Services;

public class AuditLogService : IAuditLogService
{
    private readonly IDynamoDBContext _context;
    private readonly ILogger<AuditLogService> _logger;
    private readonly IHttpContextAccessor _httpContextAccessor;

    public AuditLogService(
        IDynamoDBContext context,
        ILogger<AuditLogService> logger,
        IHttpContextAccessor httpContextAccessor)
    {
        _context = context;
        _logger = logger;
        _httpContextAccessor = httpContextAccessor;
    }

    public async Task LogActionAsync(
        AdminIdentity admin,
        string action,
        string targetType,
        string? targetId = null,
        object? before = null,
        object? after = null,
        string? requestId = null)
    {
        try
        {
            var log = new AuditLog
            {
                LogId = Guid.NewGuid().ToString(),
                Timestamp = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ"),
                AdminSub = admin.Sub,
                AdminEmail = admin.Email,
                AdminUsername = admin.CognitoUsername,
                Action = action,
                TargetType = targetType,
                TargetId = targetId,
                RequestId = requestId ?? _httpContextAccessor.HttpContext?.TraceIdentifier,
                BeforeJson = before != null ? JsonSerializer.Serialize(before) : null,
                AfterJson = after != null ? JsonSerializer.Serialize(after) : null
            };

            // Extract request metadata
            var httpContext = _httpContextAccessor.HttpContext;
            if (httpContext != null)
            {
                log.IpAddress = httpContext.Connection.RemoteIpAddress?.ToString();
                log.UserAgent = httpContext.Request.Headers["User-Agent"].FirstOrDefault();
            }

            await _context.SaveAsync(log);
            _logger.LogInformation("Audit log created: {Action} on {TargetType}/{TargetId} by {AdminSub}", 
                action, targetType, targetId, admin.Sub);
        }
        catch (Exception ex)
        {
            // Don't fail the request if audit logging fails, but log the error
            _logger.LogError(ex, "Failed to create audit log for action {Action}", action);
        }
    }

    public async Task<List<AuditLog>> GetLogsAsync(
        string? adminSub = null,
        string? targetType = null,
        string? targetId = null,
        DateTime? from = null,
        DateTime? to = null,
        int page = 1,
        int pageSize = 50)
    {
        try
        {
            var conditions = new List<ScanCondition>();

            if (!string.IsNullOrEmpty(adminSub))
            {
                conditions.Add(new ScanCondition(nameof(AuditLog.AdminSub), ScanOperator.Equal, adminSub));
            }

            if (!string.IsNullOrEmpty(targetType))
            {
                conditions.Add(new ScanCondition(nameof(AuditLog.TargetType), ScanOperator.Equal, targetType));
            }

            if (!string.IsNullOrEmpty(targetId))
            {
                conditions.Add(new ScanCondition(nameof(AuditLog.TargetId), ScanOperator.Equal, targetId));
            }

            var scan = _context.ScanAsync<AuditLog>(conditions);
            var allLogs = await scan.GetRemainingAsync();

            // Filter by date range if provided
            if (from.HasValue || to.HasValue)
            {
                allLogs = allLogs.Where(log =>
                {
                    if (DateTime.TryParse(log.Timestamp, out var logDate))
                    {
                        if (from.HasValue && logDate < from.Value) return false;
                        if (to.HasValue && logDate > to.Value) return false;
                        return true;
                    }
                    return false;
                }).ToList();
            }

            // Sort by timestamp descending and paginate
            var sorted = allLogs
                .OrderByDescending(log => log.Timestamp)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToList();

            return sorted;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving audit logs");
            throw;
        }
    }
}
