using GetTrainMate.Api.Models;

namespace GetTrainMate.Api.Services;

public interface IMatchService
{
    Task<int> SeedDemoProfilesAsync();
    Task<CompatibilityInfo?> GetCompatibilityAsync(string userId, string targetUserId);
    Task<List<MatchFeedItem>> GetDiscoveryFeedAsync(string userId, int limit = 20, bool ignoreSkippedForAdmin = false);
    Task<List<SentRequestItem>> ListSentRequestsAsync(string userId);
    Task<List<SkippedProfileItem>> ListSkippedProfilesAsync(string userId);
    Task<MatchResponse> LikeUserAsync(string userId, string targetUserId);
    Task<MatchResponse> PassUserAsync(string userId, string targetUserId);
    Task<bool> UndoPassAsync(string userId, string targetUserId);
    Task<DiscoverSkipRecord?> GetLastSkippedProfileAsync(string userId);
    Task<AdminDiscoverControls> GetAdminDiscoverControlsAsync();
    Task<AdminDiscoverControls> SetAdminDiscoverControlsAsync(bool ignoreSkippedProfilesInDiscoverForAdmin);
    Task<List<AdminDiscoverProfileRow>> ListAdminDiscoverProfilesAsync(string filter = "all", int limit = 200);
    Task<bool> AdminSetProfileDiscoverStatusAsync(string profileUserId, string status, string adminUserId);
    Task<bool> AdminResetProfileInteractionStateAsync(string profileUserId);
    Task<List<Match>> GetUserMatchesAsync(string userId);
    Task<Match?> GetMatchAsync(string userId1, string userId2);
    Task<Match?> GetMatchByIdAsync(string matchId);
}
