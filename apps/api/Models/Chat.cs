using Amazon.DynamoDBv2.DataModel;

namespace GetTrainMate.Api.Models;

public class ChatThread
{
    public string ThreadId { get; set; } = Guid.NewGuid().ToString();
    public string? MatchId { get; set; }
    public List<string> ParticipantIds { get; set; } = new();
    public bool UnlockedByUserA { get; set; }
    public bool UnlockedByUserB { get; set; }
    public string LastMessage { get; set; } = string.Empty;
    public DateTime LastMessageAt { get; set; } = DateTime.UtcNow;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

[DynamoDBTable("gettrainmate-messages")]
public class ChatMessage
{
    [DynamoDBHashKey]
    public string ThreadId { get; set; } = string.Empty;

    [DynamoDBRangeKey]
    public string MessageId { get; set; } = Guid.NewGuid().ToString();
    
    public string SenderId { get; set; } = string.Empty;
    public string SenderName { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public bool IsRead { get; set; } = false;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class SendMessageRequest
{
    public string ThreadId { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
}

public class CreateThreadRequest
{
    public string OtherUserId { get; set; } = string.Empty;
}

public class ThreadPreviewResponse
{
    public string ThreadId { get; set; } = string.Empty;
    public string OtherUserId { get; set; } = string.Empty;
    public string OtherUserName { get; set; } = string.Empty;
    public string LastMessage { get; set; } = string.Empty;
    public DateTime LastMessageAt { get; set; }
    public int UnreadCount { get; set; } = 0;
}

public class ThreadByMatchResponse
{
    public string ThreadId { get; set; } = string.Empty;
    public bool UnlockedByCurrentUser { get; set; }
}

public class UnlockChatRequest
{
    public string MatchId { get; set; } = string.Empty;
}
