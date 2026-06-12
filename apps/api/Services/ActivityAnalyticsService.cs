using Amazon.DynamoDBv2;
using Amazon.DynamoDBv2.DocumentModel;
using GetTrainMate.Api.Models;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace GetTrainMate.Api.Services;

public class ActivityAnalyticsService : IActivityAnalyticsService
{
    private static readonly HashSet<string> BlockedParamKeys = new(StringComparer.OrdinalIgnoreCase)
    {
        "email", "name", "phone", "address", "password", "token", "ssn",
    };

    private readonly IAmazonDynamoDB _dynamoDb;
    private readonly string _tableName;
    private readonly ILogger<ActivityAnalyticsService> _logger;

    public ActivityAnalyticsService(
        IAmazonDynamoDB dynamoDb,
        IConfiguration configuration,
        ILogger<ActivityAnalyticsService> logger)
    {
        _dynamoDb = dynamoDb;
        var prefix = configuration["DYNAMODB_TABLE_PREFIX"] ?? "gettrainmate-";
        _tableName = configuration["DYNAMODB_TABLE_ANALYTICS"] ?? $"{prefix}analytics";
        _logger = logger;
    }

    public async Task RecordEventAsync(
        string eventType,
        string? path = null,
        string? userId = null,
        string? sessionId = null,
        IReadOnlyDictionary<string, object>? parameters = null,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(eventType)) return;
        eventType = SanitizeEventType(eventType);
        if (eventType.Length > 80) eventType = eventType[..80];

        try
        {
            var now = DateTime.UtcNow;
            var record = new ActivityEventRecord
            {
                EventId = Guid.NewGuid().ToString(),
                EventType = eventType,
                Date = now.ToString("yyyy-MM-dd"),
                Timestamp = now.ToString("yyyy-MM-ddTHH:mm:ss.fffZ"),
                UserId = string.IsNullOrWhiteSpace(userId) ? null : userId.Trim(),
                SessionId = string.IsNullOrWhiteSpace(sessionId) ? null : sessionId.Trim()[..Math.Min(64, sessionId.Trim().Length)],
                Path = TruncatePath(path),
                ParamsJson = parameters != null && parameters.Count > 0
                    ? JsonSerializer.Serialize(SanitizeParams(parameters))
                    : null,
            };

            var table = Table.LoadTable(_dynamoDb, _tableName);
            await table.PutItemAsync(ToDocument(record), cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to record activity event {EventType}", eventType);
        }
    }

    public async Task<(List<ActivityEventRecord> Items, int TotalCount)> GetEventsAsync(
        string? eventType = null,
        DateTime? from = null,
        DateTime? to = null,
        int page = 1,
        int pageSize = 50,
        CancellationToken cancellationToken = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 200);

        try
        {
            var table = Table.LoadTable(_dynamoDb, _tableName);
            var cfg = new ScanOperationConfig();
            var filter = new ScanFilter();
            var hasFilter = false;

            if (!string.IsNullOrWhiteSpace(eventType))
            {
                filter.AddCondition("EventType", ScanOperator.Equal, eventType.Trim());
                hasFilter = true;
            }
            if (hasFilter)
                cfg.Filter = filter;

            var all = new List<ActivityEventRecord>();
            var scan = table.Scan(cfg);
            do
            {
                var batch = await scan.GetNextSetAsync(cancellationToken);
                foreach (var doc in batch)
                {
                    if (TryFromDocument(doc, out var ev))
                        all.Add(ev);
                }
            } while (!scan.IsDone);

            if (from.HasValue || to.HasValue)
            {
                all = all.Where(ev =>
                {
                    if (!DateTime.TryParse(ev.Timestamp, out var ts)) return false;
                    ts = ts.ToUniversalTime();
                    if (from.HasValue && ts < from.Value.ToUniversalTime()) return false;
                    if (to.HasValue && ts > to.Value.ToUniversalTime()) return false;
                    return true;
                }).ToList();
            }

            var sorted = all.OrderByDescending(e => e.Timestamp).ToList();
            var total = sorted.Count;
            var items = sorted.Skip((page - 1) * pageSize).Take(pageSize).ToList();
            return (items, total);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to load activity events");
            throw;
        }
    }

    private static string SanitizeEventType(string raw) =>
        Regex.Replace(raw.Trim().ToLowerInvariant(), @"[^a-z0-9_]", "_");

    private static string? TruncatePath(string? path)
    {
        if (string.IsNullOrWhiteSpace(path)) return null;
        var p = path.Trim();
        if (p.Length > 512) p = p[..512];
        return p;
    }

    private static Dictionary<string, object> SanitizeParams(IReadOnlyDictionary<string, object> parameters)
    {
        var result = new Dictionary<string, object>(StringComparer.OrdinalIgnoreCase);
        foreach (var (key, value) in parameters)
        {
            if (string.IsNullOrWhiteSpace(key) || BlockedParamKeys.Contains(key)) continue;
            if (value is string s && s.Length > 200) result[key] = s[..200];
            else result[key] = value;
            if (result.Count >= 20) break;
        }
        return result;
    }

    private static Document ToDocument(ActivityEventRecord record)
    {
        var doc = new Document
        {
            ["EventId"] = record.EventId,
            ["EventType"] = record.EventType,
            ["Date"] = record.Date,
            ["Timestamp"] = record.Timestamp,
        };
        if (!string.IsNullOrEmpty(record.UserId)) doc["UserId"] = record.UserId;
        if (!string.IsNullOrEmpty(record.SessionId)) doc["SessionId"] = record.SessionId;
        if (!string.IsNullOrEmpty(record.Path)) doc["Path"] = record.Path;
        if (!string.IsNullOrEmpty(record.ParamsJson)) doc["ParamsJson"] = record.ParamsJson;
        return doc;
    }

    private static bool TryFromDocument(Document doc, out ActivityEventRecord record)
    {
        record = null!;
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

            var eventId = S(doc, "EventId", "eventId");
            if (string.IsNullOrEmpty(eventId)) return false;

            record = new ActivityEventRecord
            {
                EventId = eventId,
                EventType = S(doc, "EventType", "eventType"),
                Date = S(doc, "Date", "date"),
                Timestamp = S(doc, "Timestamp", "timestamp"),
                UserId = string.IsNullOrEmpty(S(doc, "UserId", "userId")) ? null : S(doc, "UserId", "userId"),
                SessionId = string.IsNullOrEmpty(S(doc, "SessionId", "sessionId")) ? null : S(doc, "SessionId", "sessionId"),
                Path = string.IsNullOrEmpty(S(doc, "Path", "path")) ? null : S(doc, "Path", "path"),
                ParamsJson = string.IsNullOrEmpty(S(doc, "ParamsJson", "paramsJson")) ? null : S(doc, "ParamsJson", "paramsJson"),
            };
            return true;
        }
        catch
        {
            return false;
        }
    }
}
