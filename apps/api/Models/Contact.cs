using Amazon.DynamoDBv2.DataModel;

namespace GetTrainMate.Api.Models;

[DynamoDBTable("gettrainmate-contacts")]
public class Contact
{
    [DynamoDBHashKey]
    public string ContactId { get; set; } = Guid.NewGuid().ToString();

    public string Name { get; set; } = string.Empty;
    
    [DynamoDBGlobalSecondaryIndexHashKey("email-index")]
    public string Email { get; set; } = string.Empty; // stored lowercase
    
    public string? Phone { get; set; }
    public List<string> Tags { get; set; } = new();
    public string Status { get; set; } = "active"; // active, blocked
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public bool SoftDeleted { get; set; } = false;
}

[DynamoDBTable("gettrainmate-contact-email-threads")]
public class ContactEmailThread
{
    [DynamoDBHashKey]
    public string ContactId { get; set; } = string.Empty;

    [DynamoDBRangeKey]
    public string ThreadId { get; set; } = Guid.NewGuid().ToString();

    public string Subject { get; set; } = string.Empty;
    public DateTime LastMessageAt { get; set; } = DateTime.UtcNow;
    public string? LastFrom { get; set; }
    public int MessageCount { get; set; } = 0;
    public string Status { get; set; } = "open"; // open, closed
    public List<string> Labels { get; set; } = new();
}

[DynamoDBTable("gettrainmate-contact-email-messages")]
public class ContactEmailMessage
{
    [DynamoDBHashKey]
    public string ThreadId { get; set; } = string.Empty;

    [DynamoDBRangeKey]
    public string MessageId { get; set; } = $"{DateTime.UtcNow:yyyy-MM-ddTHH:mm:ss.fffZ}#{Guid.NewGuid()}";

    public string From { get; set; } = string.Empty;
    public List<string> To { get; set; } = new();
    public List<string> Cc { get; set; } = new();
    public List<string> Bcc { get; set; } = new();
    public string Subject { get; set; } = string.Empty;
    public string BodyText { get; set; } = string.Empty;
    public string? BodyHtml { get; set; }
    public List<EmailAttachmentMeta> AttachmentsMeta { get; set; } = new();
    public string? SesMessageId { get; set; }
    public string Direction { get; set; } = "outbound"; // inbound, outbound
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class EmailAttachmentMeta
{
    public string FileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long Size { get; set; }
    public string? S3Key { get; set; }
}
