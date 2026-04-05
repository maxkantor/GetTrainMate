using GetTrainMate.Api.Models;

namespace GetTrainMate.Api.Services;

public interface IEventService
{
    Task<List<Event>> GetEventsAsync(int limit = 50);
    /// <summary>Full scan for admin CRM (camelCase Dynamo items from GraphQL / mobile).</summary>
    Task<List<Event>> ListAllEventsForAdminAsync();
    Task<Event?> GetEventAsync(string eventId);
    Task<Event> CreateEventAsync(CreateEventRequest request, string userId, string userName);
    /// <summary>Persist event using the same document shape as the rest of the app.</summary>
    Task PutEventAsync(Event evt);
    Task<bool> DeleteEventByIdAsync(string eventId);
    Task<bool> JoinEventAsync(string eventId, string userId);
    Task<bool> LeaveEventAsync(string eventId, string userId);
    Task<List<Event>> GetUserEventsAsync(string userId);
}
