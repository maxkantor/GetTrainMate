using GetTrainMate.Api.Models;

namespace GetTrainMate.Api.Services;

public interface IMatchService
{
    Task<int> SeedDemoProfilesAsync();
    Task<CompatibilityInfo?> GetCompatibilityAsync(string userId, string targetUserId);
    Task<List<MatchFeedItem>> GetDiscoveryFeedAsync(string userId, int limit = 20, bool ignoreSkippedForAdmin = false);
    Task<List<SentRequestItem>> ListSentRequestsAsync(string userId);
    /// <summary>Pending one-way interests where <paramref name="viewerUserId"/> is the target (someone liked you, not yet mutual).</summary>
    Task<List<SentRequestItem>> ListIncomingPendingLikesAsync(string viewerUserId);
    Task<List<SkippedProfileItem>> ListSkippedProfilesAsync(string userId);
    Task<MatchResponse> LikeUserAsync(string userId, string targetUserId);
    Task<MatchResponse> PassUserAsync(string userId, string targetUserId);
    /// <summary>Withdraw a pending (one-way) sent invite; sets interaction to CANCELLED and removes the pending match row.</summary>
    Task CancelSentInviteAsync(string userId, string targetUserId);
    Task<bool> UndoPassAsync(string userId, string targetUserId);
    Task<DiscoverSkipRecord?> GetLastSkippedProfileAsync(string userId);
    Task<AdminDiscoverControls> GetAdminDiscoverControlsAsync();
    Task<AdminDiscoverControls> SetAdminDiscoverControlsAsync(bool ignoreSkippedProfilesInDiscoverForAdmin);
    Task<List<AdminDiscoverProfileRow>> ListAdminDiscoverProfilesAsync(string filter = "all", int limit = 200);
    Task<bool> AdminSetProfileDiscoverStatusAsync(string profileUserId, string status, string adminUserId);
    Task<bool> AdminResetProfileInteractionStateAsync(string profileUserId);
    /// <summary>One-time repair: rebuild user-interactions from matches + discover-passes (fixes stale SKIPPED vs SENT).</summary>
    Task<int> RebuildUserInteractionsFromLegacyAsync(CancellationToken cancellationToken = default);
    Task<List<Match>> GetUserMatchesAsync(string userId);
    Task<Match?> GetMatchAsync(string userId1, string userId2);
    Task<Match?> GetMatchByIdAsync(string matchId);

    Task<AdminDiscoverResetResult> AdminResetUserSkippedAsync(string userId, CancellationToken cancellationToken = default);
    Task<AdminDiscoverResetResult> AdminResetUserOutgoingSentAsync(string userId, CancellationToken cancellationToken = default);
    Task<AdminDiscoverResetResult> AdminResetUserDiscoverStateAsync(string userId, bool removeMatchesAndChats, CancellationToken cancellationToken = default);
}
