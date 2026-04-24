using GetTrainMate.Api.Models;

namespace GetTrainMate.Api.Services;

public interface ISportsEventLayerService
{
    Task<Dictionary<string, bool>> GetFeatureFlagsAsync(string environment, bool allowLocalOverrides);
    Task<FeatureFlag> UpsertFeatureFlagAsync(FeatureFlag flag);
    Task<List<EventConfig>> GetAllEventConfigsAsync();
    Task<List<EventConfig>> GetActiveEventConfigsAsync(bool allowDisabledForAdmin = false);
    Task<EventConfig?> GetEventConfigAsync(string eventId);
    Task<EventConfig> UpsertEventConfigAsync(EventConfig config);
    Task<List<EventMeetup>> GetMeetupsForEventAsync(string eventId);
    Task<EventMeetup> CreateMeetupAsync(EventMeetup meetup);
    Task EnsureDefaultSeedDataAsync();
}
