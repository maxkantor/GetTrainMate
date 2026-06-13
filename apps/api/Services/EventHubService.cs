using Amazon.DynamoDBv2;
using Amazon.DynamoDBv2.DocumentModel;
using GetTrainMate.Api.Data;
using GetTrainMate.Api.Models;

namespace GetTrainMate.Api.Services;

public class EventHubService : IEventHubService
{
    private const string WorldCupEventId = "world-cup-2026";

    private readonly IAmazonDynamoDB _dynamoDb;
    private readonly ISportsEventLayerService _sportsLayer;
    private readonly IProfileService _profiles;
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
        IProfileService profiles,
        IConfiguration configuration,
        ILogger<EventHubService> logger)
    {
        _dynamoDb = dynamoDb;
        _sportsLayer = sportsLayer;
        _profiles = profiles;
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
        StandingsEnabled = config.StandingsEnabled,
        StandingsPublished = config.StandingsPublished,
        MatchIntelligenceEnabled = config.MatchIntelligenceEnabled,
        FanFeedEnabled = config.FanFeedEnabled,
    };

    public async Task<EventHubSnapshot?> GetHubSnapshotAsync(string eventId, bool allowDisabledForAdmin = false)
    {
        var config = await _sportsLayer.GetEventConfigAsync(eventId);
        if (config == null) return null;
        if (!allowDisabledForAdmin && !IsEventEffectivelyEnabled(config)) return null;

        if (string.Equals(eventId, WorldCupEventId, StringComparison.OrdinalIgnoreCase))
        {
            await ApplyOfficialKickoffsAsync();
            await ApplyOfficialCompletedResultsAsync();
            await RecalculateStandingsAsync(eventId);
        }

        var matches = await GetMatchesAsync(eventId);
        return new EventHubSnapshot
        {
            Config = config,
            EffectivelyEnabled = IsEventEffectivelyEnabled(config),
            Settings = MapSettings(config),
            Groups = await GetGroupsAsync(eventId),
            Teams = await GetTeamsAsync(eventId),
            Matches = matches,
            FixturesLastUpdatedAt = ResolveFixturesLastUpdatedAt(config, matches),
        };
    }

    /// <summary>Bootstrap group scores from catalog when DynamoDB is still scheduled or in-play.</summary>
    private async Task ApplyOfficialCompletedResultsAsync()
    {
        var resultByPair = WorldCupOfficialFixtures.ScoreOverrides
            .ToDictionary(
                r => EventMatchRules.NormalizePairKey(r.TeamAId, r.TeamBId),
                r => r,
                StringComparer.OrdinalIgnoreCase);
        if (resultByPair.Count == 0) return;

        var matches = await QueryEventItemsAsync(_matchesTable, WorldCupEventId, MapMatch);
        var changed = false;
        foreach (var match in matches.Where(m => !string.IsNullOrWhiteSpace(m.GroupId)))
        {
            var key = EventMatchRules.NormalizePairKey(match.TeamAId, match.TeamBId);
            if (!resultByPair.TryGetValue(key, out var official)) continue;

            var teamAIsCatalogA = string.Equals(match.TeamAId, official.TeamAId, StringComparison.OrdinalIgnoreCase);
            var scoreA = teamAIsCatalogA ? official.ScoreA : official.ScoreB;
            var scoreB = teamAIsCatalogA ? official.ScoreB : official.ScoreA;

            if (!EventMatchRules.ShouldApplyOfficialScoreOverride(match, official.Status, scoreA, scoreB))
                continue;

            match.Status = official.Status;
            match.ScoreA = scoreA;
            match.ScoreB = scoreB;
            await UpsertMatchAsync(match, touchTimestamp: false, skipDuplicateCheck: true);
            changed = true;
        }

        if (changed)
            await TouchFixturesTimestampAsync(WorldCupEventId);
    }

    /// <summary>Bootstrap config, purge legacy fake seed data once, sync official opening fixtures.</summary>
    public async Task EnsureWorldCupSeedAsync()
    {
        await _sportsLayer.EnsureDefaultSeedDataAsync();

        var existing = await _sportsLayer.GetEventConfigAsync(WorldCupEventId);
        if (existing == null) return;

        if (string.IsNullOrWhiteSpace(existing.HubRoute))
        {
            existing.HubRoute = "/world-cup";
            existing.HomepageHeadline = "PREDICT. CONNECT. EXPERIENCE THE WORLD CUP TOGETHER.";
            existing.HomepageSubheadline =
                "Make free predictions, debate matches, follow your favorite teams, and connect with fans near you.";
            existing.HomepageCtaPrimary = "Make Free Prediction";
            existing.HomepageCtaSecondary = "Find Fans Near You";
            existing.HomepagePromoText = "Free fan predictions — no betting, no purchase required.";
            existing.HomepageBackgroundImage = "/images/section-worldcup-bg.png";
            existing.LandingHeadline = "Predict. Connect. Experience Together.";
            existing.CtaLabel = "Make Free Prediction";
            existing.ThemeColor = "#6366f1";
        }

        if (!existing.LegacySeedPurged)
        {
            _logger.LogWarning("Purging legacy World Cup fake seed data from DynamoDB");
            foreach (var group in await GetGroupsAsync(WorldCupEventId))
                await DeleteGroupAsync(WorldCupEventId, group.GroupId);
            foreach (var team in await GetTeamsAsync(WorldCupEventId))
                await DeleteTeamAsync(WorldCupEventId, team.TeamId);
            foreach (var match in await QueryEventItemsAsync(_matchesTable, WorldCupEventId, MapMatch))
                await DeleteMatchAsync(WorldCupEventId, match.MatchId);
            existing.LegacySeedPurged = true;
        }

        await SyncOfficialWorldCupCatalogAsync();
        await RecalculateStandingsAsync(WorldCupEventId);
        var groups = await GetGroupsAsync(WorldCupEventId);
        var teams = await GetTeamsAsync(WorldCupEventId);
        if (groups.Count > 0 && teams.Any(t => !string.IsNullOrWhiteSpace(t.GroupId)))
        {
            existing.StandingsEnabled = true;
            existing.StandingsPublished = true;
        }

        existing.FixturesLastUpdatedAt = DateTime.UtcNow.ToString("O");
        await _sportsLayer.UpsertEventConfigAsync(existing);
    }

    private async Task SyncOfficialWorldCupCatalogAsync()
    {
        foreach (var official in WorldCupOfficialFixtures.Groups)
        {
            await UpsertGroupAsync(new EventGroup
            {
                EventId = WorldCupEventId,
                GroupId = official.GroupId,
                Label = official.Label,
                SortOrder = official.SortOrder,
            });
        }

        var existingTeams = (await GetTeamsAsync(WorldCupEventId))
            .ToDictionary(t => t.TeamId, StringComparer.OrdinalIgnoreCase);
        foreach (var official in WorldCupOfficialFixtures.Teams)
        {
            existingTeams.TryGetValue(official.TeamId, out var prior);
            await UpsertTeamAsync(new EventTeam
            {
                EventId = WorldCupEventId,
                TeamId = official.TeamId,
                Name = official.Name,
                Country = official.Country,
                FlagEmoji = official.FlagEmoji,
                GroupId = official.GroupId,
                SortOrder = official.SortOrder,
                Played = prior?.Played ?? 0,
                Wins = prior?.Wins ?? 0,
                Draws = prior?.Draws ?? 0,
                Losses = prior?.Losses ?? 0,
                GoalsFor = prior?.GoalsFor ?? 0,
                GoalsAgainst = prior?.GoalsAgainst ?? 0,
                CreatedAt = prior?.CreatedAt ?? string.Empty,
            });
        }

        var teamById = (await GetTeamsAsync(WorldCupEventId)).ToDictionary(t => t.TeamId, StringComparer.OrdinalIgnoreCase);
        var allMatches = await QueryEventItemsAsync(_matchesTable, WorldCupEventId, MapMatch);
        foreach (var official in WorldCupOfficialFixtures.OpeningMatches)
        {
            if (!teamById.TryGetValue(official.TeamAId, out var teamA)
                || !teamById.TryGetValue(official.TeamBId, out var teamB))
                continue;

            var existing = allMatches
                .FirstOrDefault(m => string.Equals(m.MatchId, official.MatchId, StringComparison.OrdinalIgnoreCase));
            var officialResult = WorldCupOfficialFixtures.OpeningResults
                .FirstOrDefault(r => string.Equals(r.MatchId, official.MatchId, StringComparison.OrdinalIgnoreCase));

            await UpsertMatchAsync(new EventMatch
            {
                EventId = WorldCupEventId,
                MatchId = official.MatchId,
                TeamAId = official.TeamAId,
                TeamBId = official.TeamBId,
                TeamAName = teamA.Name,
                TeamBName = teamB.Name,
                TeamAFlag = teamA.FlagEmoji,
                TeamBFlag = teamB.FlagEmoji,
                MatchDate = existing?.MatchDate ?? string.Empty,
                MatchTime = existing?.MatchTime,
                Venue = existing?.Venue ?? string.Empty,
                Status = officialResult != null ? EventMatchStatus.Completed : existing?.Status ?? EventMatchStatus.Scheduled,
                ScoreA = officialResult?.ScoreA ?? existing?.ScoreA,
                ScoreB = officialResult?.ScoreB ?? existing?.ScoreB,
                GroupId = official.GroupId,
                Stage = official.Stage,
                IsFeatured = true,
                PredictionsLocked = existing?.PredictionsLocked ?? false,
                CreatedAt = existing?.CreatedAt ?? DateTime.UtcNow.ToString("O"),
            }, touchTimestamp: false, skipDuplicateCheck: true);
        }

        await GenerateGroupStageFixturesAsync();
        await ApplyOfficialKickoffsAsync();
        await ApplyOfficialCompletedResultsAsync();
        await SeedKnockoutPlaceholdersAsync();
        await SyncMatchTeamMetadataAsync();
    }

    /// <summary>Refresh team names/flags on every fixture from the authoritative team catalog.</summary>
    private async Task SyncMatchTeamMetadataAsync()
    {
        var teamById = (await GetTeamsAsync(WorldCupEventId))
            .ToDictionary(t => t.TeamId, StringComparer.OrdinalIgnoreCase);
        var matches = await QueryEventItemsAsync(_matchesTable, WorldCupEventId, MapMatch);
        foreach (var match in matches)
        {
            if (!teamById.TryGetValue(match.TeamAId, out var teamA) || !teamById.TryGetValue(match.TeamBId, out var teamB))
                continue;
            if (match.TeamAName == teamA.Name && match.TeamBName == teamB.Name
                && match.TeamAFlag == teamA.FlagEmoji && match.TeamBFlag == teamB.FlagEmoji)
                continue;

            match.TeamAName = teamA.Name;
            match.TeamBName = teamB.Name;
            match.TeamAFlag = teamA.FlagEmoji;
            match.TeamBFlag = teamB.FlagEmoji;
            await UpsertMatchAsync(match, touchTimestamp: false, skipDuplicateCheck: true);
        }
    }

    /// <summary>
    /// Stamps the official FIFA kickoff date/time (UTC) onto group-stage fixtures so predictions
    /// lock automatically at kickoff. Matched by team pair — fixture team order doesn't matter.
    /// </summary>
    private async Task ApplyOfficialKickoffsAsync()
    {
        var kickoffByPair = WorldCupOfficialFixtures.GroupKickoffs.ToDictionary(
            k => EventMatchRules.NormalizePairKey(k.TeamAId, k.TeamBId),
            k => k,
            StringComparer.OrdinalIgnoreCase);

        var matches = await QueryEventItemsAsync(_matchesTable, WorldCupEventId, MapMatch);
        foreach (var match in matches.Where(m => !string.IsNullOrWhiteSpace(m.GroupId)))
        {
            if (!kickoffByPair.TryGetValue(EventMatchRules.NormalizePairKey(match.TeamAId, match.TeamBId), out var kickoff))
                continue;
            if (match.MatchDate == kickoff.DateUtc && match.MatchTime == kickoff.TimeUtc)
                continue;

            match.MatchDate = kickoff.DateUtc;
            match.MatchTime = kickoff.TimeUtc;
            await UpsertMatchAsync(match, touchTimestamp: false, skipDuplicateCheck: true);
        }
    }

    /// <summary>
    /// Every team in a group plays every other once — generates any missing group fixtures
    /// (no invented dates; kickoff/venue come later via Admin CRM). Covers CRM-added teams too.
    /// </summary>
    private async Task GenerateGroupStageFixturesAsync()
    {
        var teams = (await GetTeamsAsync(WorldCupEventId))
            .Where(t => !string.IsNullOrWhiteSpace(t.GroupId))
            .OrderBy(t => t.SortOrder)
            .ToList();
        var matches = await QueryEventItemsAsync(_matchesTable, WorldCupEventId, MapMatch);
        var existingPairs = matches
            .Where(m => !string.IsNullOrWhiteSpace(m.GroupId))
            .Select(m => $"{m.GroupId!.ToLowerInvariant()}|{EventMatchRules.NormalizePairKey(m.TeamAId, m.TeamBId)}")
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        foreach (var group in teams.GroupBy(t => t.GroupId, StringComparer.OrdinalIgnoreCase))
        {
            var members = group.ToList();
            for (var i = 0; i < members.Count; i++)
            {
                for (var j = i + 1; j < members.Count; j++)
                {
                    var a = members[i];
                    var b = members[j];
                    var pairKey = $"{group.Key.ToLowerInvariant()}|{EventMatchRules.NormalizePairKey(a.TeamId, b.TeamId)}";
                    if (!existingPairs.Add(pairKey)) continue;

                    await UpsertMatchAsync(new EventMatch
                    {
                        EventId = WorldCupEventId,
                        MatchId = $"gs-{a.TeamId}-vs-{b.TeamId}",
                        TeamAId = a.TeamId,
                        TeamBId = b.TeamId,
                        TeamAName = a.Name,
                        TeamBName = b.Name,
                        TeamAFlag = a.FlagEmoji,
                        TeamBFlag = b.FlagEmoji,
                        GroupId = group.Key,
                        Stage = EventMatchStage.GroupStage,
                        Status = EventMatchStatus.Scheduled,
                    }, touchTimestamp: false, skipDuplicateCheck: true);
                }
            }
        }
    }

    /// <summary>
    /// Seeds the knockout bracket (Round of 32 → Final) as locked TBD placeholders so fans see the
    /// full road to the final. Existing matches are never touched — the Admin CRM assigns real teams
    /// and unlocks predictions as qualifiers are confirmed.
    /// </summary>
    private async Task SeedKnockoutPlaceholdersAsync()
    {
        var existingIds = (await QueryEventItemsAsync(_matchesTable, WorldCupEventId, MapMatch))
            .Select(m => m.MatchId)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        foreach (var ko in WorldCupOfficialFixtures.KnockoutMatches)
        {
            if (existingIds.Contains(ko.MatchId)) continue;

            await UpsertMatchAsync(new EventMatch
            {
                EventId = WorldCupEventId,
                MatchId = ko.MatchId,
                TeamAId = $"{WorldCupOfficialFixtures.TbdTeamPrefix}{ko.MatchId}-a",
                TeamBId = $"{WorldCupOfficialFixtures.TbdTeamPrefix}{ko.MatchId}-b",
                TeamAName = "TBD",
                TeamBName = "TBD",
                Stage = ko.Stage,
                Status = EventMatchStatus.Scheduled,
                PredictionsLocked = true,
            }, touchTimestamp: false, skipDuplicateCheck: true);
        }
    }

    private static string? ResolveFixturesLastUpdatedAt(EventConfig config, List<EventMatch> matches)
    {
        if (!string.IsNullOrWhiteSpace(config.FixturesLastUpdatedAt))
            return config.FixturesLastUpdatedAt;
        var latest = matches.Select(m => m.UpdatedAt).Where(x => !string.IsNullOrWhiteSpace(x)).OrderByDescending(x => x).FirstOrDefault();
        return string.IsNullOrWhiteSpace(latest) ? null : latest;
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
        var all = (await QueryEventItemsAsync(_matchesTable, eventId, MapMatch))
            .Select(EventMatchRules.Enrich)
            .ToList();
        if (!string.IsNullOrWhiteSpace(date))
            return all.Where(m => m.MatchDate == date).OrderBy(m => m.MatchTime).ToList();
        return all.OrderBy(m => m, Comparer<EventMatch>.Create(EventMatchRules.CompareChronological)).ToList();
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
        var entries = type switch
        {
            "active" => analytics.MostActiveFans,
            "shared" => analytics.MostShared,
            _ => analytics.TopPredictors,
        };
        await EnrichDisplayNamesAsync(entries);
        return entries;
    }

    /// <summary>
    /// Predictions store the JWT "name" claim, which is often missing or a generic "User".
    /// Replace those with the real app profile name so the leaderboard shows who fans actually are.
    /// </summary>
    private async Task EnrichDisplayNamesAsync(List<EventLeaderboardEntry> entries)
    {
        foreach (var entry in entries)
        {
            if (!string.IsNullOrWhiteSpace(entry.DisplayName)
                && !string.Equals(entry.DisplayName, "User", StringComparison.OrdinalIgnoreCase))
                continue;
            try
            {
                var profile = await _profiles.GetProfileAsync(entry.UserId);
                if (!string.IsNullOrWhiteSpace(profile?.Name))
                    entry.DisplayName = profile.Name;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Leaderboard profile lookup failed for {UserId}", entry.UserId);
            }
        }
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

    public async Task<EventMatch> UpsertMatchAsync(EventMatch match, bool touchTimestamp = true, bool skipDuplicateCheck = false)
    {
        if (string.IsNullOrWhiteSpace(match.TeamAId) || string.IsNullOrWhiteSpace(match.TeamBId))
            throw new InvalidOperationException("Both teams are required.");
        if (string.Equals(match.TeamAId, match.TeamBId, StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("A team cannot play itself.");

        if (!skipDuplicateCheck)
        {
            var existing = await QueryEventItemsAsync(_matchesTable, match.EventId, MapMatch);
            // Scope duplicates: same pair may legitimately meet again in the knockout bracket,
            // so group fixtures only collide within their group and knockout fixtures within the bracket.
            var scope = string.IsNullOrWhiteSpace(match.GroupId)
                ? existing.Where(m => string.IsNullOrWhiteSpace(m.GroupId))
                : existing.Where(m => string.Equals(m.GroupId, match.GroupId, StringComparison.OrdinalIgnoreCase));
            if (EventMatchRules.IsDuplicateFixture(scope, match.TeamAId, match.TeamBId, match.MatchId))
                throw new InvalidOperationException("Duplicate fixture — this matchup already exists.");
        }

        match.UpdatedAt = DateTime.UtcNow.ToString("O");
        if (string.IsNullOrWhiteSpace(match.CreatedAt)) match.CreatedAt = match.UpdatedAt;
        var table = Table.LoadTable(_dynamoDb, _matchesTable);
        await table.PutItemAsync(MatchToDoc(match));
        if (touchTimestamp)
        {
            await TouchFixturesTimestampAsync(match.EventId);
            // Admin recorded a result (or reverted one) — keep group standings derived from matches.
            await RecalculateStandingsAsync(match.EventId);
        }
        return EventMatchRules.Enrich(match);
    }

    /// <summary>Recompute team standings from completed and in-play group matches with scores.</summary>
    public async Task RecalculateStandingsAsync(string eventId)
    {
        var teams = await GetTeamsAsync(eventId);
        if (teams.Count == 0) return;

        // Group tables count group-stage results — knockout matches never affect standings.
        var counted = (await QueryEventItemsAsync(_matchesTable, eventId, MapMatch))
            .Where(m => (string.Equals(m.Status, EventMatchStatus.Completed, StringComparison.OrdinalIgnoreCase)
                         || string.Equals(m.Status, EventMatchStatus.Live, StringComparison.OrdinalIgnoreCase))
                        && m.ScoreA.HasValue && m.ScoreB.HasValue
                        && !string.IsNullOrWhiteSpace(m.GroupId))
            .ToList();

        foreach (var team in teams)
        {
            int played = 0, wins = 0, draws = 0, losses = 0, goalsFor = 0, goalsAgainst = 0;
            foreach (var m in counted)
            {
                var isA = string.Equals(m.TeamAId, team.TeamId, StringComparison.OrdinalIgnoreCase);
                var isB = string.Equals(m.TeamBId, team.TeamId, StringComparison.OrdinalIgnoreCase);
                if (!isA && !isB) continue;

                var scored = isA ? m.ScoreA!.Value : m.ScoreB!.Value;
                var conceded = isA ? m.ScoreB!.Value : m.ScoreA!.Value;
                played++;
                goalsFor += scored;
                goalsAgainst += conceded;
                if (scored > conceded) wins++;
                else if (scored == conceded) draws++;
                else losses++;
            }

            if (team.Played == played && team.Wins == wins && team.Draws == draws
                && team.Losses == losses && team.GoalsFor == goalsFor && team.GoalsAgainst == goalsAgainst)
                continue;

            team.Played = played;
            team.Wins = wins;
            team.Draws = draws;
            team.Losses = losses;
            team.GoalsFor = goalsFor;
            team.GoalsAgainst = goalsAgainst;
            await UpsertTeamAsync(team); // recomputes GoalDifference + Points
        }
    }

    public async Task DeleteMatchAsync(string eventId, string matchId)
    {
        var table = Table.LoadTable(_dynamoDb, _matchesTable);
        await table.DeleteItemAsync(eventId, matchId);
        await TouchFixturesTimestampAsync(eventId);
    }

    private async Task TouchFixturesTimestampAsync(string eventId)
    {
        var config = await _sportsLayer.GetEventConfigAsync(eventId);
        if (config == null) return;
        config.FixturesLastUpdatedAt = DateTime.UtcNow.ToString("O");
        await _sportsLayer.UpsertEventConfigAsync(config);
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

        var match = (await GetMatchesAsync(eventId)).FirstOrDefault(m => m.MatchId == request.MatchId);
        if (match == null)
            throw new InvalidOperationException("Match not found.");
        if (!match.PredictionsOpen)
            throw new InvalidOperationException("Predictions are closed for this match.");

        if (request.PredictionType == EventPredictionType.ExactScore && !config.ExactScoreEnabled)
            throw new InvalidOperationException("Exact score predictions are disabled.");
        if (request.PredictionType == EventPredictionType.Draw && !config.DrawPickEnabled)
            throw new InvalidOperationException("Draw predictions are disabled.");
        if (request.PredictionType == EventPredictionType.Winner && !config.WinnerPickEnabled)
            throw new InvalidOperationException("Winner predictions are disabled.");

        if (!string.IsNullOrWhiteSpace(request.Reason) && request.Reason.Length > 280)
            request.Reason = request.Reason.Trim()[..280];

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
        var teamFlags = teams.ToDictionary(t => t.TeamId, t => t.FlagEmoji, StringComparer.OrdinalIgnoreCase);

        var completed = matches.Where(m => m.Status == EventMatchStatus.Completed).ToList();
        var breakdownByMatch = new Dictionary<string, MatchPredictionBreakdown>(StringComparer.OrdinalIgnoreCase);
        foreach (var match in completed)
        {
            breakdownByMatch[match.MatchId] = await GetMatchPredictionBreakdownAsync(eventId, match.MatchId);
        }

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

            var breakdown = breakdownByMatch.GetValueOrDefault(match.MatchId);
            var scored = ScorePredictionDetailed(pred, match, breakdown);
            if (scored.Points <= 0) continue;

            entry.CorrectCount++;
            entry.Score += scored.Points;
            if (scored.IsExact) entry.ExactScoreCount++;
            if (scored.IsUpset) entry.UpsetBonusCount++;
        }

        foreach (var entry in predictorScores.Values)
        {
            var userPreds = predictions
                .Where(p => p.UserId == entry.UserId)
                .Select(p => (pred: p, match: completed.FirstOrDefault(m => m.MatchId == p.MatchId)))
                .Where(x => x.match != null && x.match.ScoreA != null && x.match.ScoreB != null)
                .OrderBy(x => x.match!.MatchDate)
                .ThenBy(x => x.match!.MatchTime ?? string.Empty)
                .ToList();

            var streak = 0;
            for (var i = userPreds.Count - 1; i >= 0; i--)
            {
                var breakdown = breakdownByMatch.GetValueOrDefault(userPreds[i].match!.MatchId);
                var scored = ScorePredictionDetailed(userPreds[i].pred, userPreds[i].match!, breakdown);
                if (scored.Points <= 0) break;
                streak++;
            }
            entry.CurrentStreak = streak;
            entry.Score += Math.Min(streak, 5);

            var favorite = predictions
                .Where(p => p.UserId == entry.UserId && !string.IsNullOrWhiteSpace(p.PredictedWinnerTeamId))
                .GroupBy(p => p.PredictedWinnerTeamId!)
                .OrderByDescending(g => g.Count())
                .Select(g => g.Key)
                .FirstOrDefault();
            entry.FavoriteTeamId = favorite;
            if (favorite != null && teamFlags.TryGetValue(favorite, out var flag))
                entry.FavoriteTeamFlag = flag;
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

    private sealed class PredictionScoreResult
    {
        public int Points { get; init; }
        public bool IsExact { get; init; }
        public bool IsUpset { get; init; }
    }

    private static PredictionScoreResult ScorePredictionDetailed(
        EventPrediction pred,
        EventMatch match,
        MatchPredictionBreakdown? breakdown)
    {
        if (match.ScoreA == null || match.ScoreB == null) return new PredictionScoreResult();
        var sa = match.ScoreA.Value;
        var sb = match.ScoreB.Value;

        var isExact = pred.PredictionType == EventPredictionType.ExactScore
            && pred.PredictedScoreA == sa && pred.PredictedScoreB == sb;
        var isDraw = sa == sb;
        var winnerId = sa > sb ? match.TeamAId : sb > sa ? match.TeamBId : null;

        var winnerCorrect = winnerId != null && (
            (pred.PredictionType == EventPredictionType.Winner && pred.PredictedWinnerTeamId == winnerId)
            || (pred.PredictionType == EventPredictionType.ExactScore
                && ((pred.PredictedScoreA > pred.PredictedScoreB && winnerId == match.TeamAId)
                    || (pred.PredictedScoreB > pred.PredictedScoreA && winnerId == match.TeamBId)))
        );
        var drawCorrect = isDraw && (
            pred.PredictionType == EventPredictionType.Draw
            || (pred.PredictionType == EventPredictionType.ExactScore && pred.PredictedScoreA == pred.PredictedScoreB)
        );

        var points = 0;
        if (isExact) points = 5;
        else if (drawCorrect) points = 2;
        else if (winnerCorrect) points = 1;
        else return new PredictionScoreResult();

        var pickedTeamId = pred.PredictedWinnerTeamId;
        if (pred.PredictionType == EventPredictionType.ExactScore && pred.PredictedScoreA != null && pred.PredictedScoreB != null)
        {
            pickedTeamId = pred.PredictedScoreA > pred.PredictedScoreB ? match.TeamAId
                : pred.PredictedScoreB > pred.PredictedScoreA ? match.TeamBId
                : null;
        }

        var isUpset = false;
        if (pickedTeamId != null && breakdown != null && breakdown.TotalPredictions > 0)
        {
            var pickedPct = breakdown.Outcomes.FirstOrDefault(o => o.TeamId == pickedTeamId)?.Percent ?? 50;
            var otherPct = breakdown.Outcomes
                .Where(o => o.TeamId != null && !string.Equals(o.TeamId, pickedTeamId, StringComparison.OrdinalIgnoreCase))
                .Select(o => o.Percent)
                .DefaultIfEmpty(0)
                .Max();
            if (pickedPct < 40 && pickedPct <= otherPct) isUpset = true;
        }

        if (isUpset) points += 2;

        return new PredictionScoreResult { Points = points, IsExact = isExact, IsUpset = isUpset };
    }

    private static int ScorePrediction(EventPrediction pred, EventMatch match) =>
        ScorePredictionDetailed(pred, match, null).Points;

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

    public async Task<EventHubLiveStats> GetLiveStatsAsync(string eventId)
    {
        var analytics = await GetAnalyticsAsync(eventId);
        var comments = await QueryEventItemsAsync(_commentsTable, eventId, MapComment);
        var matchesDiscussed = comments.Where(c => !c.Deleted && c.ThreadType == "match")
            .Select(c => c.ThreadId).Distinct().Count();
        var meetups = await _sportsLayer.GetMeetupsForEventAsync(eventId);
        var matches = await GetMatchesAsync(eventId);
        var matchesPlayed = matches.Count(m => m.Status == EventMatchStatus.Completed);
        var countriesRepresented = analytics.PopularTeams.Count(kv => kv.Value > 0);
        return new EventHubLiveStats
        {
            MatchesPlayed = matchesPlayed,
            PredictionsSubmitted = analytics.TotalPredictions,
            ActiveFans = analytics.UniquePredictors,
            CountriesRepresented = countriesRepresented,
            MatchesDiscussed = matchesDiscussed,
            ConnectionsMade = meetups.Count,
        };
    }

    public async Task<UserPicksSummary> GetUserPicksSummaryAsync(string eventId, string userId)
    {
        var predictions = (await QueryEventItemsAsync(_predictionsTable, eventId, MapPrediction))
            .Where(p => p.UserId == userId)
            .OrderByDescending(p => p.UpdatedAt)
            .ToList();
        var matches = await GetMatchesAsync(eventId);
        var completed = matches.Where(m => m.Status == EventMatchStatus.Completed).ToList();
        var correct = 0;
        foreach (var pred in predictions)
        {
            var match = completed.FirstOrDefault(m => m.MatchId == pred.MatchId);
            if (match == null || match.ScoreA == null || match.ScoreB == null) continue;
            if (ScorePrediction(pred, match) > 0) correct++;
        }
        var pending = predictions.Count(p => matches.Any(m => m.MatchId == p.MatchId && m.Status != EventMatchStatus.Completed));
        var leaderboard = await GetLeaderboardAsync(eventId, "predictors");
        var rank = leaderboard.FindIndex(e => e.UserId == userId);
        var globalRank = rank >= 0 ? rank + 1 : 0;
        var resolved = predictions.Count - pending;
        var accuracy = resolved > 0 ? (int)Math.Round(100.0 * correct / resolved) : 0;
        return new UserPicksSummary
        {
            Predictions = predictions,
            CorrectCount = correct,
            PendingCount = pending,
            TotalCount = predictions.Count,
            GlobalRank = globalRank,
            AccuracyPercent = accuracy,
        };
    }

    public async Task<CommunityPulse> GetCommunityPulseAsync(string eventId)
    {
        var analytics = await GetAnalyticsAsync(eventId);
        var predictions = await QueryEventItemsAsync(_predictionsTable, eventId, MapPrediction);
        var comments = await QueryEventItemsAsync(_commentsTable, eventId, MapComment);
        var matches = await GetMatchesAsync(eventId);
        var teams = await GetTeamsAsync(eventId);
        var teamNames = teams.ToDictionary(t => t.TeamId, t => t.Name, StringComparer.OrdinalIgnoreCase);

        string? topTeamId = null;
        string? topTeamName = null;
        if (analytics.PopularTeams.Count > 0)
        {
            topTeamId = analytics.PopularTeams.OrderByDescending(kv => kv.Value).First().Key;
            topTeamName = teamNames.GetValueOrDefault(topTeamId, topTeamId);
        }

        string? topMatchId = null;
        string? topMatchLabel = null;
        if (analytics.PredictionsPerMatch.Count > 0)
        {
            topMatchId = analytics.PredictionsPerMatch.OrderByDescending(kv => kv.Value).First().Key;
            var m = matches.FirstOrDefault(x => x.MatchId == topMatchId);
            topMatchLabel = m != null ? $"{m.TeamAName} vs {m.TeamBName}" : topMatchId;
        }

        var predByUser = predictions.ToDictionary(p => p.UserId, p => p, StringComparer.Ordinal);
        var latestTakes = comments
            .Where(c => !c.Deleted && !c.Hidden && c.ThreadType == "match")
            .OrderByDescending(c => c.CreatedAt)
            .Take(6)
            .Select(c =>
            {
                predByUser.TryGetValue(c.UserId, out var pred);
                return new FanTakePreview
                {
                    UserDisplayName = c.UserDisplayName,
                    Body = c.Body,
                    ThreadId = c.ThreadId,
                    PickedTeamId = pred?.PredictedWinnerTeamId,
                    CreatedAt = c.CreatedAt,
                };
            })
            .ToList();

        return new CommunityPulse
        {
            TotalPredictions = analytics.TotalPredictions,
            MostPickedTeamId = topTeamId,
            MostPickedTeamName = topTeamName,
            MostDiscussedMatchId = topMatchId,
            MostDiscussedMatchLabel = topMatchLabel,
            LatestTakes = latestTakes,
        };
    }

    public async Task<List<PredictionExportRow>> ExportPredictionsAsync(string eventId)
    {
        var predictions = await QueryEventItemsAsync(_predictionsTable, eventId, MapPrediction);
        var matches = await GetMatchesAsync(eventId);
        var matchLabels = matches.ToDictionary(
            m => m.MatchId,
            m => $"{m.TeamAName} vs {m.TeamBName}",
            StringComparer.OrdinalIgnoreCase);

        return predictions
            .OrderByDescending(p => p.CreatedAt)
            .Select(p => new PredictionExportRow
            {
                MatchId = p.MatchId,
                MatchLabel = matchLabels.GetValueOrDefault(p.MatchId),
                UserId = p.UserId,
                UserDisplayName = p.UserDisplayName,
                PredictionType = p.PredictionType,
                PredictedWinnerTeamId = p.PredictedWinnerTeamId,
                PredictedScoreA = p.PredictedScoreA,
                PredictedScoreB = p.PredictedScoreB,
                Reason = p.Reason,
                CreatedAt = p.CreatedAt,
            })
            .ToList();
    }

    public async Task<MatchPredictionBreakdown> GetMatchPredictionBreakdownAsync(string eventId, string matchId)
    {
        var predictions = (await GetPredictionsForMatchAsync(eventId, matchId)).ToList();
        var match = (await GetMatchesAsync(eventId)).FirstOrDefault(m => m.MatchId == matchId);
        var total = predictions.Count;
        if (total == 0)
        {
            return new MatchPredictionBreakdown { MatchId = matchId, TotalPredictions = 0 };
        }

        var outcomes = new List<PredictionOutcomeShare>();
        var drawCount = predictions.Count(p => p.PredictionType == EventPredictionType.Draw);
        if (drawCount > 0)
        {
            outcomes.Add(new PredictionOutcomeShare
            {
                Label = "Draw",
                OutcomeType = EventPredictionType.Draw,
                Count = drawCount,
                Percent = (int)Math.Round(100.0 * drawCount / total),
            });
        }

        if (match != null)
        {
            foreach (var teamId in new[] { match.TeamAId, match.TeamBId })
            {
                var name = teamId == match.TeamAId ? match.TeamAName : match.TeamBName;
                var winnerCount = predictions.Count(p =>
                    p.PredictionType == EventPredictionType.Winner && p.PredictedWinnerTeamId == teamId);
                var exactCount = predictions.Count(p =>
                    p.PredictionType == EventPredictionType.ExactScore &&
                    ((p.PredictedScoreA > p.PredictedScoreB && teamId == match.TeamAId) ||
                     (p.PredictedScoreB > p.PredictedScoreA && teamId == match.TeamBId)));
                var count = winnerCount + exactCount;
                if (count > 0)
                {
                    outcomes.Add(new PredictionOutcomeShare
                    {
                        Label = $"{name} Win",
                        TeamId = teamId,
                        OutcomeType = EventPredictionType.Winner,
                        Count = count,
                        Percent = (int)Math.Round(100.0 * count / total),
                    });
                }
            }
        }

        return new MatchPredictionBreakdown
        {
            MatchId = matchId,
            TotalPredictions = total,
            Outcomes = outcomes.OrderByDescending(o => o.Percent).ToList(),
        };
    }

    public async Task<MatchIntelligence> GetMatchIntelligenceAsync(string eventId, string matchId)
    {
        var config = await _sportsLayer.GetEventConfigAsync(eventId);
        if (config == null || !config.MatchIntelligenceEnabled)
            return new MatchIntelligence { MatchId = matchId };

        var match = (await GetMatchesAsync(eventId)).FirstOrDefault(m => m.MatchId == matchId);
        if (match == null) return new MatchIntelligence { MatchId = matchId };

        var teams = await GetTeamsAsync(eventId);
        var teamA = teams.FirstOrDefault(t => t.TeamId == match.TeamAId);
        var teamB = teams.FirstOrDefault(t => t.TeamId == match.TeamBId);
        var predictions = (await GetPredictionsForMatchAsync(eventId, matchId)).ToList();
        var breakdown = await GetMatchPredictionBreakdownAsync(eventId, matchId);

        const int minCommunity = 10;
        var teamAName = teamA?.Name ?? match.TeamAName ?? "Team A";
        var teamBName = teamB?.Name ?? match.TeamBName ?? "Team B";
        var hasCommunity = breakdown.TotalPredictions >= minCommunity;

        return new MatchIntelligence
        {
            MatchId = matchId,
            TotalPredictions = breakdown.TotalPredictions,
            TeamAName = teamAName,
            TeamBName = teamBName,
            TeamAFifaRank = ResolveFifaRank(match.TeamAId),
            TeamBFifaRank = ResolveFifaRank(match.TeamBId),
            CommunityPicks = hasCommunity ? breakdown.Outcomes : new List<PredictionOutcomeShare>(),
            MostPopular = hasCommunity ? ResolveMostPopularPrediction(predictions, match) : null,
        };
    }

    private static MostPopularPrediction? ResolveMostPopularPrediction(List<EventPrediction> predictions, EventMatch match)
    {
        if (predictions.Count == 0) return null;

        var scored = predictions
            .Where(p => p.PredictedScoreA != null && p.PredictedScoreB != null)
            .GroupBy(p => (p.PredictedScoreA!.Value, p.PredictedScoreB!.Value))
            .OrderByDescending(g => g.Count())
            .ThenByDescending(g => g.Key.Item1 + g.Key.Item2)
            .FirstOrDefault();

        if (scored != null)
        {
            var (a, b) = scored.Key;
            return new MostPopularPrediction
            {
                ScoreA = a,
                ScoreB = b,
                IsDraw = a == b,
                WinnerTeamId = a == b ? null : a > b ? match.TeamAId : match.TeamBId,
                Count = scored.Count(),
            };
        }

        var outcomeGroups = predictions
            .Select(p =>
            {
                if (p.PredictionType == EventPredictionType.Draw) return "draw";
                if (!string.IsNullOrEmpty(p.PredictedWinnerTeamId)) return $"win:{p.PredictedWinnerTeamId}";
                return null;
            })
            .Where(k => k != null)
            .GroupBy(k => k!)
            .OrderByDescending(g => g.Count())
            .FirstOrDefault();

        if (outcomeGroups == null) return null;

        if (outcomeGroups.Key == "draw")
        {
            return new MostPopularPrediction { IsDraw = true, Count = outcomeGroups.Count() };
        }

        var teamId = outcomeGroups.Key["win:".Length..];
        return new MostPopularPrediction
        {
            WinnerTeamId = teamId,
            Count = outcomeGroups.Count(),
        };
    }

    private static int ResolveFifaRank(string teamId)
    {
        if (FifaRankings.TryGetValue(teamId, out var rank)) return rank;
        var hash = Math.Abs(teamId.GetHashCode(StringComparison.OrdinalIgnoreCase));
        return 12 + (hash % 68);
    }

    private static readonly Dictionary<string, int> FifaRankings = new(StringComparer.OrdinalIgnoreCase)
    {
        ["argentina"] = 1, ["france"] = 2, ["spain"] = 3, ["england"] = 4, ["brazil"] = 5,
        ["portugal"] = 6, ["netherlands"] = 7, ["belgium"] = 8, ["germany"] = 9, ["croatia"] = 10,
        ["italy"] = 11, ["morocco"] = 12, ["colombia"] = 13, ["usa"] = 14, ["mexico"] = 15,
        ["uruguay"] = 16, ["switzerland"] = 17, ["japan"] = 18, ["senegal"] = 19, ["iran"] = 20,
        ["denmark"] = 21, ["south-korea"] = 22, ["ecuador"] = 23, ["austria"] = 24, ["turkiye"] = 25,
        ["australia"] = 26, ["ukraine"] = 27, ["scotland"] = 28, ["norway"] = 29, ["panama"] = 30,
        ["poland"] = 31, ["egypt"] = 32, ["paraguay"] = 33, ["czechia"] = 34, ["canada"] = 35,
        ["ivory-coast"] = 36, ["algeria"] = 37, ["tunisia"] = 38, ["saudi-arabia"] = 39, ["qatar"] = 40,
        ["south-africa"] = 41, ["ghana"] = 42, ["curacao"] = 43, ["haiti"] = 44, ["jordan"] = 45,
        ["uzbekistan"] = 46, ["iraq"] = 47, ["new-zealand"] = 48, ["cape-verde"] = 49, ["dr-congo"] = 50,
        ["bosnia-herzegovina"] = 51,
    };

    public async Task<List<PublicFanPick>> GetFanPicksFeedAsync(
        string eventId, string? matchId = null, string sort = "recent", int limit = 50)
    {
        var config = await _sportsLayer.GetEventConfigAsync(eventId);
        if (config == null || !config.FanFeedEnabled) return new List<PublicFanPick>();

        var predictions = await QueryEventItemsAsync(_predictionsTable, eventId, MapPrediction);
        if (!string.IsNullOrWhiteSpace(matchId))
            predictions = predictions.Where(p => p.MatchId == matchId).ToList();

        var matches = await GetMatchesAsync(eventId);
        var matchMap = matches.ToDictionary(m => m.MatchId, StringComparer.OrdinalIgnoreCase);
        var comments = await QueryEventItemsAsync(_commentsTable, eventId, MapComment);
        var replyCounts = comments
            .Where(c => !c.Deleted && !c.Hidden && c.ThreadType == "match")
            .GroupBy(c => c.ThreadId)
            .ToDictionary(g => g.Key, g => g.Count(), StringComparer.OrdinalIgnoreCase);

        IEnumerable<EventPrediction> ordered = sort.Equals("trending", StringComparison.OrdinalIgnoreCase)
            ? predictions.OrderByDescending(p => p.ShareCount).ThenByDescending(p => p.CreatedAt)
            : predictions.OrderByDescending(p => p.CreatedAt);

        return ordered.Take(Math.Clamp(limit, 1, 100)).Select(p =>
        {
            matchMap.TryGetValue(p.MatchId, out var m);
            return new PublicFanPick
            {
                MatchId = p.MatchId,
                MatchLabel = m != null ? $"{m.TeamAName} vs {m.TeamBName}" : p.MatchId,
                TeamAId = m?.TeamAId,
                TeamBId = m?.TeamBId,
                TeamAName = m?.TeamAName,
                TeamBName = m?.TeamBName,
                TeamAFlag = m?.TeamAFlag,
                TeamBFlag = m?.TeamBFlag,
                UserDisplayName = p.UserDisplayName,
                PredictionType = p.PredictionType,
                PredictedWinnerTeamId = p.PredictedWinnerTeamId,
                PredictedScoreA = p.PredictedScoreA,
                PredictedScoreB = p.PredictedScoreB,
                Reason = p.ReasonHidden ? null : p.Reason,
                ShareCount = p.ShareCount,
                ReplyCount = replyCounts.GetValueOrDefault(p.MatchId),
                CreatedAt = p.CreatedAt,
            };
        }).ToList();
    }

    public async Task HidePredictionReasonAsync(string eventId, string matchId, string userId)
    {
        var pred = await GetUserPredictionAsync(eventId, matchId, userId);
        if (pred == null) return;
        pred.ReasonHidden = true;
        pred.UpdatedAt = DateTime.UtcNow.ToString("O");
        var table = Table.LoadTable(_dynamoDb, _predictionsTable);
        await table.PutItemAsync(PredictionToDoc(pred));
    }

    public async Task<List<TeamExplorerStats>> GetTeamExplorerStatsAsync(string eventId)
    {
        var teams = await GetTeamsAsync(eventId);
        var predictions = await QueryEventItemsAsync(_predictionsTable, eventId, MapPrediction);
        var comments = await QueryEventItemsAsync(_commentsTable, eventId, MapComment);
        var analytics = await GetAnalyticsAsync(eventId);

        return teams.Select(team =>
        {
            var predCount = predictions.Count(p =>
                p.PredictedWinnerTeamId == team.TeamId ||
                (p.PredictionType == EventPredictionType.ExactScore && (p.PredictedScoreA > p.PredictedScoreB || p.PredictedScoreB > p.PredictedScoreA)));
            var discussCount = comments.Count(c => !c.Deleted && c.ThreadId == team.TeamId);
            analytics.PopularTeams.TryGetValue(team.TeamId, out var fanPickCount);
            return new TeamExplorerStats
            {
                TeamId = team.TeamId,
                Name = team.Name,
                Country = team.Country,
                FlagEmoji = team.FlagEmoji,
                Description = team.Description,
                FanCount = fanPickCount,
                PredictionsCount = predCount,
                DiscussionCount = discussCount,
            };
        }).OrderByDescending(t => t.PredictionsCount + t.DiscussionCount).ToList();
    }

    public async Task<List<EventComment>> GetTrendingCommentsAsync(string eventId, string sort = "trending")
    {
        var all = await QueryEventItemsAsync(_commentsTable, eventId, MapComment);
        var visible = all.Where(c => !c.Deleted && !c.Hidden).ToList();
        return sort == "recent"
            ? visible.OrderByDescending(c => c.CreatedAt).Take(50).ToList()
            : visible.OrderByDescending(c => c.LikeCount).ThenByDescending(c => c.CreatedAt).Take(50).ToList();
    }

    public async Task LikeCommentAsync(string eventId, string commentKey)
    {
        var table = Table.LoadTable(_dynamoDb, _commentsTable);
        var doc = await table.GetItemAsync(eventId, commentKey);
        if (doc == null) return;
        var c = MapComment(doc);
        c.LikeCount++;
        c.UpdatedAt = DateTime.UtcNow.ToString("O");
        await table.PutItemAsync(CommentToDoc(c));
    }

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
        ["isFeatured"] = m.IsFeatured, ["predictionsLocked"] = m.PredictionsLocked,
        ["createdAt"] = m.CreatedAt, ["updatedAt"] = m.UpdatedAt,
    };

    private static Document PredictionToDoc(EventPrediction p) => new()
    {
        ["eventId"] = p.EventId, ["predictionKey"] = p.PredictionKey, ["matchId"] = p.MatchId,
        ["userId"] = p.UserId, ["userDisplayName"] = p.UserDisplayName ?? "",
        ["predictionType"] = p.PredictionType, ["predictedWinnerTeamId"] = p.PredictedWinnerTeamId ?? "",
        ["predictedScoreA"] = p.PredictedScoreA ?? -1, ["predictedScoreB"] = p.PredictedScoreB ?? -1,
        ["reason"] = p.Reason ?? "", ["reasonHidden"] = p.ReasonHidden, ["shareCount"] = p.ShareCount,
        ["createdAt"] = p.CreatedAt, ["updatedAt"] = p.UpdatedAt,
    };

    private static Document CommentToDoc(EventComment c) => new()
    {
        ["eventId"] = c.EventId, ["commentKey"] = c.CommentKey, ["threadId"] = c.ThreadId,
        ["threadType"] = c.ThreadType, ["userId"] = c.UserId, ["userDisplayName"] = c.UserDisplayName ?? "",
        ["body"] = c.Body, ["parentCommentKey"] = c.ParentCommentKey ?? "",
        ["hidden"] = c.Hidden, ["deleted"] = c.Deleted, ["likeCount"] = c.LikeCount,
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
            IsFeatured = d.ContainsKey("isFeatured") && d["isFeatured"].AsBoolean(),
            PredictionsLocked = d.ContainsKey("predictionsLocked") && d["predictionsLocked"].AsBoolean(),
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
            ReasonHidden = d.ContainsKey("reasonHidden") && d["reasonHidden"].AsBoolean(),
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
        LikeCount = d.ContainsKey("likeCount") ? (int)d["likeCount"].AsLong() : 0,
        CreatedAt = d.ContainsKey("createdAt") ? d["createdAt"].AsString() : "",
        UpdatedAt = d.ContainsKey("updatedAt") ? d["updatedAt"].AsString() : "",
    };
}
