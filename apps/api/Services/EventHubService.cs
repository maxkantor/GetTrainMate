using Amazon.DynamoDBv2;
using Amazon.DynamoDBv2.DocumentModel;
using GetTrainMate.Api.Models;

namespace GetTrainMate.Api.Services;

public class EventHubService : IEventHubService
{
    private const string WorldCupEventId = "world-cup-2026";

    private readonly IAmazonDynamoDB _dynamoDb;
    private readonly ISportsEventLayerService _sportsLayer;
    private readonly ILogger<EventHubService> _logger;
    private readonly string _groupsTable;
    private readonly string _teamsTable;
    private readonly string _matchesTable;
    private readonly string _predictionsTable;
    private readonly string _commentsTable;
    private readonly string _bansTable;

    public EventHubService(
        IAmazonDynamoDB dynamoDb,
        ISportsEventLayerService sportsLayer,
        IConfiguration configuration,
        ILogger<EventHubService> logger)
    {
        _dynamoDb = dynamoDb;
        _sportsLayer = sportsLayer;
        _logger = logger;
        var prefix = configuration["DYNAMODB_TABLE_PREFIX"] ?? "gettrainmate-";
        _groupsTable = configuration["DYNAMODB_TABLE_EVENT_GROUPS"] ?? $"{prefix}event-groups";
        _teamsTable = configuration["DYNAMODB_TABLE_EVENT_TEAMS"] ?? $"{prefix}event-teams";
        _matchesTable = configuration["DYNAMODB_TABLE_EVENT_MATCHES"] ?? $"{prefix}event-matches";
        _predictionsTable = configuration["DYNAMODB_TABLE_EVENT_PREDICTIONS"] ?? $"{prefix}event-predictions";
        _commentsTable = configuration["DYNAMODB_TABLE_EVENT_COMMENTS"] ?? $"{prefix}event-comments";
        _bansTable = configuration["DYNAMODB_TABLE_EVENT_BANS"] ?? $"{prefix}event-bans";
    }

    public bool IsEventEffectivelyEnabled(EventConfig config)
    {
        if (!config.Enabled) return false;
        if (!DateTime.TryParse(config.StartDate, out var start)) return config.Enabled;
        if (!DateTime.TryParse(config.EndDate, out var end)) return config.Enabled;
        var now = DateTime.UtcNow;
        return now >= start && now <= end;
    }

    public EventHubSettings MapSettings(EventConfig config) => new()
    {
        HomepageHeadline = config.HomepageHeadline ?? config.LandingHeadline ?? $"World Cup 2026 Fan Hub",
        HomepageSubheadline = config.HomepageSubheadline ?? "See live groups, make free predictions, share your picks, and connect with fans near you.",
        HomepageCtaPrimary = config.HomepageCtaPrimary ?? "Make Your Free Prediction",
        HomepageCtaSecondary = config.HomepageCtaSecondary ?? "Find Fans Near You",
        HomepagePromoText = config.HomepagePromoText ?? "No betting. No purchase required. Just football fans connecting worldwide.",
        HomepageBackgroundImage = config.HomepageBackgroundImage ?? config.BannerImageUrl,
        HomepageVisible = config.HomepageVisible,
        NavbarVisible = config.NavbarVisible,
        HubRoute = config.HubRoute ?? "/world-cup",
        PredictionsEnabled = config.PredictionsEnabled,
        ExactScoreEnabled = config.ExactScoreEnabled,
        WinnerPickEnabled = config.WinnerPickEnabled,
        DrawPickEnabled = config.DrawPickEnabled,
        CommentsEnabled = config.CommentsEnabled,
        SharingEnabled = config.SharingEnabled,
    };

    public async Task<EventHubSnapshot?> GetHubSnapshotAsync(string eventId, bool allowDisabledForAdmin = false)
    {
        var config = await _sportsLayer.GetEventConfigAsync(eventId);
        if (config == null) return null;
        if (!allowDisabledForAdmin && !IsEventEffectivelyEnabled(config)) return null;

        return new EventHubSnapshot
        {
            Config = config,
            EffectivelyEnabled = IsEventEffectivelyEnabled(config),
            Settings = MapSettings(config),
            Groups = await GetGroupsAsync(eventId),
            Teams = await GetTeamsAsync(eventId),
            Matches = await GetMatchesAsync(eventId),
        };
    }

    public async Task EnsureWorldCupSeedAsync()
    {
        await _sportsLayer.EnsureDefaultSeedDataAsync();

        var existing = await _sportsLayer.GetEventConfigAsync(WorldCupEventId);
        if (existing == null) return;

        var groups = await GetGroupsAsync(WorldCupEventId);
        if (groups.Count > 0) return;

        _logger.LogInformation("Seeding World Cup 2026 Event Hub data");

        var enriched = existing;
        enriched.HubRoute = "/world-cup";
        enriched.HomepageHeadline = "World Cup 2026 Fan Hub";
        enriched.HomepageSubheadline = "See live groups, make free predictions, share your picks, and connect with fans near you.";
        enriched.HomepageCtaPrimary = "Make Your Free Prediction";
        enriched.HomepageCtaSecondary = "Find Fans Near You";
        enriched.HomepagePromoText = "No betting. No purchase required. Just football fans connecting worldwide.";
        enriched.HomepageBackgroundImage = "/images/section-worldcup-bg.png";
        enriched.LandingHeadline = "Predict. Connect. Experience Together.";
        enriched.CtaLabel = "Make Your Free Prediction";
        enriched.ThemeColor = "#6366f1";
        await _sportsLayer.UpsertEventConfigAsync(enriched);

        var wcTeams = GetWorldCupTeamsSeed();
        var groupLetters = new[] { "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L" };
        for (var i = 0; i < groupLetters.Length; i++)
        {
            var letter = groupLetters[i];
            var groupId = $"group-{letter.ToLowerInvariant()}";
            await UpsertGroupAsync(new EventGroup
            {
                EventId = WorldCupEventId,
                GroupId = groupId,
                Label = $"Group {letter}",
                SortOrder = i,
            });

            var groupTeams = wcTeams.Skip(i * 4).Take(4).ToList();
            for (var j = 0; j < groupTeams.Count; j++)
            {
                var (name, country, flag) = groupTeams[j];
                var teamId = Slugify(country);
                await UpsertTeamAsync(new EventTeam
                {
                    EventId = WorldCupEventId,
                    TeamId = teamId,
                    Name = name,
                    Country = country,
                    FlagEmoji = flag,
                    GroupId = groupId,
                    SortOrder = j,
                });
            }
        }

        var allTeams = await GetTeamsAsync(WorldCupEventId);
        var kickoff = new DateTime(2026, 6, 11, 18, 0, 0, DateTimeKind.Utc);
        for (var g = 0; g < groupLetters.Length; g++)
        {
            var groupId = $"group-{groupLetters[g].ToLowerInvariant()}";
            var gt = allTeams.Where(t => t.GroupId == groupId).OrderBy(t => t.SortOrder).ToList();
            if (gt.Count < 2) continue;
            for (var m = 0; m < 2; m++)
            {
                var a = gt[m % gt.Count];
                var b = gt[(m + 1) % gt.Count];
                var matchDate = kickoff.AddDays(g * 2 + m);
                await UpsertMatchAsync(new EventMatch
                {
                    EventId = WorldCupEventId,
                    MatchId = $"match-{groupId}-{m + 1}",
                    TeamAId = a.TeamId,
                    TeamBId = b.TeamId,
                    TeamAName = a.Name,
                    TeamBName = b.Name,
                    TeamAFlag = a.FlagEmoji,
                    TeamBFlag = b.FlagEmoji,
                    MatchDate = matchDate.ToString("yyyy-MM-dd"),
                    MatchTime = matchDate.ToString("HH:mm"),
                    Venue = m == 0 ? "MetLife Stadium" : "SoFi Stadium",
                    Status = EventMatchStatus.Scheduled,
                    GroupId = groupId,
                    Stage = "Group Stage",
                });
            }
        }
    }

    public async Task<List<EventGroup>> GetGroupsAsync(string eventId)
    {
        var all = await QueryEventItemsAsync(_groupsTable, eventId, MapGroup);
        return all.OrderBy(g => g.SortOrder).ToList();
    }

    public async Task<List<EventTeam>> GetTeamsAsync(string eventId, string? groupId = null)
    {
        var all = await QueryEventItemsAsync(_teamsTable, eventId, MapTeam);
        if (!string.IsNullOrWhiteSpace(groupId))
            return all.Where(t => t.GroupId == groupId).OrderBy(t => t.SortOrder).ToList();
        return all.OrderBy(t => t.GroupId).ThenBy(t => t.SortOrder).ToList();
    }

    public async Task<List<EventMatch>> GetMatchesAsync(string eventId, string? date = null)
    {
        var all = await QueryEventItemsAsync(_matchesTable, eventId, MapMatch);
        if (!string.IsNullOrWhiteSpace(date))
            return all.Where(m => m.MatchDate == date).OrderBy(m => m.MatchTime).ToList();
        return all.OrderBy(m => m.MatchDate).ThenBy(m => m.MatchTime).ToList();
    }

    public async Task<List<EventComment>> GetCommentsAsync(string eventId, string threadId)
    {
        var all = await QueryEventItemsAsync(_commentsTable, eventId, MapComment);
        return all
            .Where(c => c.ThreadId == threadId && !c.Deleted && !c.Hidden)
            .OrderBy(c => c.CreatedAt)
            .ToList();
    }

    public async Task<List<EventLeaderboardEntry>> GetLeaderboardAsync(string eventId, string type)
    {
        var analytics = await GetAnalyticsAsync(eventId);
        return type switch
        {
            "active" => analytics.MostActiveFans,
            "shared" => analytics.MostShared,
            _ => analytics.TopPredictors,
        };
    }

    public async Task<EventGroup> UpsertGroupAsync(EventGroup group)
    {
        group.UpdatedAt = DateTime.UtcNow.ToString("O");
        if (string.IsNullOrWhiteSpace(group.CreatedAt)) group.CreatedAt = group.UpdatedAt;
        var table = Table.LoadTable(_dynamoDb, _groupsTable);
        await table.PutItemAsync(GroupToDoc(group));
        return group;
    }

    public async Task DeleteGroupAsync(string eventId, string groupId)
    {
        var table = Table.LoadTable(_dynamoDb, _groupsTable);
        await table.DeleteItemAsync(eventId, groupId);
    }

    public async Task<EventTeam> UpsertTeamAsync(EventTeam team)
    {
        team.GoalDifference = team.GoalsFor - team.GoalsAgainst;
        team.Points = team.Wins * 3 + team.Draws;
        team.UpdatedAt = DateTime.UtcNow.ToString("O");
        if (string.IsNullOrWhiteSpace(team.CreatedAt)) team.CreatedAt = team.UpdatedAt;
        var table = Table.LoadTable(_dynamoDb, _teamsTable);
        await table.PutItemAsync(TeamToDoc(team));
        return team;
    }

    public async Task DeleteTeamAsync(string eventId, string teamId)
    {
        var table = Table.LoadTable(_dynamoDb, _teamsTable);
        await table.DeleteItemAsync(eventId, teamId);
    }

    public async Task<EventMatch> UpsertMatchAsync(EventMatch match)
    {
        match.UpdatedAt = DateTime.UtcNow.ToString("O");
        if (string.IsNullOrWhiteSpace(match.CreatedAt)) match.CreatedAt = match.UpdatedAt;
        var table = Table.LoadTable(_dynamoDb, _matchesTable);
        await table.PutItemAsync(MatchToDoc(match));
        return match;
    }

    public async Task DeleteMatchAsync(string eventId, string matchId)
    {
        var table = Table.LoadTable(_dynamoDb, _matchesTable);
        await table.DeleteItemAsync(eventId, matchId);
    }

    public async Task<EventPrediction?> GetUserPredictionAsync(string eventId, string matchId, string userId)
    {
        var key = PredictionKey(matchId, userId);
        var table = Table.LoadTable(_dynamoDb, _predictionsTable);
        var doc = await table.GetItemAsync(eventId, key);
        return doc == null ? null : MapPrediction(doc);
    }

    public async Task<List<EventPrediction>> GetPredictionsForMatchAsync(string eventId, string matchId)
    {
        var all = await QueryEventItemsAsync(_predictionsTable, eventId, MapPrediction);
        return all.Where(p => p.MatchId == matchId).ToList();
    }

    public async Task<EventPrediction> CreateOrUpdatePredictionAsync(
        string eventId, string userId, string? displayName, CreatePredictionRequest request)
    {
        if (await IsUserBannedAsync(eventId, userId))
            throw new InvalidOperationException("User is banned from this event.");

        var config = await _sportsLayer.GetEventConfigAsync(eventId);
        if (config == null || !IsEventEffectivelyEnabled(config) || !config.PredictionsEnabled)
            throw new InvalidOperationException("Predictions are not enabled.");

        var key = PredictionKey(request.MatchId, userId);
        var existing = await GetUserPredictionAsync(eventId, request.MatchId, userId);
        var pred = existing ?? new EventPrediction
        {
            EventId = eventId,
            PredictionKey = key,
            MatchId = request.MatchId,
            UserId = userId,
            CreatedAt = DateTime.UtcNow.ToString("O"),
        };

        pred.UserDisplayName = displayName;
        pred.PredictionType = request.PredictionType;
        pred.PredictedWinnerTeamId = request.PredictedWinnerTeamId;
        pred.PredictedScoreA = request.PredictedScoreA;
        pred.PredictedScoreB = request.PredictedScoreB;
        pred.Reason = request.Reason;
        pred.UpdatedAt = DateTime.UtcNow.ToString("O");

        var table = Table.LoadTable(_dynamoDb, _predictionsTable);
        await table.PutItemAsync(PredictionToDoc(pred));
        return pred;
    }

    public async Task IncrementPredictionShareAsync(string eventId, string matchId, string userId)
    {
        var pred = await GetUserPredictionAsync(eventId, matchId, userId);
        if (pred == null) return;
        pred.ShareCount++;
        pred.UpdatedAt = DateTime.UtcNow.ToString("O");
        var table = Table.LoadTable(_dynamoDb, _predictionsTable);
        await table.PutItemAsync(PredictionToDoc(pred));
    }

    public async Task<EventComment> CreateCommentAsync(
        string eventId, string userId, string? displayName, CreateCommentRequest request)
    {
        if (await IsUserBannedAsync(eventId, userId))
            throw new InvalidOperationException("User is banned from this event.");

        var config = await _sportsLayer.GetEventConfigAsync(eventId);
        if (config == null || !config.CommentsEnabled)
            throw new InvalidOperationException("Comments are not enabled.");

        var now = DateTime.UtcNow.ToString("O");
        var commentId = Guid.NewGuid().ToString("N")[..8];
        var comment = new EventComment
        {
            EventId = eventId,
            CommentKey = $"{request.ThreadId}#{now}#{commentId}",
            ThreadId = request.ThreadId,
            ThreadType = request.ThreadType,
            UserId = userId,
            UserDisplayName = displayName,
            Body = request.Body.Trim(),
            ParentCommentKey = request.ParentCommentKey,
            CreatedAt = now,
            UpdatedAt = now,
        };

        var table = Table.LoadTable(_dynamoDb, _commentsTable);
        await table.PutItemAsync(CommentToDoc(comment));
        return comment;
    }

    public async Task HideCommentAsync(string eventId, string commentKey)
    {
        var table = Table.LoadTable(_dynamoDb, _commentsTable);
        var doc = await table.GetItemAsync(eventId, commentKey);
        if (doc == null) return;
        var c = MapComment(doc);
        c.Hidden = true;
        c.UpdatedAt = DateTime.UtcNow.ToString("O");
        await table.PutItemAsync(CommentToDoc(c));
    }

    public async Task DeleteCommentAsync(string eventId, string commentKey)
    {
        var table = Table.LoadTable(_dynamoDb, _commentsTable);
        var doc = await table.GetItemAsync(eventId, commentKey);
        if (doc == null) return;
        var c = MapComment(doc);
        c.Deleted = true;
        c.UpdatedAt = DateTime.UtcNow.ToString("O");
        await table.PutItemAsync(CommentToDoc(c));
    }

    public async Task BanUserAsync(string eventId, string userId, string? reason, string? bannedBy)
    {
        var ban = new EventBan
        {
            EventId = eventId,
            UserId = userId,
            Reason = reason,
            BannedBy = bannedBy,
            BannedAt = DateTime.UtcNow.ToString("O"),
        };
        var table = Table.LoadTable(_dynamoDb, _bansTable);
        await table.PutItemAsync(new Document
        {
            ["eventId"] = ban.EventId,
            ["userId"] = ban.UserId,
            ["reason"] = ban.Reason ?? string.Empty,
            ["bannedBy"] = ban.BannedBy ?? string.Empty,
            ["bannedAt"] = ban.BannedAt,
        });
    }

    public async Task<bool> IsUserBannedAsync(string eventId, string userId)
    {
        var table = Table.LoadTable(_dynamoDb, _bansTable);
        var doc = await table.GetItemAsync(eventId, userId);
        return doc != null;
    }

    public async Task<EventHubAnalytics> GetAnalyticsAsync(string eventId)
    {
        var predictions = await QueryEventItemsAsync(_predictionsTable, eventId, MapPrediction);
        var comments = await QueryEventItemsAsync(_commentsTable, eventId, MapComment);
        var matches = await GetMatchesAsync(eventId);
        var teams = await GetTeamsAsync(eventId);

        var completed = matches.Where(m => m.Status == EventMatchStatus.Completed).ToList();
        var predictorScores = new Dictionary<string, EventLeaderboardEntry>();

        foreach (var pred in predictions)
        {
            if (!predictorScores.ContainsKey(pred.UserId))
            {
                predictorScores[pred.UserId] = new EventLeaderboardEntry
                {
                    UserId = pred.UserId,
                    DisplayName = pred.UserDisplayName,
                };
            }
            var entry = predictorScores[pred.UserId];
            entry.PredictionsCount++;
            entry.ShareCount += pred.ShareCount;

            var match = completed.FirstOrDefault(m => m.MatchId == pred.MatchId);
            if (match == null || match.ScoreA == null || match.ScoreB == null) continue;

            var correct = ScorePrediction(pred, match);
            if (correct > 0)
            {
                entry.CorrectCount++;
                entry.Score += correct;
            }
        }

        var commentCounts = comments.Where(c => !c.Deleted)
            .GroupBy(c => c.UserId)
            .ToDictionary(g => g.Key, g => g.Count());

        var topPredictors = predictorScores.Values
            .OrderByDescending(e => e.Score).ThenByDescending(e => e.CorrectCount)
            .Take(20).ToList();

        var mostActive = predictorScores.Values
            .Select(e =>
            {
                e.CommentCount = commentCounts.GetValueOrDefault(e.UserId);
                return e;
            })
            .OrderByDescending(e => e.CommentCount + e.PredictionsCount)
            .Take(20).ToList();

        var mostShared = predictorScores.Values
            .OrderByDescending(e => e.ShareCount)
            .Take(20).ToList();

        var perMatch = predictions.GroupBy(p => p.MatchId)
            .ToDictionary(g => g.Key, g => g.Count());

        var popularTeams = predictions
            .Where(p => !string.IsNullOrWhiteSpace(p.PredictedWinnerTeamId))
            .GroupBy(p => p.PredictedWinnerTeamId!)
            .ToDictionary(g => g.Key, g => g.Count());

        return new EventHubAnalytics
        {
            TotalPredictions = predictions.Count,
            TotalComments = comments.Count(c => !c.Deleted),
            TotalShares = predictions.Sum(p => p.ShareCount),
            UniquePredictors = predictions.Select(p => p.UserId).Distinct().Count(),
            PredictionsPerMatch = perMatch,
            PopularTeams = popularTeams,
            TopPredictors = topPredictors,
            MostActiveFans = mostActive,
            MostShared = mostShared,
        };
    }

    private static int ScorePrediction(EventPrediction pred, EventMatch match)
    {
        if (match.ScoreA == null || match.ScoreB == null) return 0;
        var sa = match.ScoreA.Value;
        var sb = match.ScoreB.Value;

        if (pred.PredictionType == EventPredictionType.ExactScore
            && pred.PredictedScoreA == sa && pred.PredictedScoreB == sb)
            return 3;

        if (pred.PredictionType == EventPredictionType.Draw && sa == sb)
            return 2;

        if (pred.PredictionType == EventPredictionType.Winner)
        {
            var winnerId = sa > sb ? match.TeamAId : sb > sa ? match.TeamBId : null;
            if (winnerId != null && winnerId == pred.PredictedWinnerTeamId)
                return 1;
        }

        return 0;
    }

    private async Task<List<T>> QueryEventItemsAsync<T>(string tableName, string eventId, Func<Document, T> mapper)
    {
        try
        {
            var table = Table.LoadTable(_dynamoDb, tableName);
            var filter = new ScanFilter();
            filter.AddCondition("eventId", ScanOperator.Equal, eventId);
            var search = table.Scan(filter);
            var output = new List<T>();
            do
            {
                var rows = await search.GetNextSetAsync();
                output.AddRange(rows.Select(mapper));
            } while (!search.IsDone);
            return output;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Scan failed for {Table} eventId={EventId}", tableName, eventId);
            return new List<T>();
        }
    }

    private static string PredictionKey(string matchId, string userId) => $"{matchId}#{userId}";

    private static string Slugify(string s) =>
        s.ToLowerInvariant().Replace(" ", "-").Replace("'", "");

    private static List<(string Name, string Country, string Flag)> GetWorldCupTeamsSeed() => new()
    {
        ("United States", "USA", "🇺🇸"), ("Mexico", "Mexico", "🇲🇽"), ("Canada", "Canada", "🇨🇦"), ("Brazil", "Brazil", "🇧🇷"),
        ("Argentina", "Argentina", "🇦🇷"), ("Uruguay", "Uruguay", "🇺🇾"), ("Colombia", "Colombia", "🇨🇴"), ("Chile", "Chile", "🇨🇱"),
        ("England", "England", "🏴󠁧󠁢󠁥󠁮󠁧󠁿"), ("France", "France", "🇫🇷"), ("Germany", "Germany", "🇩🇪"), ("Spain", "Spain", "🇪🇸"),
        ("Italy", "Italy", "🇮🇹"), ("Netherlands", "Netherlands", "🇳🇱"), ("Portugal", "Portugal", "🇵🇹"), ("Belgium", "Belgium", "🇧🇪"),
        ("Croatia", "Croatia", "🇭🇷"), ("Serbia", "Serbia", "🇷🇸"), ("Poland", "Poland", "🇵🇱"), ("Switzerland", "Switzerland", "🇨🇭"),
        ("Japan", "Japan", "🇯🇵"), ("South Korea", "South Korea", "🇰🇷"), ("Australia", "Australia", "🇦🇺"), ("Saudi Arabia", "Saudi Arabia", "🇸🇦"),
        ("Morocco", "Morocco", "🇲🇦"), ("Senegal", "Senegal", "🇸🇳"), ("Nigeria", "Nigeria", "🇳🇬"), ("Ghana", "Ghana", "🇬🇭"),
        ("Ecuador", "Ecuador", "🇪🇨"), ("Peru", "Peru", "🇵🇪"), ("Costa Rica", "Costa Rica", "🇨🇷"), ("Panama", "Panama", "🇵🇦"),
        ("Denmark", "Denmark", "🇩🇰"), ("Sweden", "Sweden", "🇸🇪"), ("Norway", "Norway", "🇳🇴"), ("Wales", "Wales", "🏴󠁧󠁢󠁷󠁬󠁳󠁿"),
        ("Iran", "Iran", "🇮🇷"), ("Qatar", "Qatar", "🇶🇦"), ("Tunisia", "Tunisia", "🇹🇳"), ("Cameroon", "Cameroon", "🇨🇲"),
        ("Ukraine", "Ukraine", "🇺🇦"), ("Turkey", "Turkey", "🇹🇷"), ("Austria", "Austria", "🇦🇹"), ("Czech Republic", "Czech Republic", "🇨🇿"),
        ("Scotland", "Scotland", "🏴󠁧󠁢󠁳󠁣󠁴󠁿"), ("Paraguay", "Paraguay", "🇵🇾"), ("Jamaica", "Jamaica", "🇯🇲"), ("Honduras", "Honduras", "🇭🇳"),
    };

    private static Document GroupToDoc(EventGroup g) => new()
    {
        ["eventId"] = g.EventId, ["groupId"] = g.GroupId, ["label"] = g.Label,
        ["sortOrder"] = g.SortOrder, ["createdAt"] = g.CreatedAt, ["updatedAt"] = g.UpdatedAt,
    };

    private static Document TeamToDoc(EventTeam t) => new()
    {
        ["eventId"] = t.EventId, ["teamId"] = t.TeamId, ["name"] = t.Name, ["country"] = t.Country,
        ["flagEmoji"] = t.FlagEmoji, ["groupId"] = t.GroupId, ["description"] = t.Description ?? "",
        ["sortOrder"] = t.SortOrder, ["played"] = t.Played, ["wins"] = t.Wins, ["draws"] = t.Draws,
        ["losses"] = t.Losses, ["goalsFor"] = t.GoalsFor, ["goalsAgainst"] = t.GoalsAgainst,
        ["goalDifference"] = t.GoalDifference, ["points"] = t.Points,
        ["createdAt"] = t.CreatedAt, ["updatedAt"] = t.UpdatedAt,
    };

    private static Document MatchToDoc(EventMatch m) => new()
    {
        ["eventId"] = m.EventId, ["matchId"] = m.MatchId, ["teamAId"] = m.TeamAId, ["teamBId"] = m.TeamBId,
        ["teamAName"] = m.TeamAName ?? "", ["teamBName"] = m.TeamBName ?? "",
        ["teamAFlag"] = m.TeamAFlag ?? "", ["teamBFlag"] = m.TeamBFlag ?? "",
        ["matchDate"] = m.MatchDate, ["matchTime"] = m.MatchTime ?? "", ["venue"] = m.Venue,
        ["status"] = m.Status, ["scoreA"] = m.ScoreA ?? -1, ["scoreB"] = m.ScoreB ?? -1,
        ["groupId"] = m.GroupId ?? "", ["stage"] = m.Stage ?? "",
        ["createdAt"] = m.CreatedAt, ["updatedAt"] = m.UpdatedAt,
    };

    private static Document PredictionToDoc(EventPrediction p) => new()
    {
        ["eventId"] = p.EventId, ["predictionKey"] = p.PredictionKey, ["matchId"] = p.MatchId,
        ["userId"] = p.UserId, ["userDisplayName"] = p.UserDisplayName ?? "",
        ["predictionType"] = p.PredictionType, ["predictedWinnerTeamId"] = p.PredictedWinnerTeamId ?? "",
        ["predictedScoreA"] = p.PredictedScoreA ?? -1, ["predictedScoreB"] = p.PredictedScoreB ?? -1,
        ["reason"] = p.Reason ?? "", ["shareCount"] = p.ShareCount,
        ["createdAt"] = p.CreatedAt, ["updatedAt"] = p.UpdatedAt,
    };

    private static Document CommentToDoc(EventComment c) => new()
    {
        ["eventId"] = c.EventId, ["commentKey"] = c.CommentKey, ["threadId"] = c.ThreadId,
        ["threadType"] = c.ThreadType, ["userId"] = c.UserId, ["userDisplayName"] = c.UserDisplayName ?? "",
        ["body"] = c.Body, ["parentCommentKey"] = c.ParentCommentKey ?? "",
        ["hidden"] = c.Hidden, ["deleted"] = c.Deleted,
        ["createdAt"] = c.CreatedAt, ["updatedAt"] = c.UpdatedAt,
    };

    private static EventGroup MapGroup(Document d) => new()
    {
        EventId = d["eventId"].AsString(), GroupId = d["groupId"].AsString(),
        Label = d.ContainsKey("label") ? d["label"].AsString() : "",
        SortOrder = d.ContainsKey("sortOrder") ? (int)d["sortOrder"].AsLong() : 0,
        CreatedAt = d.ContainsKey("createdAt") ? d["createdAt"].AsString() : "",
        UpdatedAt = d.ContainsKey("updatedAt") ? d["updatedAt"].AsString() : "",
    };

    private static EventTeam MapTeam(Document d) => new()
    {
        EventId = d["eventId"].AsString(), TeamId = d["teamId"].AsString(),
        Name = d.ContainsKey("name") ? d["name"].AsString() : "",
        Country = d.ContainsKey("country") ? d["country"].AsString() : "",
        FlagEmoji = d.ContainsKey("flagEmoji") ? d["flagEmoji"].AsString() : "",
        GroupId = d.ContainsKey("groupId") ? d["groupId"].AsString() : "",
        Description = d.ContainsKey("description") ? d["description"].AsString() : null,
        SortOrder = d.ContainsKey("sortOrder") ? (int)d["sortOrder"].AsLong() : 0,
        Played = d.ContainsKey("played") ? (int)d["played"].AsLong() : 0,
        Wins = d.ContainsKey("wins") ? (int)d["wins"].AsLong() : 0,
        Draws = d.ContainsKey("draws") ? (int)d["draws"].AsLong() : 0,
        Losses = d.ContainsKey("losses") ? (int)d["losses"].AsLong() : 0,
        GoalsFor = d.ContainsKey("goalsFor") ? (int)d["goalsFor"].AsLong() : 0,
        GoalsAgainst = d.ContainsKey("goalsAgainst") ? (int)d["goalsAgainst"].AsLong() : 0,
        GoalDifference = d.ContainsKey("goalDifference") ? (int)d["goalDifference"].AsLong() : 0,
        Points = d.ContainsKey("points") ? (int)d["points"].AsLong() : 0,
        CreatedAt = d.ContainsKey("createdAt") ? d["createdAt"].AsString() : "",
        UpdatedAt = d.ContainsKey("updatedAt") ? d["updatedAt"].AsString() : "",
    };

    private static EventMatch MapMatch(Document d)
    {
        var scoreA = d.ContainsKey("scoreA") ? (int)d["scoreA"].AsLong() : -1;
        var scoreB = d.ContainsKey("scoreB") ? (int)d["scoreB"].AsLong() : -1;
        return new EventMatch
        {
            EventId = d["eventId"].AsString(), MatchId = d["matchId"].AsString(),
            TeamAId = d.ContainsKey("teamAId") ? d["teamAId"].AsString() : "",
            TeamBId = d.ContainsKey("teamBId") ? d["teamBId"].AsString() : "",
            TeamAName = d.ContainsKey("teamAName") ? d["teamAName"].AsString() : null,
            TeamBName = d.ContainsKey("teamBName") ? d["teamBName"].AsString() : null,
            TeamAFlag = d.ContainsKey("teamAFlag") ? d["teamAFlag"].AsString() : null,
            TeamBFlag = d.ContainsKey("teamBFlag") ? d["teamBFlag"].AsString() : null,
            MatchDate = d.ContainsKey("matchDate") ? d["matchDate"].AsString() : "",
            MatchTime = d.ContainsKey("matchTime") ? d["matchTime"].AsString() : null,
            Venue = d.ContainsKey("venue") ? d["venue"].AsString() : "",
            Status = d.ContainsKey("status") ? d["status"].AsString() : EventMatchStatus.Scheduled,
            ScoreA = scoreA >= 0 ? scoreA : null,
            ScoreB = scoreB >= 0 ? scoreB : null,
            GroupId = d.ContainsKey("groupId") ? d["groupId"].AsString() : null,
            Stage = d.ContainsKey("stage") ? d["stage"].AsString() : null,
            CreatedAt = d.ContainsKey("createdAt") ? d["createdAt"].AsString() : "",
            UpdatedAt = d.ContainsKey("updatedAt") ? d["updatedAt"].AsString() : "",
        };
    }

    private static EventPrediction MapPrediction(Document d)
    {
        var sa = d.ContainsKey("predictedScoreA") ? (int)d["predictedScoreA"].AsLong() : -1;
        var sb = d.ContainsKey("predictedScoreB") ? (int)d["predictedScoreB"].AsLong() : -1;
        return new EventPrediction
        {
            EventId = d["eventId"].AsString(), PredictionKey = d["predictionKey"].AsString(),
            MatchId = d.ContainsKey("matchId") ? d["matchId"].AsString() : "",
            UserId = d.ContainsKey("userId") ? d["userId"].AsString() : "",
            UserDisplayName = d.ContainsKey("userDisplayName") ? d["userDisplayName"].AsString() : null,
            PredictionType = d.ContainsKey("predictionType") ? d["predictionType"].AsString() : "",
            PredictedWinnerTeamId = d.ContainsKey("predictedWinnerTeamId") ? d["predictedWinnerTeamId"].AsString() : null,
            PredictedScoreA = sa >= 0 ? sa : null,
            PredictedScoreB = sb >= 0 ? sb : null,
            Reason = d.ContainsKey("reason") ? d["reason"].AsString() : null,
            ShareCount = d.ContainsKey("shareCount") ? (int)d["shareCount"].AsLong() : 0,
            CreatedAt = d.ContainsKey("createdAt") ? d["createdAt"].AsString() : "",
            UpdatedAt = d.ContainsKey("updatedAt") ? d["updatedAt"].AsString() : "",
        };
    }

    private static EventComment MapComment(Document d) => new()
    {
        EventId = d["eventId"].AsString(), CommentKey = d["commentKey"].AsString(),
        ThreadId = d.ContainsKey("threadId") ? d["threadId"].AsString() : "",
        ThreadType = d.ContainsKey("threadType") ? d["threadType"].AsString() : "match",
        UserId = d.ContainsKey("userId") ? d["userId"].AsString() : "",
        UserDisplayName = d.ContainsKey("userDisplayName") ? d["userDisplayName"].AsString() : null,
        Body = d.ContainsKey("body") ? d["body"].AsString() : "",
        ParentCommentKey = d.ContainsKey("parentCommentKey") ? d["parentCommentKey"].AsString() : null,
        Hidden = d.ContainsKey("hidden") && d["hidden"].AsBoolean(),
        Deleted = d.ContainsKey("deleted") && d["deleted"].AsBoolean(),
        CreatedAt = d.ContainsKey("createdAt") ? d["createdAt"].AsString() : "",
        UpdatedAt = d.ContainsKey("updatedAt") ? d["updatedAt"].AsString() : "",
    };
}
