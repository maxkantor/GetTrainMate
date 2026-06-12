using GetTrainMate.Api.Models;

namespace GetTrainMate.Api.Services;

public interface IEventHubService
{
    Task EnsureWorldCupSeedAsync();
    bool IsEventEffectivelyEnabled(EventConfig config);
    EventHubSettings MapSettings(EventConfig config);

    Task<EventHubSnapshot?> GetHubSnapshotAsync(string eventId, bool allowDisabledForAdmin = false);
    Task<List<EventGroup>> GetGroupsAsync(string eventId);
    Task<List<EventTeam>> GetTeamsAsync(string eventId, string? groupId = null);
    Task<List<EventMatch>> GetMatchesAsync(string eventId, string? date = null);
    Task<List<EventComment>> GetCommentsAsync(string eventId, string threadId);
    Task<List<EventLeaderboardEntry>> GetLeaderboardAsync(string eventId, string type);

    Task<EventGroup> UpsertGroupAsync(EventGroup group);
    Task DeleteGroupAsync(string eventId, string groupId);
    Task<EventTeam> UpsertTeamAsync(EventTeam team);
    Task DeleteTeamAsync(string eventId, string teamId);
    Task<EventMatch> UpsertMatchAsync(EventMatch match, bool touchTimestamp = true, bool skipDuplicateCheck = false);
    Task DeleteMatchAsync(string eventId, string matchId);

    Task<EventPrediction?> GetUserPredictionAsync(string eventId, string matchId, string userId);
    Task<UserPicksSummary> GetUserPicksSummaryAsync(string eventId, string userId);
    Task<List<EventPrediction>> GetPredictionsForMatchAsync(string eventId, string matchId);
    Task<EventPrediction> CreateOrUpdatePredictionAsync(string eventId, string userId, string? displayName, CreatePredictionRequest request);
    Task IncrementPredictionShareAsync(string eventId, string matchId, string userId);

    Task<EventComment> CreateCommentAsync(string eventId, string userId, string? displayName, CreateCommentRequest request);
    Task HideCommentAsync(string eventId, string commentKey);
    Task DeleteCommentAsync(string eventId, string commentKey);
    Task BanUserAsync(string eventId, string userId, string? reason, string? bannedBy);
    Task<bool> IsUserBannedAsync(string eventId, string userId);

    Task<EventHubAnalytics> GetAnalyticsAsync(string eventId);
    Task<EventHubLiveStats> GetLiveStatsAsync(string eventId);
    Task<CommunityPulse> GetCommunityPulseAsync(string eventId);
    Task<List<PredictionExportRow>> ExportPredictionsAsync(string eventId);
    Task<MatchPredictionBreakdown> GetMatchPredictionBreakdownAsync(string eventId, string matchId);
    Task<List<TeamExplorerStats>> GetTeamExplorerStatsAsync(string eventId);
    Task<List<EventComment>> GetTrendingCommentsAsync(string eventId, string sort = "trending");
    Task LikeCommentAsync(string eventId, string commentKey);
}
