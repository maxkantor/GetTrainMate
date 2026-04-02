using GetTrainMate.Api.Models;

namespace GetTrainMate.Api.Services;

/// <summary>Tracks last client activity for online detection (chat email suppression).</summary>
public interface IUserActivityService
{
    Task RecordHeartbeatAsync(string userId, string? activeChatThreadId = null, CancellationToken cancellationToken = default);

    Task<UserActivitySnapshot?> GetActivityAsync(string userId, CancellationToken cancellationToken = default);
}
