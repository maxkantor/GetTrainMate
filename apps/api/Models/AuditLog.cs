using Amazon.DynamoDBv2.DataModel;
using System.Text.Json;

namespace GetTrainMate.Api.Models;

[DynamoDBTable("gettrainmate-audit-log")]
public class AuditLog
{
    [DynamoDBHashKey]
    public string LogId { get; set; } = Guid.NewGuid().ToString();

    [DynamoDBRangeKey]
    public string Timestamp { get; set; } = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ");

    // Admin identity
    public string AdminSub { get; set; } = string.Empty;
    public string? AdminEmail { get; set; }
    public string? AdminUsername { get; set; }

    // Action details
    public string Action { get; set; } = string.Empty; // e.g., "user.ban", "token.add", "contact.create"
    public string TargetType { get; set; } = string.Empty; // e.g., "user", "token", "contact"
    public string? TargetId { get; set; }

    // Change tracking
    public string? BeforeJson { get; set; }
    public string? AfterJson { get; set; }

    // Request tracking
    public string? RequestId { get; set; }
    public string? IpAddress { get; set; }
    public string? UserAgent { get; set; }

    // Metadata
    public Dictionary<string, string> Metadata { get; set; } = new();
}
