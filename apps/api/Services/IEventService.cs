using GetTrainMate.Api.Models;

namespace GetTrainMate.Api.Services;

public interface IEventService
{
    Task<List<Event>> GetEventsAsync(int limit = 50);
    Task<Event?> GetEventAsync(string eventId);
    Task<Event> CreateEventAsync(CreateEventRequest request, string userId, string userName);
    Task<bool> JoinEventAsync(string eventId, string userId);
    Task<bool> LeaveEventAsync(string eventId, string userId);
    Task<List<Event>> GetUserEventsAsync(string userId);
}
