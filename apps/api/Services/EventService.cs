using Amazon.DynamoDBv2;
using Amazon.DynamoDBv2.DocumentModel;
using GetTrainMate.Api.Models;

namespace GetTrainMate.Api.Services;

public class EventService : IEventService
{
    private readonly IAmazonDynamoDB _dynamoDb;
    private readonly string _eventsTable;
    private readonly ILogger<EventService> _logger;

    public EventService(
        IAmazonDynamoDB dynamoDb,
        IConfiguration configuration,
        ILogger<EventService> logger)
    {
        _dynamoDb = dynamoDb;
        var prefix = configuration["DYNAMODB_TABLE_PREFIX"] ?? "gettrainmate-";
        _eventsTable = configuration["DYNAMODB_TABLE_EVENTS"] ?? $"{prefix}events";
        _logger = logger;
    }

    public async Task<List<Event>> GetEventsAsync(int limit = 50)
    {
        try
        {
            var table = Table.LoadTable(_dynamoDb, _eventsTable);
            var search = table.Scan(new ScanFilter());
            var events = new List<Event>();

            do
            {
                var batch = await search.GetNextSetAsync();
                foreach (var doc in batch)
                {
                    if (!TryDocumentToEvent(doc, out var evt))
                        continue;
                    // Only return future events
                    if (evt.EventDate > DateTime.UtcNow)
                    {
                        events.Add(evt);
                    }
                }
            } while (!search.IsDone);

            return events
                .OrderBy(e => e.EventDate)
                .Take(limit)
                .ToList();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting events");
            throw;
        }
    }

    public async Task<List<Event>> ListAllEventsForAdminAsync()
    {
        try
        {
            var table = Table.LoadTable(_dynamoDb, _eventsTable);
            var search = table.Scan(new ScanFilter());
            var events = new List<Event>();
            do
            {
                var batch = await search.GetNextSetAsync();
                foreach (var doc in batch)
                {
                    if (TryDocumentToEvent(doc, out var evt))
                        events.Add(evt);
                }
            } while (!search.IsDone);

            return events;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error listing events for admin");
            throw;
        }
    }

    public async Task<Event?> GetEventAsync(string eventId)
    {
        try
        {
            var table = Table.LoadTable(_dynamoDb, _eventsTable);
            var doc = await table.GetItemAsync(eventId);
            return doc != null && TryDocumentToEvent(doc, out var evt) ? evt : null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting event {EventId}", eventId);
            return null;
        }
    }

    public async Task<Event> CreateEventAsync(CreateEventRequest request, string userId, string userName)
    {
        try
        {
            var evt = new Event
            {
                Title = request.Title,
                Description = request.Description,
                Sport = request.Sport,
                City = request.City,
                Latitude = request.Latitude,
                Longitude = request.Longitude,
                EventDate = request.EventDate,
                SkillLevel = request.SkillLevel,
                MaxParticipants = request.MaxParticipants,
                OrganizerUserId = userId,
                OrganizerName = userName,
                ParticipantIds = new List<string> { userId }
            };

            var table = Table.LoadTable(_dynamoDb, _eventsTable);
            var doc = EventToDocument(evt);
            await table.PutItemAsync(doc);

            return evt;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating event");
            throw;
        }
    }

    public async Task PutEventAsync(Event evt)
    {
        var table = Table.LoadTable(_dynamoDb, _eventsTable);
        var doc = EventToDocument(evt);
        await table.PutItemAsync(doc);
    }

    public async Task<bool> DeleteEventByIdAsync(string eventId)
    {
        try
        {
            var table = Table.LoadTable(_dynamoDb, _eventsTable);
            await table.DeleteItemAsync(eventId);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting event {EventId}", eventId);
            return false;
        }
    }

    public async Task<bool> JoinEventAsync(string eventId, string userId)
    {
        try
        {
            var evt = await GetEventAsync(eventId);
            if (evt == null)
                return false;

            if (evt.ParticipantIds.Contains(userId))
                return true; // Already joined

            if (evt.ParticipantIds.Count >= evt.MaxParticipants)
                return false; // Event full

            evt.ParticipantIds.Add(userId);
            evt.UpdatedAt = DateTime.UtcNow;

            var table = Table.LoadTable(_dynamoDb, _eventsTable);
            var doc = EventToDocument(evt);
            await table.PutItemAsync(doc);

            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error joining event");
            return false;
        }
    }

    public async Task<bool> LeaveEventAsync(string eventId, string userId)
    {
        try
        {
            var evt = await GetEventAsync(eventId);
            if (evt == null)
                return false;

            evt.ParticipantIds.Remove(userId);
            evt.UpdatedAt = DateTime.UtcNow;

            var table = Table.LoadTable(_dynamoDb, _eventsTable);
            var doc = EventToDocument(evt);
            await table.PutItemAsync(doc);

            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error leaving event");
            return false;
        }
    }

    public async Task<List<Event>> GetUserEventsAsync(string userId)
    {
        try
        {
            var events = await GetEventsAsync(1000);
            return events
                .Where(e => e.ParticipantIds.Contains(userId))
                .ToList();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting user events");
            throw;
        }
    }

    private Document EventToDocument(Event evt)
    {
        var doc = new Document
        {
            ["eventId"] = evt.EventId,
            ["title"] = evt.Title,
            ["description"] = evt.Description,
            ["sport"] = evt.Sport,
            ["city"] = evt.City,
            ["eventDate"] = evt.EventDate.ToString("O"),
            ["skillLevel"] = evt.SkillLevel,
            ["maxParticipants"] = evt.MaxParticipants,
            ["organizerUserId"] = evt.OrganizerUserId,
            ["organizerName"] = evt.OrganizerName,
            ["createdAt"] = evt.CreatedAt.ToString("O"),
            ["updatedAt"] = evt.UpdatedAt.ToString("O")
        };

        if (evt.Latitude.HasValue) doc["latitude"] = evt.Latitude.Value;
        if (evt.Longitude.HasValue) doc["longitude"] = evt.Longitude.Value;
        if (evt.ParticipantIds.Any())
            doc["participantIds"] = new DynamoDBList(evt.ParticipantIds.Select(id => new Primitive(id)));

        return doc;
    }

    private static bool TryDocumentToEvent(Document doc, out Event evt)
    {
        evt = null!;
        try
        {
            var id = doc.ContainsKey("eventId") ? doc["eventId"].AsString()
                : doc.ContainsKey("EventId") ? doc["EventId"].AsString() : null;
            if (string.IsNullOrEmpty(id))
                return false;

            static string S(Document d, string a, string b = "") =>
                d.ContainsKey(a) ? d[a].AsString() : !string.IsNullOrEmpty(b) && d.ContainsKey(b) ? d[b].AsString() : "";

            static DateTime ParseDt(Document d, string a, string b)
            {
                var raw = d.ContainsKey(a) ? d[a].AsString() : d.ContainsKey(b) ? d[b].AsString() : null;
                if (string.IsNullOrEmpty(raw)) return DateTime.UtcNow;
                return DateTime.TryParse(raw, out var dt) ? dt : DateTime.UtcNow;
            }

            evt = new Event
            {
                EventId = id,
                Title = S(doc, "title", "Title"),
                Description = S(doc, "description", "Description"),
                Sport = S(doc, "sport", "Sport"),
                City = S(doc, "city", "City"),
                Latitude = doc.ContainsKey("latitude") ? (double?)doc["latitude"].AsDouble()
                    : doc.ContainsKey("Latitude") ? (double?)doc["Latitude"].AsDouble() : null,
                Longitude = doc.ContainsKey("longitude") ? (double?)doc["longitude"].AsDouble()
                    : doc.ContainsKey("Longitude") ? (double?)doc["Longitude"].AsDouble() : null,
                EventDate = ParseDt(doc, "eventDate", "EventDate"),
                SkillLevel = S(doc, "skillLevel", "SkillLevel"),
                MaxParticipants = doc.ContainsKey("maxParticipants") ? (int)doc["maxParticipants"].AsInt()
                    : doc.ContainsKey("MaxParticipants") ? (int)doc["MaxParticipants"].AsInt() : 10,
                OrganizerUserId = S(doc, "organizerUserId", "OrganizerUserId"),
                OrganizerName = S(doc, "organizerName", "OrganizerName"),
                ParticipantIds = doc.ContainsKey("participantIds") ? doc["participantIds"].AsListOfString()
                    : doc.ContainsKey("ParticipantIds") ? doc["ParticipantIds"].AsListOfString() : new List<string>(),
                CreatedAt = ParseDt(doc, "createdAt", "CreatedAt"),
                UpdatedAt = ParseDt(doc, "updatedAt", "UpdatedAt")
            };
            return true;
        }
        catch
        {
            return false;
        }
    }
}
