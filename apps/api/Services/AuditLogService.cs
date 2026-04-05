using Amazon.DynamoDBv2;
using Amazon.DynamoDBv2.DocumentModel;
using GetTrainMate.Api.Models;
using System.Text.Json;
using Microsoft.AspNetCore.Http;

namespace GetTrainMate.Api.Services;

public class AuditLogService : IAuditLogService
{
    private readonly IAmazonDynamoDB _dynamoDb;
    private readonly string _tableName;
    private readonly ILogger<AuditLogService> _logger;
    private readonly IHttpContextAccessor _httpContextAccessor;

    public AuditLogService(
        IAmazonDynamoDB dynamoDb,
        IConfiguration configuration,
        ILogger<AuditLogService> logger,
        IHttpContextAccessor httpContextAccessor)
    {
        _dynamoDb = dynamoDb;
        var prefix = configuration["DYNAMODB_TABLE_PREFIX"] ?? "gettrainmate-";
        _tableName = configuration["DYNAMODB_TABLE_AUDIT_LOG"] ?? $"{prefix}audit-log";
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

            var httpContext = _httpContextAccessor.HttpContext;
            if (httpContext != null)
            {
                log.IpAddress = httpContext.Connection.RemoteIpAddress?.ToString();
                log.UserAgent = httpContext.Request.Headers["User-Agent"].FirstOrDefault();
            }

            var table = Table.LoadTable(_dynamoDb, _tableName);
            await table.PutItemAsync(AuditLogToDocument(log));

            _logger.LogInformation("Audit log created: {Action} on {TargetType}/{TargetId} by {AdminSub}",
                action, targetType, targetId, admin.Sub);
        }
        catch (Exception ex)
        {
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
            var table = Table.LoadTable(_dynamoDb, _tableName);
            var cfg = new ScanOperationConfig();
            var filter = new ScanFilter();
            var hasFilter = false;
            if (!string.IsNullOrEmpty(adminSub))
            {
                filter.AddCondition("AdminSub", ScanOperator.Equal, adminSub);
                hasFilter = true;
            }
            if (!string.IsNullOrEmpty(targetType))
            {
                filter.AddCondition("TargetType", ScanOperator.Equal, targetType);
                hasFilter = true;
            }
            if (!string.IsNullOrEmpty(targetId))
            {
                filter.AddCondition("TargetId", ScanOperator.Equal, targetId);
                hasFilter = true;
            }
            if (hasFilter)
                cfg.Filter = filter;

            var scan = table.Scan(cfg);
            var allLogs = new List<AuditLog>();
            do
            {
                var batch = await scan.GetNextSetAsync();
                foreach (var doc in batch)
                {
                    if (TryDocumentToAuditLog(doc, out var log))
                        allLogs.Add(log);
                }
            } while (!scan.IsDone);

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

    private static Document AuditLogToDocument(AuditLog log)
    {
        // Match legacy DynamoDBContext attribute names (PascalCase) so existing table keys/indexes align.
        var doc = new Document
        {
            ["LogId"] = log.LogId,
            ["Timestamp"] = log.Timestamp,
            ["AdminSub"] = log.AdminSub,
            ["Action"] = log.Action,
            ["TargetType"] = log.TargetType,
        };
        if (!string.IsNullOrEmpty(log.AdminEmail)) doc["AdminEmail"] = log.AdminEmail;
        if (!string.IsNullOrEmpty(log.AdminUsername)) doc["AdminUsername"] = log.AdminUsername;
        if (!string.IsNullOrEmpty(log.TargetId)) doc["TargetId"] = log.TargetId;
        if (!string.IsNullOrEmpty(log.BeforeJson)) doc["BeforeJson"] = log.BeforeJson;
        if (!string.IsNullOrEmpty(log.AfterJson)) doc["AfterJson"] = log.AfterJson;
        if (!string.IsNullOrEmpty(log.RequestId)) doc["RequestId"] = log.RequestId;
        if (!string.IsNullOrEmpty(log.IpAddress)) doc["IpAddress"] = log.IpAddress;
        if (!string.IsNullOrEmpty(log.UserAgent)) doc["UserAgent"] = log.UserAgent;
        return doc;
    }

    private static bool TryDocumentToAuditLog(Document doc, out AuditLog log)
    {
        log = null!;
        try
        {
            static string S(Document d, params string[] keys)
            {
                foreach (var k in keys)
                {
                    if (d.ContainsKey(k))
                        return d[k].AsString();
                }
                return "";
            }

            var logId = S(doc, "logId", "LogId");
            if (string.IsNullOrEmpty(logId))
                return false;

            log = new AuditLog
            {
                LogId = logId,
                Timestamp = S(doc, "timestamp", "Timestamp"),
                AdminSub = S(doc, "adminSub", "AdminSub"),
                AdminEmail = string.IsNullOrEmpty(S(doc, "adminEmail", "AdminEmail")) ? null : S(doc, "adminEmail", "AdminEmail"),
                AdminUsername = string.IsNullOrEmpty(S(doc, "adminUsername", "AdminUsername")) ? null : S(doc, "adminUsername", "AdminUsername"),
                Action = S(doc, "action", "Action"),
                TargetType = S(doc, "targetType", "TargetType"),
                TargetId = string.IsNullOrEmpty(S(doc, "targetId", "TargetId")) ? null : S(doc, "targetId", "TargetId"),
                BeforeJson = string.IsNullOrEmpty(S(doc, "beforeJson", "BeforeJson")) ? null : S(doc, "beforeJson", "BeforeJson"),
                AfterJson = string.IsNullOrEmpty(S(doc, "afterJson", "AfterJson")) ? null : S(doc, "afterJson", "AfterJson"),
                RequestId = string.IsNullOrEmpty(S(doc, "requestId", "RequestId")) ? null : S(doc, "requestId", "RequestId"),
                IpAddress = string.IsNullOrEmpty(S(doc, "ipAddress", "IpAddress")) ? null : S(doc, "ipAddress", "IpAddress"),
                UserAgent = string.IsNullOrEmpty(S(doc, "userAgent", "UserAgent")) ? null : S(doc, "userAgent", "UserAgent"),
                Metadata = new Dictionary<string, string>()
            };
            return true;
        }
        catch
        {
            return false;
        }
    }
}
