using Amazon.DynamoDBv2.DataModel;

namespace GetTrainMate.Api.Models;

[DynamoDBTable("gettrainmate-feature-flags")]
public class FeatureFlag
{
    [DynamoDBHashKey("flagKey")]
    public string FlagKey { get; set; } = string.Empty;
    public bool Enabled { get; set; }
    public string Environment { get; set; } = "prod";
    public string Description { get; set; } = string.Empty;
    public string UpdatedAt { get; set; } = DateTime.UtcNow.ToString("O");
    public string? UpdatedBy { get; set; }
}

[DynamoDBTable("gettrainmate-event-configs")]
public class EventConfig
{
    [DynamoDBHashKey("eventId")]
    public string EventId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public string Sport { get; set; } = string.Empty;
    public bool Enabled { get; set; }
    public bool IsFeatured { get; set; }
    public string StartDate { get; set; } = string.Empty;
    public string EndDate { get; set; } = string.Empty;
    public string Icon { get; set; } = "🏅";
    public string? ThemeColor { get; set; }
    public string? BannerImageUrl { get; set; }
    public string? LandingHeadline { get; set; }
    public string Description { get; set; } = string.Empty;
    public List<string> Activities { get; set; } = new();
    public List<string> Tags { get; set; } = new();
    public List<string>? Teams { get; set; }
    public List<string>? Locations { get; set; }
    public bool BoostEnabled { get; set; }
    public double? BoostPrice { get; set; }
    public string? BoostLabel { get; set; }
    public string? StripePriceIdDev { get; set; }
    public string? StripePriceIdProd { get; set; }
    public string CreatedAt { get; set; } = DateTime.UtcNow.ToString("O");
    public string UpdatedAt { get; set; } = DateTime.UtcNow.ToString("O");
}

[DynamoDBTable("gettrainmate-event-meetups")]
public class EventMeetup
{
    [DynamoDBHashKey("meetupId")]
    public string MeetupId { get; set; } = Guid.NewGuid().ToString("N");
    public string EventId { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string ActivityType { get; set; } = "watch";
    public string Sport { get; set; } = string.Empty;
    public string? Team { get; set; }
    public string LocationText { get; set; } = string.Empty;
    public string? City { get; set; }
    public string? State { get; set; }
    public string? StartTime { get; set; }
    public string CreatedByUserId { get; set; } = string.Empty;
    public string Visibility { get; set; } = "public";
    public string Status { get; set; } = "active";
    public string CreatedAt { get; set; } = DateTime.UtcNow.ToString("O");
    public string UpdatedAt { get; set; } = DateTime.UtcNow.ToString("O");
}

public sealed class SportsEventLayerConfigResponse
{
    public Dictionary<string, bool> Flags { get; set; } = new();
    public List<EventConfig> ActiveEvents { get; set; } = new();
    public EventConfig? FeaturedEvent { get; set; }
}
