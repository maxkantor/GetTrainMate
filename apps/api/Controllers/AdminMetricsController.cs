using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using GetTrainMate.Api.Models;
using GetTrainMate.Api.Services;
using Amazon.DynamoDBv2;
using Amazon.DynamoDBv2.DocumentModel;
using Amazon.DynamoDBv2.Model;

namespace GetTrainMate.Api.Controllers;

[ApiController]
[Route("api/admin/metrics")]
[Authorize]
public class AdminMetricsController : ControllerBase
{
    private readonly IAmazonDynamoDB _dynamoDb;
    private readonly IConfiguration _configuration;
    private readonly IAuditLogService _auditLogService;
    private readonly ILogger<AdminMetricsController> _logger;

    public AdminMetricsController(
        IAmazonDynamoDB dynamoDb,
        IConfiguration configuration,
        IAuditLogService auditLogService,
        ILogger<AdminMetricsController> logger)
    {
        _dynamoDb = dynamoDb;
        _configuration = configuration;
        _auditLogService = auditLogService;
        _logger = logger;
    }

    /// <summary>
    /// GET /api/admin/metrics?range=7d|30d
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<MetricsResponse>> GetMetrics([FromQuery] string range = "7d")
    {
        try
        {
            var prefix = _configuration["DYNAMODB_TABLE_PREFIX"] ?? "gettrainmate-";
            var profilesTable = _configuration["DYNAMODB_TABLE_PROFILES"] ?? $"{prefix}profiles";
            var matchesTable = _configuration["DYNAMODB_TABLE_MATCHES"] ?? $"{prefix}matches";
            var messagesTable = _configuration["DYNAMODB_TABLE_MESSAGES"] ?? $"{prefix}messages";
            var eventsTable = _configuration["DYNAMODB_TABLE_EVENTS"] ?? $"{prefix}events";

            var days = string.Equals(range, "30d", StringComparison.OrdinalIgnoreCase) ? 30 : 7;
            var fromDate = DateTime.UtcNow.AddDays(-days);
            var activeCutoff = DateTime.UtcNow.AddDays(-7);

            List<Document> profileDocs;
            try
            {
                profileDocs = await ScanAllDocumentsAsync(profilesTable);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Profile scan failed for metrics (table {Table})", profilesTable);
                profileDocs = new List<Document>();
            }
            var totalUsers = profileDocs.Count;
            var newUsers = 0;
            var activeUsers = 0;
            foreach (var doc in profileDocs)
            {
                if (TryParseCreated(doc, out var created) && created >= fromDate)
                    newUsers++;
                if (TryParseUpdated(doc, out var updated) && updated >= activeCutoff)
                    activeUsers++;
            }

            var totalMatches = await CountTableSafeAsync(matchesTable);
            var totalMessages = await CountTableSafeAsync(messagesTable);
            var totalEvents = await CountTableSafeAsync(eventsTable);

            List<AuditLog> recentLogs;
            try
            {
                recentLogs = (await _auditLogService.GetLogsAsync(null, null, null, null, null, 1, 20)).Items;
            }
            catch (Exception auditEx)
            {
                _logger.LogWarning(auditEx, "Audit log unavailable for dashboard metrics");
                recentLogs = new List<AuditLog>();
            }
            var recentActivity = recentLogs
                .OrderByDescending(l => l.Timestamp)
                .Take(15)
                .Select(log =>
                {
                    var ts = DateTime.TryParse(log.Timestamp, out var logDate)
                        ? logDate
                        : DateTime.UtcNow;
                    var target = string.IsNullOrEmpty(log.TargetId)
                        ? log.TargetType
                        : $"{log.TargetType}/{log.TargetId}";
                    var desc = string.IsNullOrEmpty(log.AdminEmail)
                        ? target
                        : $"{target} — {log.AdminEmail}";
                    return new ActivityItem
                    {
                        Type = log.Action,
                        Description = desc,
                        Timestamp = ts
                    };
                })
                .ToList();

            // Revenue / orders: extend when billing aggregates exist (Stripe sync table, etc.).
            const decimal revenueMtd = 0;
            const int orders7d = 0;

            return Ok(new MetricsResponse
            {
                Range = range,
                FromDate = fromDate,
                ToDate = DateTime.UtcNow,
                TotalUsers = totalUsers,
                ActiveUsers = activeUsers,
                NewUsers = newUsers,
                TotalMatches = totalMatches,
                TotalMessages = totalMessages,
                TotalEvents = totalEvents,
                PremiumSubscriptions = 0,
                Revenue = revenueMtd,
                Orders7d = orders7d,
                RecentActivity = recentActivity
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting metrics");
            return StatusCode(500, new { error = "Failed to get metrics" });
        }
    }

    private static bool TryParseCreated(Document doc, out DateTime dt)
    {
        dt = default;
        if (!doc.ContainsKey("createdAt")) return false;
        return DateTime.TryParse(doc["createdAt"].AsString(), out dt);
    }

    private static bool TryParseUpdated(Document doc, out DateTime dt)
    {
        dt = default;
        if (!doc.ContainsKey("updatedAt")) return false;
        return DateTime.TryParse(doc["updatedAt"].AsString(), out dt);
    }

    private async Task<List<Document>> ScanAllDocumentsAsync(string tableName)
    {
        var table = Table.LoadTable(_dynamoDb, tableName);
        var scan = table.Scan(new ScanOperationConfig());
        var all = new List<Document>();
        do
        {
            var batch = await scan.GetNextSetAsync();
            all.AddRange(batch);
        } while (!scan.IsDone);
        return all;
    }

    private async Task<int> CountTableAsync(string tableName)
    {
        var total = 0;
        Dictionary<string, AttributeValue>? lastKey = null;
        do
        {
            var req = new ScanRequest
            {
                TableName = tableName,
                Select = Select.COUNT,
            };
            if (lastKey != null && lastKey.Count > 0)
                req.ExclusiveStartKey = lastKey;
            var resp = await _dynamoDb.ScanAsync(req);
            total += resp.Count;
            lastKey = resp.LastEvaluatedKey;
        } while (lastKey != null && lastKey.Count > 0);
        return total;
    }

    private async Task<int> CountTableSafeAsync(string tableName)
    {
        try
        {
            return await CountTableAsync(tableName);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Count failed for table {Table}", tableName);
            return 0;
        }
    }
}

// Response models
public class MetricsResponse
{
    public string Range { get; set; } = string.Empty;
    public DateTime FromDate { get; set; }
    public DateTime ToDate { get; set; }
    public int TotalUsers { get; set; }
    public int ActiveUsers { get; set; }
    public int NewUsers { get; set; }
    public int TotalMatches { get; set; }
    public int TotalMessages { get; set; }
    public int TotalEvents { get; set; }
    public int PremiumSubscriptions { get; set; }
    public decimal Revenue { get; set; }
    /// <summary>Stripe orders or checkout completions in the last 7 days (placeholder until wired).</summary>
    public int Orders7d { get; set; }
    public List<ActivityItem> RecentActivity { get; set; } = new();
}

public class ActivityItem
{
    public string Type { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; }
}
