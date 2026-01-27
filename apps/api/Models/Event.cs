using Amazon.DynamoDBv2.DataModel;

namespace GetTrainMate.Api.Models;

[DynamoDBTable("gettrainmate-events")]
public class Event
{
    [DynamoDBHashKey]
    public string EventId { get; set; } = Guid.NewGuid().ToString();
    
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Sport { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public DateTime EventDate { get; set; }
    public string SkillLevel { get; set; } = string.Empty; // beginner, intermediate, advanced, pro
    public int MaxParticipants { get; set; } = 10;
    public List<string> ParticipantIds { get; set; } = new();
    public string OrganizerUserId { get; set; } = string.Empty;
    public string OrganizerName { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public class CreateEventRequest
{
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Sport { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public DateTime EventDate { get; set; }
    public string SkillLevel { get; set; } = string.Empty;
    public int MaxParticipants { get; set; } = 10;
}

public class EventResponse
{
    public string EventId { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Sport { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public DateTime EventDate { get; set; }
    public string SkillLevel { get; set; } = string.Empty;
    public int MaxParticipants { get; set; }
    public int ParticipantCount { get; set; }
    public bool IsJoined { get; set; }
    public string OrganizerName { get; set; } = string.Empty;
}
