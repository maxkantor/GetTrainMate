using GetTrainMate.Api.Models;

namespace GetTrainMate.Api.Services;

public interface IMatchService
{
    Task<int> SeedDemoProfilesAsync();
    Task<List<MatchFeedItem>> GetDiscoveryFeedAsync(string userId, int limit = 20);
    Task<MatchResponse> LikeUserAsync(string userId, string targetUserId);
    Task<MatchResponse> PassUserAsync(string userId, string targetUserId);
    Task<List<Match>> GetUserMatchesAsync(string userId);
    Task<Match?> GetMatchAsync(string userId1, string userId2);
    Task<Match?> GetMatchByIdAsync(string matchId);
}
