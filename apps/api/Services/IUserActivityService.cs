using GetTrainMate.Api.Models;

namespace GetTrainMate.Api.Services;

/// <summary>Tracks last client activity for online detection (chat email suppression).</summary>
public interface IUserActivityService
{
    Task RecordHeartbeatAsync(
        string userId,
        string? activeChatThreadId = null,
        string? currentPath = null,
        CancellationToken cancellationToken = default);

    Task<UserActivitySnapshot?> GetActivityAsync(string userId, CancellationToken cancellationToken = default);

    Task<int> CountActiveUsersAsync(DateTime sinceUtc, CancellationToken cancellationToken = default);
}
