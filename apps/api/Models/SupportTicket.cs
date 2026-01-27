using Amazon.DynamoDBv2.DataModel;

namespace GetTrainMate.Api.Models;

[DynamoDBTable("gettrainmate-support-tickets")]
public class SupportTicket
{
    [DynamoDBHashKey]
    public string TicketId { get; set; } = Guid.NewGuid().ToString();

    public string Subject { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    
    [DynamoDBGlobalSecondaryIndexHashKey("userId-index")]
    public string? UserId { get; set; }
    
    [DynamoDBGlobalSecondaryIndexHashKey("status-index")]
    public string Status { get; set; } = "open"; // open, in_progress, resolved, closed
    
    public string Priority { get; set; } = "medium"; // low, medium, high, urgent
    public List<string> AdminNotes { get; set; } = new();
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
