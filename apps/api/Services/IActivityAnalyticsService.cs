using GetTrainMate.Api.Models;

namespace GetTrainMate.Api.Services;

public interface IActivityAnalyticsService
{
    Task RecordEventAsync(
        string eventType,
        string? path = null,
        string? userId = null,
        string? sessionId = null,
        IReadOnlyDictionary<string, object>? parameters = null,
        CancellationToken cancellationToken = default);

    Task<(List<ActivityEventRecord> Items, int TotalCount)> GetEventsAsync(
        string? eventType = null,
        DateTime? from = null,
        DateTime? to = null,
        int page = 1,
        int pageSize = 50,
        CancellationToken cancellationToken = default);
}
