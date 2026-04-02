namespace GetTrainMate.Api.Models;

/// <summary>POST /api/me/activity — optional body.</summary>
public class ActivityHeartbeatRequest
{
    /// <summary>When set, suppresses email notifications for new messages in this thread (user is viewing it).</summary>
    public string? ActiveThreadId { get; set; }
}
