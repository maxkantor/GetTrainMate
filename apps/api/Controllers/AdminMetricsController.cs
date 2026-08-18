using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using GetTrainMate.Api.Models;
using GetTrainMate.Api.Services;
using GetTrainMate.Api.Services.PartnerOutreach;
using Amazon.DynamoDBv2;
using Amazon.DynamoDBv2.DocumentModel;
using Amazon.DynamoDBv2.Model;
using System.Text.RegularExpressions;

namespace GetTrainMate.Api.Controllers;

[ApiController]
[Route("api/admin/metrics")]
[Authorize]
public class AdminMetricsController : ControllerBase
{
    private readonly IAmazonDynamoDB _dynamoDb;
    private readonly IConfiguration _configuration;
    private readonly IAuditLogService _auditLogService;
    private readonly IActivityAnalyticsService _activityAnalytics;
    private readonly IUserActivityService _userActivityService;
    private readonly ILogger<AdminMetricsController> _logger;

    public AdminMetricsController(
        IAmazonDynamoDB dynamoDb,
        IConfiguration configuration,
        IAuditLogService auditLogService,
        IActivityAnalyticsService activityAnalytics,
        IUserActivityService userActivityService,
        ILogger<AdminMetricsController> logger)
    {
        _dynamoDb = dynamoDb;
        _configuration = configuration;
        _auditLogService = auditLogService;
        _activityAnalytics = activityAnalytics;
        _userActivityService = userActivityService;
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
            var paymentsTable = _configuration["DYNAMODB_TABLE_PAYMENTS"] ?? $"{prefix}payments";

            var days = string.Equals(range, "30d", StringComparison.OrdinalIgnoreCase) ? 30 : 7;
            var fromDate = DateTime.UtcNow.AddDays(-days);
            var activeCutoff = DateTime.UtcNow.AddDays(-7);
            var monthStart = new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1, 0, 0, 0, DateTimeKind.Utc);
            var ordersCutoff = DateTime.UtcNow.AddDays(-7);

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
            var recentSignups = new List<ActivityItem>();
            foreach (var doc in profileDocs)
            {
                if (TryParseCreated(doc, out var created) && created >= fromDate)
                    newUsers++;

                if (TryParseCreated(doc, out var signupAt) && signupAt >= fromDate)
                {
                    var email = TryGetString(doc, "email", "Email");
                    var name = TryGetString(doc, "name", "Name", "displayName", "DisplayName");
                    var userId = TryGetString(doc, "userId", "UserId");
                    var label = !string.IsNullOrEmpty(name) ? name
                        : !string.IsNullOrEmpty(email) ? MaskEmail(email)
                        : userId;
                    recentSignups.Add(new ActivityItem
                    {
                        Type = "user_signup",
                        Description = $"New user: {label}",
                        Timestamp = signupAt,
                    });
                }
            }

            var activeUsers = await _userActivityService.CountActiveUsersAsync(activeCutoff);

            var totalMatches = await CountTableSafeAsync(matchesTable);
            var totalMessages = await CountTableSafeAsync(messagesTable);
            var totalEvents = await CountTableSafeAsync(eventsTable);

            var (revenueMtd, orders7d) = await GetPaymentMetricsAsync(paymentsTable, monthStart, ordersCutoff);

            var recentActivity = new List<ActivityItem>();

            try
            {
                var analyticsEvents = (await _activityAnalytics.GetEventsAsync(
                    null, fromDate, null, 1, 12)).Items;
                recentActivity.AddRange(analyticsEvents.Select(ev => new ActivityItem
                {
                    Type = ev.EventType,
                    Description = FormatAnalyticsDescription(ev),
                    Timestamp = DateTime.TryParse(ev.Timestamp, out var ts) ? ts : DateTime.UtcNow,
                }));
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Analytics events unavailable for dashboard");
            }

            recentActivity.AddRange(recentSignups.Take(5));

            try
            {
                var recentLogs = (await _auditLogService.GetLogsAsync(null, null, null, fromDate, null, 1, 8)).Items;
                recentActivity.AddRange(recentLogs.Select(log =>
                {
                    var ts = DateTime.TryParse(log.Timestamp, out var logDate) ? logDate : DateTime.UtcNow;
                    var target = string.IsNullOrEmpty(log.TargetId) ? log.TargetType : $"{log.TargetType}/{log.TargetId}";
                    var desc = string.IsNullOrEmpty(log.AdminEmail) ? target : $"{target} — {log.AdminEmail}";
                    return new ActivityItem
                    {
                        Type = $"admin_{log.Action}",
                        Description = desc,
                        Timestamp = ts,
                    };
                }));
            }
            catch (Exception auditEx)
            {
                _logger.LogWarning(auditEx, "Audit log unavailable for dashboard metrics");
            }

            recentActivity = recentActivity
                .OrderByDescending(a => a.Timestamp)
                .Take(20)
                .ToList();

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
                RecentActivity = recentActivity,
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting metrics");
            return StatusCode(500, new { error = "Failed to get metrics" });
        }
    }

    /// <summary>
    /// GET /api/admin/metrics/metro?minCohort=3
    /// Aggregated marketplace density by city/metro. No user ids, emails, or coordinates.
    /// Metros below minCohort are omitted (small-cohort suppression).
    /// </summary>
    [HttpGet("metro")]
    public async Task<ActionResult<MetroDensityResponse>> GetMetroDensity([FromQuery] int minCohort = 3)
    {
        try
        {
            if (minCohort < 1) minCohort = 1;
            if (minCohort > 50) minCohort = 50;

            var prefix = _configuration["DYNAMODB_TABLE_PREFIX"] ?? "gettrainmate-";
            var profilesTable = _configuration["DYNAMODB_TABLE_PROFILES"] ?? $"{prefix}profiles";
            var matchesTable = _configuration["DYNAMODB_TABLE_MATCHES"] ?? $"{prefix}matches";

            List<Document> profileDocs;
            try
            {
                profileDocs = await ScanAllDocumentsAsync(profilesTable);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Profile scan failed for metro metrics (table {Table})", profilesTable);
                return Ok(new MetroDensityResponse
                {
                    Status = "unavailable",
                    Reason = "Could not read profiles table for metro aggregation.",
                    MinCohort = minCohort,
                    GeneratedAtUtc = DateTime.UtcNow,
                });
            }

            var userMetro = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            var completedByMetro = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
            var profilesByMetro = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
            var modeTotals = new ModeTotalsRow();
            var pocketCompleted = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);

            foreach (var doc in profileDocs)
            {
                var userId = TryGetString(doc, "userId", "UserId");
                if (string.IsNullOrEmpty(userId)) continue;
                var metro = MetroLabelNormalizer.Normalize(TryGetString(doc, "city", "City"));
                if (string.IsNullOrEmpty(metro)) metro = "Unknown";
                userMetro[userId] = metro;
                profilesByMetro[metro] = profilesByMetro.GetValueOrDefault(metro) + 1;
                var isComplete = false;
                if (doc.ContainsKey("isComplete"))
                {
                    try { isComplete = doc["isComplete"].AsBoolean(); } catch { /* ignore */ }
                }
                else if (doc.ContainsKey("IsComplete"))
                {
                    try { isComplete = doc["IsComplete"].AsBoolean(); } catch { /* ignore */ }
                }
                if (isComplete)
                {
                    completedByMetro[metro] = completedByMetro.GetValueOrDefault(metro) + 1;
                    foreach (var mode in TryGetModes(doc))
                    {
                        if (mode == "TRAIN") modeTotals.Train++;
                        else if (mode == "VIBE") modeTotals.Vibe++;
                        else if (mode == "DATE") modeTotals.Date++;
                        var pocketKey = metro + "|" + mode;
                        pocketCompleted[pocketKey] = pocketCompleted.GetValueOrDefault(pocketKey) + 1;
                    }
                }
            }

            var connectionsByMetro = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
            var matchesByMetro = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
            try
            {
                var matchDocs = await ScanAllDocumentsAsync(matchesTable);
                foreach (var doc in matchDocs)
                {
                    var u1 = TryGetString(doc, "userId1", "UserId1");
                    var u2 = TryGetString(doc, "userId2", "UserId2");
                    var liked1 = false;
                    var liked2 = false;
                    var isMatched = false;
                    try { if (doc.ContainsKey("user1Liked")) liked1 = doc["user1Liked"].AsBoolean(); } catch { /* */ }
                    try { if (doc.ContainsKey("User1Liked")) liked1 = doc["User1Liked"].AsBoolean(); } catch { /* */ }
                    try { if (doc.ContainsKey("user2Liked")) liked2 = doc["user2Liked"].AsBoolean(); } catch { /* */ }
                    try { if (doc.ContainsKey("User2Liked")) liked2 = doc["User2Liked"].AsBoolean(); } catch { /* */ }
                    try { if (doc.ContainsKey("isMatched")) isMatched = doc["isMatched"].AsBoolean(); } catch { /* */ }
                    try { if (doc.ContainsKey("IsMatched")) isMatched = doc["IsMatched"].AsBoolean(); } catch { /* */ }

                    if (liked1 && !string.IsNullOrEmpty(u1) && userMetro.TryGetValue(u1, out var m1Conn))
                        connectionsByMetro[m1Conn] = connectionsByMetro.GetValueOrDefault(m1Conn) + 1;
                    if (liked2 && !string.IsNullOrEmpty(u2) && userMetro.TryGetValue(u2, out var m2Conn))
                        connectionsByMetro[m2Conn] = connectionsByMetro.GetValueOrDefault(m2Conn) + 1;

                    if (!isMatched) continue;
                    if (string.IsNullOrEmpty(u1) || string.IsNullOrEmpty(u2)) continue;
                    if (!userMetro.TryGetValue(u1, out var m1) || !userMetro.TryGetValue(u2, out var m2))
                        continue;
                    // Only same-metro mutual matches count toward density (cross-metro suppressed).
                    if (!string.Equals(m1, m2, StringComparison.OrdinalIgnoreCase)) continue;
                    matchesByMetro[m1] = matchesByMetro.GetValueOrDefault(m1) + 1;
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Match scan failed for metro metrics (table {Table})", matchesTable);
            }

            var metros = profilesByMetro.Keys
                .Select(metro => new MetroDensityRow
                {
                    Metro = metro,
                    Profiles = profilesByMetro.GetValueOrDefault(metro),
                    CompletedProfiles = completedByMetro.GetValueOrDefault(metro),
                    ConnectionsSent = connectionsByMetro.GetValueOrDefault(metro),
                    MatchesCreated = matchesByMetro.GetValueOrDefault(metro),
                    DiscoverUsers = null,
                    ReturningUsers = null,
                })
                .Where(r => r.CompletedProfiles >= minCohort || r.Profiles >= minCohort)
                .OrderByDescending(r => r.CompletedProfiles)
                .ThenByDescending(r => r.Profiles)
                .ThenBy(r => r.Metro, StringComparer.OrdinalIgnoreCase)
                .ToList();

            var suppressed = profilesByMetro.Count - metros.Count;
            var pockets = pocketCompleted
                .Select(kv =>
                {
                    var parts = kv.Key.Split('|');
                    return new MetroModePocketRow
                    {
                        Metro = parts[0],
                        Mode = parts.Length > 1 ? parts[1] : "",
                        CompletedProfiles = kv.Value,
                        MatchesCreated = matchesByMetro.GetValueOrDefault(parts[0]),
                    };
                })
                .Where(p => p.CompletedProfiles >= minCohort)
                .OrderByDescending(p => p.MatchesCreated)
                .ThenByDescending(p => p.CompletedProfiles)
                .Take(20)
                .ToList();
            return Ok(new MetroDensityResponse
            {
                Status = "ok",
                Reason = null,
                MinCohort = minCohort,
                GeneratedAtUtc = DateTime.UtcNow,
                SuppressedMetroCount = Math.Max(0, suppressed),
                DiscoverUsersNote = "Unavailable — CRM does not store Discover sessions by metro.",
                ReturningUsersNote = "Unavailable — CRM does not store return visits by metro.",
                ModeTotals = modeTotals,
                Pockets = pockets,
                Metros = metros,
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting metro density");
            return StatusCode(500, new { error = "Failed to get metro density" });
        }
    }

    /// <summary>Delegate to shared normalizer for tests and CRM aggregation.</summary>
    internal static string NormalizeMetroLabel(string? city) => MetroLabelNormalizer.Normalize(city);

    private async Task<(decimal RevenueMtd, int Orders7d)> GetPaymentMetricsAsync(
        string paymentsTable,
        DateTime monthStart,
        DateTime ordersCutoff)
    {
        decimal revenueMtd = 0;
        var orders7d = 0;
        try
        {
            var docs = await ScanAllDocumentsAsync(paymentsTable);
            foreach (var doc in docs)
            {
                var status = TryGetString(doc, "status", "Status").ToLowerInvariant();
                if (status != "completed" && status != "succeeded" && status != "paid") continue;

                if (!TryParsePaymentDate(doc, out var paidAt)) continue;
                if (paidAt < monthStart) continue;

                var amount = TryGetDecimal(doc, "amount", "Amount");
                revenueMtd += amount;
                if (paidAt >= ordersCutoff)
                    orders7d++;
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Payment metrics scan failed for {Table}", paymentsTable);
        }
        return (revenueMtd, orders7d);
    }

    private static string FormatAnalyticsDescription(ActivityEventRecord ev)
    {
        var parts = new List<string>();
        if (!string.IsNullOrEmpty(ev.Path)) parts.Add(ev.Path);
        if (!string.IsNullOrEmpty(ev.UserId))
            parts.Add($"user {ev.UserId[..Math.Min(8, ev.UserId.Length)]}…");
        else if (!string.IsNullOrEmpty(ev.SessionId))
            parts.Add($"session {ev.SessionId[..Math.Min(8, ev.SessionId.Length)]}…");
        return parts.Count > 0 ? string.Join(" · ", parts) : ev.EventType;
    }

    private static string MaskEmail(string email)
    {
        var at = email.IndexOf('@');
        if (at <= 1) return "***";
        return $"{email[0]}***{email[at..]}";
    }

    private static bool TryParseCreated(Document doc, out DateTime dt)
    {
        dt = default;
        foreach (var key in new[] { "createdAt", "CreatedAt" })
        {
            if (!doc.ContainsKey(key)) continue;
            if (DateTime.TryParse(doc[key].AsString(), out dt))
            {
                dt = dt.ToUniversalTime();
                return true;
            }
        }
        return false;
    }

    private static bool TryParsePaymentDate(Document doc, out DateTime dt)
    {
        dt = default;
        foreach (var key in new[] { "completedAt", "CompletedAt", "createdAt", "CreatedAt" })
        {
            if (!doc.ContainsKey(key)) continue;
            if (DateTime.TryParse(doc[key].AsString(), out dt))
            {
                dt = dt.ToUniversalTime();
                return true;
            }
        }
        return false;
    }

    private static List<string> TryGetModes(Document doc)
    {
        var found = new List<string>();
        try
        {
            if (doc.ContainsKey("modes") && doc["modes"] is DynamoDBList list)
            {
                foreach (var raw in list.AsListOfString())
                {
                    var n = ProfileModes.Normalize(raw);
                    if (!string.IsNullOrWhiteSpace(n) && !found.Contains(n, StringComparer.OrdinalIgnoreCase)) found.Add(n);
                }
            }
        }
        catch { /* ignore */ }
        if (found.Count == 0)
        {
            var single = TryGetString(doc, "mode", "Mode");
            if (!string.IsNullOrWhiteSpace(single)) found.Add(ProfileModes.Normalize(single));
        }
        return found;
    }

    private static string TryGetString(Document doc, params string[] keys)
    {
        foreach (var key in keys)
        {
            if (doc.ContainsKey(key))
                return doc[key].AsString();
        }
        return "";
    }

    private static decimal TryGetDecimal(Document doc, params string[] keys)
    {
        foreach (var key in keys)
        {
            if (!doc.ContainsKey(key)) continue;
            var entry = doc[key];
            if (entry is Primitive p && decimal.TryParse(p.AsString(), out var d)) return d;
            if (entry is DynamoDBNull) continue;
            try { return entry.AsDecimal(); } catch { /* fall through */ }
        }
        return 0;
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
    /// <summary>Stripe orders or checkout completions in the last 7 days.</summary>
    public int Orders7d { get; set; }
    public List<ActivityItem> RecentActivity { get; set; } = new();
}

public class ActivityItem
{
    public string Type { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; }
}

public class MetroDensityResponse
{
    public string Status { get; set; } = "unavailable";
    public string? Reason { get; set; }
    public int MinCohort { get; set; }
    public DateTime GeneratedAtUtc { get; set; }
    public int SuppressedMetroCount { get; set; }
    public string? DiscoverUsersNote { get; set; }
    public string? ReturningUsersNote { get; set; }
    public ModeTotalsRow ModeTotals { get; set; } = new();
    public List<MetroModePocketRow> Pockets { get; set; } = new();
    public List<MetroDensityRow> Metros { get; set; } = new();
}

public class ModeTotalsRow
{
    public int Train { get; set; }
    public int Vibe { get; set; }
    public int Date { get; set; }
}

public class MetroModePocketRow
{
    public string Metro { get; set; } = string.Empty;
    public string Mode { get; set; } = string.Empty;
    public int CompletedProfiles { get; set; }
    public int MatchesCreated { get; set; }
}

public class MetroDensityRow
{
    public string Metro { get; set; } = string.Empty;
    public int Profiles { get; set; }
    public int CompletedProfiles { get; set; }
    public int ConnectionsSent { get; set; }
    public int MatchesCreated { get; set; }
    /// <summary>Null when CRM cannot measure Discover by metro.</summary>
    public int? DiscoverUsers { get; set; }
    /// <summary>Null when CRM cannot measure returns by metro.</summary>
    public int? ReturningUsers { get; set; }
}
