using Amazon.DynamoDBv2.DataModel;

namespace GetTrainMate.Api.Models;

/// <summary>Reusable Event Hub entities — keyed by eventId slug (e.g. world-cup-2026).</summary>

[DynamoDBTable("gettrainmate-event-groups")]
public class EventGroup
{
    [DynamoDBHashKey("eventId")]
    public string EventId { get; set; } = string.Empty;

    [DynamoDBRangeKey("groupId")]
    public string GroupId { get; set; } = string.Empty;

    public string Label { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public string CreatedAt { get; set; } = DateTime.UtcNow.ToString("O");
    public string UpdatedAt { get; set; } = DateTime.UtcNow.ToString("O");
}

[DynamoDBTable("gettrainmate-event-teams")]
public class EventTeam
{
    [DynamoDBHashKey("eventId")]
    public string EventId { get; set; } = string.Empty;

    [DynamoDBRangeKey("teamId")]
    public string TeamId { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;
    public string Country { get; set; } = string.Empty;
    public string FlagEmoji { get; set; } = string.Empty;
    public string GroupId { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int SortOrder { get; set; }
    public int Played { get; set; }
    public int Wins { get; set; }
    public int Draws { get; set; }
    public int Losses { get; set; }
    public int GoalsFor { get; set; }
    public int GoalsAgainst { get; set; }
    public int GoalDifference { get; set; }
    public int Points { get; set; }
    public string CreatedAt { get; set; } = DateTime.UtcNow.ToString("O");
    public string UpdatedAt { get; set; } = DateTime.UtcNow.ToString("O");
}

public static class EventMatchStatus
{
    public const string Scheduled = "Scheduled";
    public const string Live = "Live";
    public const string Completed = "Completed";
    public const string Postponed = "Postponed";
}

[DynamoDBTable("gettrainmate-event-matches")]
public class EventMatch
{
    [DynamoDBHashKey("eventId")]
    public string EventId { get; set; } = string.Empty;

    [DynamoDBRangeKey("matchId")]
    public string MatchId { get; set; } = string.Empty;

    public string TeamAId { get; set; } = string.Empty;
    public string TeamBId { get; set; } = string.Empty;
    public string? TeamAName { get; set; }
    public string? TeamBName { get; set; }
    public string? TeamAFlag { get; set; }
    public string? TeamBFlag { get; set; }
    public string MatchDate { get; set; } = string.Empty;
    public string? MatchTime { get; set; }
    public string Venue { get; set; } = string.Empty;
    public string Status { get; set; } = EventMatchStatus.Scheduled;
    public int? ScoreA { get; set; }
    public int? ScoreB { get; set; }
    public string? GroupId { get; set; }
    public string? Stage { get; set; }
    public bool IsFeatured { get; set; }
    public bool PredictionsLocked { get; set; }
    /// <summary>Computed on read — not persisted.</summary>
    [DynamoDBIgnore]
    public bool PredictionsOpen { get; set; } = true;
    public string CreatedAt { get; set; } = DateTime.UtcNow.ToString("O");
    public string UpdatedAt { get; set; } = DateTime.UtcNow.ToString("O");
}

public static class EventPredictionType
{
    public const string Winner = "winner";
    public const string Draw = "draw";
    public const string ExactScore = "exact_score";
}

[DynamoDBTable("gettrainmate-event-predictions")]
public class EventPrediction
{
    [DynamoDBHashKey("eventId")]
    public string EventId { get; set; } = string.Empty;

    [DynamoDBRangeKey("predictionKey")]
    public string PredictionKey { get; set; } = string.Empty;

    public string MatchId { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty;
    public string? UserDisplayName { get; set; }
    public string PredictionType { get; set; } = EventPredictionType.Winner;
    public string? PredictedWinnerTeamId { get; set; }
    public int? PredictedScoreA { get; set; }
    public int? PredictedScoreB { get; set; }
    public string? Reason { get; set; }
    public int ShareCount { get; set; }
    public string CreatedAt { get; set; } = DateTime.UtcNow.ToString("O");
    public string UpdatedAt { get; set; } = DateTime.UtcNow.ToString("O");
}

[DynamoDBTable("gettrainmate-event-comments")]
public class EventComment
{
    [DynamoDBHashKey("eventId")]
    public string EventId { get; set; } = string.Empty;

    [DynamoDBRangeKey("commentKey")]
    public string CommentKey { get; set; } = string.Empty;

    public string ThreadId { get; set; } = string.Empty;
    public string ThreadType { get; set; } = "match";
    public string UserId { get; set; } = string.Empty;
    public string? UserDisplayName { get; set; }
    public string Body { get; set; } = string.Empty;
    public string? ParentCommentKey { get; set; }
    public bool Hidden { get; set; }
    public bool Deleted { get; set; }
    public int LikeCount { get; set; }
    public string CreatedAt { get; set; } = DateTime.UtcNow.ToString("O");
    public string UpdatedAt { get; set; } = DateTime.UtcNow.ToString("O");
}

[DynamoDBTable("gettrainmate-event-bans")]
public class EventBan
{
    [DynamoDBHashKey("eventId")]
    public string EventId { get; set; } = string.Empty;

    [DynamoDBRangeKey("userId")]
    public string UserId { get; set; } = string.Empty;

    public string? Reason { get; set; }
    public string BannedAt { get; set; } = DateTime.UtcNow.ToString("O");
    public string? BannedBy { get; set; }
}

public sealed class EventHubSettings
{
    public string? HomepageHeadline { get; set; }
    public string? HomepageSubheadline { get; set; }
    public string? HomepageCtaPrimary { get; set; }
    public string? HomepageCtaSecondary { get; set; }
    public string? HomepagePromoText { get; set; }
    public string? HomepageBackgroundImage { get; set; }
    public bool HomepageVisible { get; set; } = true;
    public bool NavbarVisible { get; set; } = true;
    public string? HubRoute { get; set; }
    public bool PredictionsEnabled { get; set; } = true;
    public bool ExactScoreEnabled { get; set; } = true;
    public bool WinnerPickEnabled { get; set; } = true;
    public bool DrawPickEnabled { get; set; } = true;
    public bool CommentsEnabled { get; set; } = true;
    public bool SharingEnabled { get; set; } = true;
    public bool StandingsEnabled { get; set; }
    public bool StandingsPublished { get; set; }
}

public sealed class EventHubLiveStats
{
    public int PredictionsSubmitted { get; set; }
    public int ActiveFans { get; set; }
    public int MatchesDiscussed { get; set; }
    public int ConnectionsMade { get; set; }
}

public sealed class CommunityPulse
{
    public int TotalPredictions { get; set; }
    public string? MostPickedTeamId { get; set; }
    public string? MostPickedTeamName { get; set; }
    public string? MostDiscussedMatchId { get; set; }
    public string? MostDiscussedMatchLabel { get; set; }
    public List<FanTakePreview> LatestTakes { get; set; } = new();
}

public sealed class FanTakePreview
{
    public string? UserDisplayName { get; set; }
    public string Body { get; set; } = string.Empty;
    public string ThreadId { get; set; } = string.Empty;
    public string? PickedTeamId { get; set; }
    public string CreatedAt { get; set; } = string.Empty;
}

public sealed class PredictionExportRow
{
    public string MatchId { get; set; } = string.Empty;
    public string? MatchLabel { get; set; }
    public string UserId { get; set; } = string.Empty;
    public string? UserDisplayName { get; set; }
    public string PredictionType { get; set; } = string.Empty;
    public string? PredictedWinnerTeamId { get; set; }
    public int? PredictedScoreA { get; set; }
    public int? PredictedScoreB { get; set; }
    public string? Reason { get; set; }
    public string CreatedAt { get; set; } = string.Empty;
}

public sealed class MatchPredictionBreakdown
{
    public string MatchId { get; set; } = string.Empty;
    public int TotalPredictions { get; set; }
    public List<PredictionOutcomeShare> Outcomes { get; set; } = new();
}

public sealed class PredictionOutcomeShare
{
    public string Label { get; set; } = string.Empty;
    public string? TeamId { get; set; }
    public string OutcomeType { get; set; } = string.Empty;
    public int Count { get; set; }
    public int Percent { get; set; }
}

public sealed class TeamExplorerStats
{
    public string TeamId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Country { get; set; } = string.Empty;
    public string FlagEmoji { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int FanCount { get; set; }
    public int PredictionsCount { get; set; }
    public int DiscussionCount { get; set; }
}

public sealed class EventHubSnapshot
{
    public EventConfig Config { get; set; } = new();
    public bool EffectivelyEnabled { get; set; }
    public EventHubSettings Settings { get; set; } = new();
    public List<EventGroup> Groups { get; set; } = new();
    public List<EventTeam> Teams { get; set; } = new();
    public List<EventMatch> Matches { get; set; } = new();
    public string? FixturesLastUpdatedAt { get; set; }
}

public sealed class EventLeaderboardEntry
{
    public string UserId { get; set; } = string.Empty;
    public string? DisplayName { get; set; }
    public int Score { get; set; }
    public int PredictionsCount { get; set; }
    public int CorrectCount { get; set; }
    public int ShareCount { get; set; }
    public int CommentCount { get; set; }
}

public sealed class EventHubAnalytics
{
    public int TotalPredictions { get; set; }
    public int TotalComments { get; set; }
    public int TotalShares { get; set; }
    public int UniquePredictors { get; set; }
    public Dictionary<string, int> PredictionsPerMatch { get; set; } = new();
    public Dictionary<string, int> PopularTeams { get; set; } = new();
    public List<EventLeaderboardEntry> TopPredictors { get; set; } = new();
    public List<EventLeaderboardEntry> MostActiveFans { get; set; } = new();
    public List<EventLeaderboardEntry> MostShared { get; set; } = new();
}

public sealed class CreatePredictionRequest
{
    public string MatchId { get; set; } = string.Empty;
    public string PredictionType { get; set; } = EventPredictionType.Winner;
    public string? PredictedWinnerTeamId { get; set; }
    public int? PredictedScoreA { get; set; }
    public int? PredictedScoreB { get; set; }
    public string? Reason { get; set; }
}

public sealed class CreateCommentRequest
{
    public string ThreadId { get; set; } = string.Empty;
    public string ThreadType { get; set; } = "match";
    public string Body { get; set; } = string.Empty;
    public string? ParentCommentKey { get; set; }
}
