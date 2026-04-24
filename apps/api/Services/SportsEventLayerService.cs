using Amazon.DynamoDBv2;
using Amazon.DynamoDBv2.DocumentModel;
using GetTrainMate.Api.Models;

namespace GetTrainMate.Api.Services;

public class SportsEventLayerService : ISportsEventLayerService
{
    private static readonly string[] RequiredFlags =
    {
        "sports_event_layer",
        "event_boosts",
        "event_watch_parties",
        "event_profile_badges",
        "event_credit_prompts",
    };

    private readonly IAmazonDynamoDB _dynamoDb;
    private readonly ILogger<SportsEventLayerService> _logger;
    private readonly string _flagsTable;
    private readonly string _configsTable;
    private readonly string _meetupsTable;

    public SportsEventLayerService(IAmazonDynamoDB dynamoDb, IConfiguration configuration, ILogger<SportsEventLayerService> logger)
    {
        _dynamoDb = dynamoDb;
        _logger = logger;
        var prefix = configuration["DYNAMODB_TABLE_PREFIX"] ?? "gettrainmate-";
        _flagsTable = configuration["DYNAMODB_TABLE_FEATURE_FLAGS"] ?? $"{prefix}feature-flags";
        _configsTable = configuration["DYNAMODB_TABLE_EVENT_CONFIGS"] ?? $"{prefix}event-configs";
        _meetupsTable = configuration["DYNAMODB_TABLE_EVENT_MEETUPS"] ?? $"{prefix}event-meetups";
    }

    public async Task EnsureDefaultSeedDataAsync()
    {
        foreach (var flag in RequiredFlags)
        {
            await UpsertIfMissingFlagAsync(flag);
        }

        var existing = await GetEventConfigAsync("world-cup-2026");
        if (existing != null) return;

        await UpsertEventConfigAsync(new EventConfig
        {
            EventId = "world-cup-2026",
            Name = "FIFA World Cup 2026",
            Label = "World Cup 2026",
            Sport = "Soccer",
            Enabled = false,
            IsFeatured = false,
            StartDate = "2026-06-01T00:00:00Z",
            EndDate = "2026-08-01T00:00:00Z",
            Icon = "⚽",
            LandingHeadline = "Find your World Cup crew and make every matchday unforgettable.",
            Description = "GetTrainMate is an independent platform and is not affiliated with or endorsed by any league, club, federation, or event organizer.",
            Activities = new List<string> { "train", "play", "watch", "meet", "vibe", "date" },
            Tags = new List<string> { "soccer", "football", "world cup", "watch party", "pickup soccer" },
            Teams = new List<string> { "USA", "England", "Brazil", "Argentina", "France", "Germany", "Spain", "Portugal", "Mexico", "Italy", "Netherlands", "Chelsea FC" },
        });
    }

    public async Task<Dictionary<string, bool>> GetFeatureFlagsAsync(string environment, bool allowLocalOverrides)
    {
        var result = RequiredFlags.ToDictionary(k => k, _ => false);
        try
        {
            var table = Table.LoadTable(_dynamoDb, _flagsTable);
            var search = table.Scan(new ScanFilter());
            do
            {
                var rows = await search.GetNextSetAsync();
                foreach (var row in rows)
                {
                    var key = row.ContainsKey("flagKey") ? row["flagKey"].AsString() : "";
                    if (string.IsNullOrWhiteSpace(key) || !result.ContainsKey(key)) continue;
                    var rowEnv = row.ContainsKey("environment") ? row["environment"].AsString() : "prod";
                    if (!string.Equals(rowEnv, environment, StringComparison.OrdinalIgnoreCase)) continue;
                    result[key] = row.ContainsKey("enabled") && row["enabled"].AsBoolean();
                }
            } while (!search.IsDone);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Feature flags failed to load, using all false");
        }

        if (allowLocalOverrides && !string.Equals(environment, "prod", StringComparison.OrdinalIgnoreCase))
        {
            _logger.LogInformation("Sports Event Layer loaded in local/dev mode");
        }
        return result;
    }

    public async Task<FeatureFlag> UpsertFeatureFlagAsync(FeatureFlag flag)
    {
        flag.UpdatedAt = DateTime.UtcNow.ToString("O");
        var table = Table.LoadTable(_dynamoDb, _flagsTable);
        await table.PutItemAsync(new Document
        {
            ["flagKey"] = flag.FlagKey,
            ["enabled"] = flag.Enabled,
            ["environment"] = flag.Environment,
            ["description"] = flag.Description,
            ["updatedAt"] = flag.UpdatedAt,
            ["updatedBy"] = flag.UpdatedBy ?? string.Empty,
        });
        return flag;
    }

    public async Task<List<EventConfig>> GetAllEventConfigsAsync()
    {
        var table = Table.LoadTable(_dynamoDb, _configsTable);
        var search = table.Scan(new ScanFilter());
        var output = new List<EventConfig>();
        do
        {
            var rows = await search.GetNextSetAsync();
            output.AddRange(rows.Select(MapEventConfig));
        } while (!search.IsDone);
        return output.OrderByDescending(e => e.UpdatedAt).ToList();
    }

    public async Task<List<EventConfig>> GetActiveEventConfigsAsync(bool allowDisabledForAdmin = false)
    {
        var now = DateTime.UtcNow;
        var all = await GetAllEventConfigsAsync();
        return all.Where(e =>
        {
            if (!allowDisabledForAdmin && !e.Enabled) return false;
            if (!DateTime.TryParse(e.StartDate, out var start)) return false;
            if (!DateTime.TryParse(e.EndDate, out var end)) return false;
            return now >= start && now <= end;
        }).ToList();
    }

    public async Task<EventConfig?> GetEventConfigAsync(string eventId)
    {
        var table = Table.LoadTable(_dynamoDb, _configsTable);
        var doc = await table.GetItemAsync(eventId);
        return doc == null ? null : MapEventConfig(doc);
    }

    public async Task<EventConfig> UpsertEventConfigAsync(EventConfig config)
    {
        config.UpdatedAt = DateTime.UtcNow.ToString("O");
        config.Name = string.IsNullOrWhiteSpace(config.Name) ? config.Label : config.Name;
        config.Icon = string.IsNullOrWhiteSpace(config.Icon) ? "🏅" : config.Icon;
        config.Activities = config.Activities?.Where(x => !string.IsNullOrWhiteSpace(x)).Select(x => x.Trim().ToLowerInvariant()).Distinct().ToList() ?? new List<string>();
        config.Tags = config.Tags?.Where(x => !string.IsNullOrWhiteSpace(x)).Select(x => x.Trim()).Distinct().ToList() ?? new List<string>();
        config.Teams = config.Teams?.Where(x => !string.IsNullOrWhiteSpace(x)).Select(x => x.Trim()).Distinct().ToList();
        config.Locations = config.Locations?.Where(x => !string.IsNullOrWhiteSpace(x)).Select(x => x.Trim()).Distinct().ToList();
        config.BannerImageUrl = string.IsNullOrWhiteSpace(config.BannerImageUrl) ? null : config.BannerImageUrl.Trim();
        config.LandingHeadline = string.IsNullOrWhiteSpace(config.LandingHeadline) ? null : config.LandingHeadline.Trim();

        if (string.IsNullOrWhiteSpace(config.CreatedAt))
        {
            config.CreatedAt = config.UpdatedAt;
        }

        if (config.IsFeatured)
        {
            var allEvents = await GetAllEventConfigsAsync();
            var featuredEvents = allEvents
                .Where(x => x.IsFeatured && !string.Equals(x.EventId, config.EventId, StringComparison.OrdinalIgnoreCase))
                .ToList();
            foreach (var featured in featuredEvents)
            {
                featured.IsFeatured = false;
                featured.UpdatedAt = config.UpdatedAt;
                await SaveEventDocumentAsync(featured);
            }
        }

        await SaveEventDocumentAsync(config);
        return config;
    }

    private async Task SaveEventDocumentAsync(EventConfig config)
    {
        var table = Table.LoadTable(_dynamoDb, _configsTable);
        await table.PutItemAsync(new Document
        {
            ["eventId"] = config.EventId,
            ["name"] = config.Name,
            ["label"] = config.Label,
            ["sport"] = config.Sport,
            ["enabled"] = config.Enabled,
            ["isFeatured"] = config.IsFeatured,
            ["startDate"] = config.StartDate,
            ["endDate"] = config.EndDate,
            ["icon"] = config.Icon,
            ["themeColor"] = config.ThemeColor ?? string.Empty,
            ["bannerImageUrl"] = config.BannerImageUrl ?? string.Empty,
            ["landingHeadline"] = config.LandingHeadline ?? string.Empty,
            ["description"] = config.Description,
            ["activities"] = new DynamoDBList(config.Activities.Select(x => new Primitive(x))),
            ["tags"] = new DynamoDBList(config.Tags.Select(x => new Primitive(x))),
            ["teams"] = new DynamoDBList((config.Teams ?? new List<string>()).Select(x => new Primitive(x))),
            ["locations"] = new DynamoDBList((config.Locations ?? new List<string>()).Select(x => new Primitive(x))),
            ["boostEnabled"] = config.BoostEnabled,
            ["boostPrice"] = config.BoostPrice ?? 0,
            ["boostLabel"] = config.BoostLabel ?? string.Empty,
            ["stripePriceIdDev"] = config.StripePriceIdDev ?? string.Empty,
            ["stripePriceIdProd"] = config.StripePriceIdProd ?? string.Empty,
            ["createdAt"] = config.CreatedAt,
            ["updatedAt"] = config.UpdatedAt,
        });
    }

    public async Task<List<EventMeetup>> GetMeetupsForEventAsync(string eventId)
    {
        var table = Table.LoadTable(_dynamoDb, _meetupsTable);
        var filter = new ScanFilter();
        filter.AddCondition("eventId", ScanOperator.Equal, eventId);
        filter.AddCondition("status", ScanOperator.Equal, "active");
        var search = table.Scan(filter);
        var rows = await search.GetNextSetAsync();
        return rows.Select(MapMeetup).ToList();
    }

    public async Task<EventMeetup> CreateMeetupAsync(EventMeetup meetup)
    {
        meetup.UpdatedAt = DateTime.UtcNow.ToString("O");
        meetup.CreatedAt = meetup.UpdatedAt;
        var table = Table.LoadTable(_dynamoDb, _meetupsTable);
        await table.PutItemAsync(new Document
        {
            ["meetupId"] = meetup.MeetupId,
            ["eventId"] = meetup.EventId,
            ["title"] = meetup.Title,
            ["activityType"] = meetup.ActivityType,
            ["sport"] = meetup.Sport,
            ["team"] = meetup.Team ?? string.Empty,
            ["locationText"] = meetup.LocationText,
            ["city"] = meetup.City ?? string.Empty,
            ["state"] = meetup.State ?? string.Empty,
            ["startTime"] = meetup.StartTime ?? string.Empty,
            ["createdByUserId"] = meetup.CreatedByUserId,
            ["visibility"] = meetup.Visibility,
            ["status"] = meetup.Status,
            ["createdAt"] = meetup.CreatedAt,
            ["updatedAt"] = meetup.UpdatedAt,
        });
        return meetup;
    }

    private async Task UpsertIfMissingFlagAsync(string key)
    {
        var table = Table.LoadTable(_dynamoDb, _flagsTable);
        var doc = await table.GetItemAsync(key);
        if (doc != null) return;
        await UpsertFeatureFlagAsync(new FeatureFlag
        {
            FlagKey = key,
            Enabled = false,
            Environment = "prod",
            Description = $"Default flag for {key}",
        });
    }

    private static EventConfig MapEventConfig(Document doc) => new()
    {
        EventId = doc.ContainsKey("eventId") ? doc["eventId"].AsString() : string.Empty,
        Name = doc.ContainsKey("name") ? doc["name"].AsString() : string.Empty,
        Label = doc.ContainsKey("label") ? doc["label"].AsString() : string.Empty,
        Sport = doc.ContainsKey("sport") ? doc["sport"].AsString() : string.Empty,
        Enabled = doc.ContainsKey("enabled") && doc["enabled"].AsBoolean(),
        IsFeatured = doc.ContainsKey("isFeatured") && doc["isFeatured"].AsBoolean(),
        StartDate = doc.ContainsKey("startDate") ? doc["startDate"].AsString() : string.Empty,
        EndDate = doc.ContainsKey("endDate") ? doc["endDate"].AsString() : string.Empty,
        Icon = doc.ContainsKey("icon") ? doc["icon"].AsString() : "🏅",
        ThemeColor = doc.ContainsKey("themeColor") ? doc["themeColor"].AsString() : null,
        BannerImageUrl = doc.ContainsKey("bannerImageUrl") ? doc["bannerImageUrl"].AsString() : null,
        LandingHeadline = doc.ContainsKey("landingHeadline") ? doc["landingHeadline"].AsString() : null,
        Description = doc.ContainsKey("description") ? doc["description"].AsString() : string.Empty,
        Activities = doc.ContainsKey("activities") ? doc["activities"].AsListOfString() : new List<string>(),
        Tags = doc.ContainsKey("tags") ? doc["tags"].AsListOfString() : new List<string>(),
        Teams = doc.ContainsKey("teams") ? doc["teams"].AsListOfString() : new List<string>(),
        Locations = doc.ContainsKey("locations") ? doc["locations"].AsListOfString() : new List<string>(),
        BoostEnabled = doc.ContainsKey("boostEnabled") && doc["boostEnabled"].AsBoolean(),
        BoostPrice = doc.ContainsKey("boostPrice") ? doc["boostPrice"].AsDouble() : null,
        BoostLabel = doc.ContainsKey("boostLabel") ? doc["boostLabel"].AsString() : null,
        StripePriceIdDev = doc.ContainsKey("stripePriceIdDev") ? doc["stripePriceIdDev"].AsString() : null,
        StripePriceIdProd = doc.ContainsKey("stripePriceIdProd") ? doc["stripePriceIdProd"].AsString() : null,
        CreatedAt = doc.ContainsKey("createdAt") ? doc["createdAt"].AsString() : DateTime.UtcNow.ToString("O"),
        UpdatedAt = doc.ContainsKey("updatedAt") ? doc["updatedAt"].AsString() : DateTime.UtcNow.ToString("O"),
    };

    private static EventMeetup MapMeetup(Document doc) => new()
    {
        MeetupId = doc.ContainsKey("meetupId") ? doc["meetupId"].AsString() : string.Empty,
        EventId = doc.ContainsKey("eventId") ? doc["eventId"].AsString() : string.Empty,
        Title = doc.ContainsKey("title") ? doc["title"].AsString() : string.Empty,
        ActivityType = doc.ContainsKey("activityType") ? doc["activityType"].AsString() : "watch",
        Sport = doc.ContainsKey("sport") ? doc["sport"].AsString() : string.Empty,
        Team = doc.ContainsKey("team") ? doc["team"].AsString() : null,
        LocationText = doc.ContainsKey("locationText") ? doc["locationText"].AsString() : string.Empty,
        City = doc.ContainsKey("city") ? doc["city"].AsString() : null,
        State = doc.ContainsKey("state") ? doc["state"].AsString() : null,
        StartTime = doc.ContainsKey("startTime") ? doc["startTime"].AsString() : null,
        CreatedByUserId = doc.ContainsKey("createdByUserId") ? doc["createdByUserId"].AsString() : string.Empty,
        Visibility = doc.ContainsKey("visibility") ? doc["visibility"].AsString() : "public",
        Status = doc.ContainsKey("status") ? doc["status"].AsString() : "active",
        CreatedAt = doc.ContainsKey("createdAt") ? doc["createdAt"].AsString() : DateTime.UtcNow.ToString("O"),
        UpdatedAt = doc.ContainsKey("updatedAt") ? doc["updatedAt"].AsString() : DateTime.UtcNow.ToString("O"),
    };
}
