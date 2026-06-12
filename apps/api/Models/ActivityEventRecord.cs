namespace GetTrainMate.Api.Models;

/// <summary>Server-side analytics event stored in gettrainmate-analytics (no PII).</summary>
public class ActivityEventRecord
{
    public string EventId { get; set; } = string.Empty;
    public string EventType { get; set; } = string.Empty;
    /// <summary>UTC date partition for date-index GSI (yyyy-MM-dd).</summary>
    public string Date { get; set; } = string.Empty;
    public string Timestamp { get; set; } = string.Empty;
    public string? UserId { get; set; }
    public string? SessionId { get; set; }
    public string? Path { get; set; }
    public string? ParamsJson { get; set; }
}

/// <summary>POST /api/activity/events — client beacon body.</summary>
public class RecordActivityEventRequest
{
    public string EventType { get; set; } = string.Empty;
    public string? Path { get; set; }
    public string? SessionId { get; set; }
    public Dictionary<string, object>? Params { get; set; }
}
