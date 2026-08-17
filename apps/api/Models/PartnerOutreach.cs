using Amazon.DynamoDBv2.DataModel;

namespace GetTrainMate.Api.Models;

[DynamoDBTable("gettrainmate-partner-prospects")]
public class PartnerProspect
{
    [DynamoDBHashKey]
    public string ProspectId { get; set; } = Guid.NewGuid().ToString();
    public string OrganizationName { get; set; } = "";
    public string OrganizationType { get; set; } = "";
    public string? Website { get; set; }
    public string Email { get; set; } = "";
    public string EmailSource { get; set; } = "public_listing"; // public_listing | owner_supplied | prior_engagement
    public string? ContactName { get; set; }
    public string Country { get; set; } = "";
    public string? Region { get; set; }
    public string City { get; set; } = "";
    public string Metro { get; set; } = "";
    public string? Timezone { get; set; }
    public string PrimaryLanguage { get; set; } = "en";
    public string CampaignLanguage { get; set; } = "en";
    public string? OfficialDomain { get; set; }
    public string? EmailVerifiedOn { get; set; }
    public string Mode { get; set; } = "TRAIN";
    public string? CampaignId { get; set; }
    public string Activity { get; set; } = "training";
    public string? SourceUrl { get; set; }
    public string? SourceVerifiedOn { get; set; }
    public string? PartnerCode { get; set; }
    public string? LandingUrl { get; set; }
    public string Status { get; set; } = "prospect";
    public string Owner { get; set; } = "Max";
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? LastContactedAt { get; set; }
}

[DynamoDBTable("gettrainmate-partner-campaigns")]
public class PartnerCampaign
{
    [DynamoDBHashKey]
    public string CampaignId { get; set; } = Guid.NewGuid().ToString();
    public string Name { get; set; } = "";
    public string Status { get; set; } = "candidate"; // active | paused | candidate
    public string Country { get; set; } = "";
    public string Market { get; set; } = "";
    public string DisplayName { get; set; } = "";
    public string PrimaryMode { get; set; } = "TRAIN";
    public string Timezone { get; set; } = "";
    public List<string> Languages { get; set; } = new() { "en" };
    public int AllocationPercent { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

[DynamoDBTable("gettrainmate-partner-approvals")]
public class PartnerApproval
{
    [DynamoDBHashKey]
    public string ApprovalId { get; set; } = Guid.NewGuid().ToString();
    public string CampaignId { get; set; } = "";
    public string ProspectId { get; set; } = "";
    public string Recipient { get; set; } = "";
    public string Subject { get; set; } = "";
    public string BodyText { get; set; } = "";
    public string PartnerUrl { get; set; } = "";
    public string Fingerprint { get; set; } = "";
    public string TemplateVersion { get; set; } = "";
    public string Approver { get; set; } = "";
    public DateTime ApprovedAt { get; set; } = DateTime.UtcNow;
    public string Status { get; set; } = "approved";
}

[DynamoDBTable("gettrainmate-partner-queue")]
public class PartnerQueueItem
{
    [DynamoDBHashKey]
    public string QueueId { get; set; } = Guid.NewGuid().ToString();
    public string ApprovalId { get; set; } = "";
    public string ProspectId { get; set; } = "";
    public string CampaignId { get; set; } = "";
    public string Recipient { get; set; } = "";
    public string OrganizationName { get; set; } = "";
    public string Subject { get; set; } = "";
    public string BodyText { get; set; } = "";
    public string BodyHtml { get; set; } = "";
    public string PartnerUrl { get; set; } = "";
    public string Fingerprint { get; set; } = "";
    public string Status { get; set; } = "queued";
    public string? InternalMessageId { get; set; }
    public string? SesMessageId { get; set; }
    public string? RfcMessageId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? SentAt { get; set; }
    public string? LastError { get; set; }
}

[DynamoDBTable("gettrainmate-partner-threads")]
public class PartnerThread
{
    [DynamoDBHashKey]
    public string ThreadId { get; set; } = Guid.NewGuid().ToString();
    public string ProspectId { get; set; } = "";
    public string? QueueId { get; set; }
    public string Subject { get; set; } = "";
    public DateTime LastMessageAt { get; set; } = DateTime.UtcNow;
    public int MessageCount { get; set; }
}

[DynamoDBTable("gettrainmate-partner-messages")]
public class PartnerMessage
{
    [DynamoDBHashKey]
    public string ThreadId { get; set; } = "";
    [DynamoDBRangeKey]
    public string MessageId { get; set; } = "";
    public string Direction { get; set; } = "outbound";
    public string From { get; set; } = "";
    public string To { get; set; } = "";
    public string Subject { get; set; } = "";
    public string BodyText { get; set; } = "";
    public string? BodyHtmlSafe { get; set; }
    public string DeliveryStatus { get; set; } = "queued";
    public string? RfcMessageId { get; set; }
    public string? InReplyTo { get; set; }
    public List<string> References { get; set; } = new();
    public string? SesMessageId { get; set; }
    public string? InternalMessageId { get; set; }
    public List<EmailAttachmentMeta> Attachments { get; set; } = new();
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

[DynamoDBTable("gettrainmate-partner-suppressions")]
public class PartnerSuppression
{
    [DynamoDBHashKey]
    public string Email { get; set; } = "";
    public string Reason { get; set; } = "";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

[DynamoDBTable("gettrainmate-partner-settings")]
public class PartnerOutreachSettingsRow
{
    [DynamoDBHashKey]
    public string Id { get; set; } = "default";
    public bool ComplaintPause { get; set; }
    public int SentCount { get; set; }
    public int BounceCount { get; set; }
    public int ComplaintCount { get; set; }
    public int ReplyCount { get; set; }
}

[DynamoDBTable("gettrainmate-partner-inbound-dedupe")]
public class PartnerInboundDedupe
{
    [DynamoDBHashKey]
    public string DedupeKey { get; set; } = "";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
