namespace GetTrainMate.Api.Models;

/// <summary>Stored in DynamoDB user-activity; used to suppress chat emails when the user is active or viewing a thread.</summary>
public class UserActivitySnapshot
{
    public DateTime? LastSeenUtc { get; set; }
    /// <summary>Match thread id when the user has the chat UI focused on that thread.</summary>
    public string? ActiveChatThreadId { get; set; }
}
