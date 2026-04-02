namespace GetTrainMate.Api.Models;

/// <summary>Hints computed when a message is saved — drives smart priority without circular service deps.</summary>
public class ChatNotificationHints
{
    /// <summary>First inbound message from this sender in the thread.</summary>
    public bool IsFirstMessageFromSender { get; set; }

    /// <summary>Sender replied after the other person was quiet for 1h+.</summary>
    public bool IsReplyAfterInactivity { get; set; }

    /// <summary>3+ messages from sender within ~60s — treat as low-priority burst.</summary>
    public bool IsBurstSpam { get; set; }
}
