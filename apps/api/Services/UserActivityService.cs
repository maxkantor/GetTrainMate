using Amazon.DynamoDBv2;
using Amazon.DynamoDBv2.DocumentModel;
using GetTrainMate.Api.Models;

namespace GetTrainMate.Api.Services;

public class UserActivityService : IUserActivityService
{
    private readonly IAmazonDynamoDB _dynamoDb;
    private readonly string _tableName;
    private readonly ILogger<UserActivityService> _logger;

    public UserActivityService(
        IAmazonDynamoDB dynamoDb,
        IConfiguration configuration,
        ILogger<UserActivityService> logger)
    {
        _dynamoDb = dynamoDb;
        var prefix = configuration["DYNAMODB_TABLE_PREFIX"] ?? "gettrainmate-";
        _tableName = configuration["DYNAMODB_TABLE_USER_ACTIVITY"] ?? $"{prefix}user-activity";
        _logger = logger;
    }

    public async Task RecordHeartbeatAsync(
        string userId,
        string? activeChatThreadId = null,
        string? currentPath = null,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrEmpty(userId)) return;
        try
        {
            var table = Table.LoadTable(_dynamoDb, _tableName);
            var doc = new Document
            {
                ["userId"] = userId,
                ["lastSeenUtc"] = DateTime.UtcNow.ToString("O"),
            };
            if (!string.IsNullOrWhiteSpace(activeChatThreadId))
                doc["activeChatThreadId"] = activeChatThreadId.Trim();
            if (!string.IsNullOrWhiteSpace(currentPath))
            {
                var path = currentPath.Trim();
                if (path.Length > 512) path = path[..512];
                doc["currentPath"] = path;
            }

            await table.PutItemAsync(doc, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Heartbeat failed for {UserId}", userId);
        }
    }

    public async Task<UserActivitySnapshot?> GetActivityAsync(string userId, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrEmpty(userId)) return null;
        try
        {
            var table = Table.LoadTable(_dynamoDb, _tableName);
            var doc = await table.GetItemAsync(userId, cancellationToken);
            if (doc == null) return null;

            DateTime? lastSeen = null;
            if (doc.ContainsKey("lastSeenUtc") &&
                DateTime.TryParse(doc["lastSeenUtc"].AsString(), out var utc))
                lastSeen = utc.ToUniversalTime();

            string? activeThread = null;
            if (doc.ContainsKey("activeChatThreadId"))
            {
                var s = doc["activeChatThreadId"].AsString();
                if (!string.IsNullOrWhiteSpace(s)) activeThread = s.Trim();
            }

            return new UserActivitySnapshot
            {
                LastSeenUtc = lastSeen,
                ActiveChatThreadId = activeThread,
            };
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "GetActivity failed for {UserId}", userId);
            return null;
        }
    }

    public async Task<int> CountActiveUsersAsync(DateTime sinceUtc, CancellationToken cancellationToken = default)
    {
        try
        {
            var table = Table.LoadTable(_dynamoDb, _tableName);
            var scan = table.Scan(new ScanOperationConfig());
            var count = 0;
            do
            {
                var batch = await scan.GetNextSetAsync(cancellationToken);
                foreach (var doc in batch)
                {
                    if (!TryParseLastSeen(doc, out var lastSeen)) continue;
                    if (lastSeen >= sinceUtc.ToUniversalTime())
                        count++;
                }
            } while (!scan.IsDone);

            return count;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "CountActiveUsers failed");
            return 0;
        }
    }

    private static bool TryParseLastSeen(Document doc, out DateTime lastSeen)
    {
        lastSeen = default;
        foreach (var key in new[] { "lastSeenUtc", "LastSeenUtc" })
        {
            if (!doc.ContainsKey(key)) continue;
            if (DateTime.TryParse(doc[key].AsString(), out var utc))
            {
                lastSeen = utc.ToUniversalTime();
                return true;
            }
        }
        return false;
    }
}
