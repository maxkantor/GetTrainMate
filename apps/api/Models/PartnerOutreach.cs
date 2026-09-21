using Amazon.DynamoDBv2.DataModel;

namespace GetTrainMate.Api.Models;

[DynamoDBTable("gettrainmate-partner-prospects")]
public class PartnerProspect
{
    [DynamoDBHashKey]
    public string ProspectId { get; set; } = Guid.NewGuid().ToString();
    public string OrganizationName { get; set; } = "";
    public string OrganizationType { get; set; } = "";
    /// <summary>organization | individual</summary>
    public string ProspectType { get; set; } = "organization";
    /// <summary>INDIVIDUAL | ORGANIZATION — derived from ProspectType when empty.</summary>
    public string? EntityType { get; set; }
    public string? Website { get; set; }
    public string Email { get; set; } = "";
    public string EmailSource { get; set; } = "public_listing"; // public_listing | owner_supplied | prior_engagement
    public string? ContactName { get; set; }
    public string? ContactRole { get; set; }
    public string? Phone { get; set; }
    public string? FacebookUrl { get; set; }
    public string? InstagramUrl { get; set; }
    public string? LinkedInUrl { get; set; }
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
    /// <summary>NEW|QUALIFIED|CONTACTED|FOLLOW_UP|REPLIED|INTERESTED|PARTNER|CLOSED</summary>
    public string? CrmLifecycle { get; set; }
    /// <summary>UNKNOWN|RESEARCHING|CONTACT_FOUND|CONTACT_NEEDED|INVALID</summary>
    public string? ContactState { get; set; }
    /// <summary>DRAFT|AWAITING_APPROVAL|APPROVED|SCHEDULED|SENDING|SENT|DELIVERED|BOUNCED|COMPLAINED|OPTED_OUT|FAILED</summary>
    public string? EmailState { get; set; }
    public string Owner { get; set; } = "Max";
    public string? Notes { get; set; }
    public int FitScore { get; set; }
    public int AcquisitionScore { get; set; }
    public int AudienceFitScore { get; set; }
    public int MarketRelevanceScore { get; set; }
    public int CommunityFitScore { get; set; }
    public int ContactQualityScore { get; set; }
    public int HistoricalCategoryScore { get; set; }
    public string? ScoreExplanation { get; set; }
    public string? DiscoverySource { get; set; }
    public string? DiscoverySourceUrl { get; set; }
    public DateTime? FirstDiscoveredAt { get; set; }
    public DateTime? LastEvaluatedAt { get; set; }
    public int DiscoveryCount { get; set; }
    /// <summary>verified_public | no_verified_public_email | pending</summary>
    public string? EmailVerificationStatus { get; set; }
    public int ResearchAttempts { get; set; }
    public DateTime? LastResearchAt { get; set; }
    public DateTime? NextResearchAt { get; set; }
    public string? ContactSourceUrl { get; set; }
    /// <summary>website_mailto | website_page | owner_supplied</summary>
    public string? ContactSourceType { get; set; }
    /// <summary>CONTACT_NEEDED|RESEARCHING|CONTACT_FOUND|NO_PUBLIC_CONTACT|RETRY_LATER|MANUAL_REVIEW</summary>
    public string? ContactabilityState { get; set; }
    /// <summary>0–100 contactability, separate from AcquisitionScore.</summary>
    public int ContactabilityScore { get; set; }
    /// <summary>GYM|STUDIO|SPORTS_CLUB|RUN_CLUB|REC_LEAGUE|COACH|TRAINER|CREATOR|COMMUNITY|EVENT_ORGANIZER|OTHER</summary>
    public string? ProspectKind { get; set; }
    public int ReferralSignups { get; set; }
    public int ActivatedUsers { get; set; }
    public int PaidCustomers { get; set; }
    public long AttributedRevenueCents { get; set; }
    /// <summary>DISCOVERED|CONTACT_NEEDED|CONTACTABLE|QUALIFIED|DRAFT|AWAITING_APPROVAL|APPROVED|QUEUED|SENT|DELIVERED|OPENED|CLICKED|REPLIED|INTERESTED|CONVERTED|NOT_QUALIFIED|REJECTED|OPTED_OUT|BOUNCED</summary>
    public string? AcquisitionStatus { get; set; }
    /// <summary>NOT_CUSTOMER|REGISTERED|ACTIVATED|PAYING_CUSTOMER</summary>
    public string? CustomerStatus { get; set; }
    /// <summary>NONE|INVITE_CREATED|SHARING|ACTIVE_SOURCE</summary>
    public string? DistributionStatus { get; set; }
    /// <summary>NONE|INTERESTED|PARTNER — partnership only; not customer conversion.</summary>
    public string? PartnershipStatus { get; set; }
    public string? WhySelected { get; set; }
    /// <summary>Org's own purchases (direct customer path).</summary>
    public long DirectRevenueCents { get; set; }
    public DateTime? SignupAt { get; set; }
    public DateTime? ActivatedAt { get; set; }
    public DateTime? FirstPurchaseAt { get; set; }
    /// <summary>Optional JSON array of timeline events.</summary>
    public string? TimelineJson { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? LastContactedAt { get; set; }
}

[DynamoDBTable("gettrainmate-partner-campaigns")]
public class PartnerCampaign
{
    [DynamoDBHashKey]
    public string CampaignId { get; set; } = Guid.NewGuid().ToString();
    public string Name { get; set; } = "";
    /// <summary>draft | active | paused | completed | candidate (alias for draft)</summary>
    public string Status { get; set; } = "candidate";
    public string Country { get; set; } = "";
    public string Market { get; set; } = "";
    public string DisplayName { get; set; } = "";
    public string PrimaryMode { get; set; } = "TRAIN";
    public string Timezone { get; set; } = "";
    public List<string> Languages { get; set; } = new() { "en" };
    public List<string> Categories { get; set; } = new();
    public int AllocationPercent { get; set; }
    public int DailyDiscoveryLimit { get; set; } = 10;
    public int DailyOutreachLimit { get; set; } = 10;
    public int MinAcquisitionScore { get; set; } = 40;
    public List<int> FollowUpDays { get; set; } = new() { 4, 9 };
    public int MaxFollowUps { get; set; } = 2;
    public string? ReferralDestination { get; set; }
    public string? UtmSource { get; set; }
    public string? UtmMedium { get; set; }
    public string? UtmCampaign { get; set; }
    /// <summary>Primary outreach language.</summary>
    public string? Language { get; set; }
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
    /// <summary>Parent initial approval id for automated follow-ups.</summary>
    public string? ParentApprovalId { get; set; }
    public bool AllowAutomatedFollowUp { get; set; }
    public string ProspectId { get; set; } = "";
    public string CampaignId { get; set; } = "";
    public string Recipient { get; set; } = "";
    public string OrganizationName { get; set; } = "";
    public string Subject { get; set; } = "";
    public string BodyText { get; set; } = "";
    public string BodyHtml { get; set; } = "";
    public string PartnerUrl { get; set; } = "";
    public string Fingerprint { get; set; } = "";
    /// <summary>Copy template version used to generate BodyText/BodyHtml.</summary>
    public string TemplateVersion { get; set; } = "";
    public string Status { get; set; } = "queued";
    public int MessageVersion { get; set; } = 1;
    /// <summary>0 = initial outreach; &gt;0 = follow-up N.</summary>
    public int FollowUpNumber { get; set; }
    public DateTime? ScheduledAt { get; set; }
    public string? ParentQueueId { get; set; }
    public string? ApprovedBy { get; set; }
    public DateTime? ApprovedAt { get; set; }
    public DateTime? RejectedAt { get; set; }
    public string? RejectedBy { get; set; }
    public string? RejectReason { get; set; }
    public string? IdempotencyKey { get; set; }
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
    /// <summary>off | test | live — deprecated for send gates; kept for UI backward compat.</summary>
    public string OutreachMode { get; set; } = "live";
    public bool PauseAllOutreach { get; set; }
    /// <summary>When true, sends only to addresses in TestRecipients.</summary>
    public bool TestRecipientsOnly { get; set; }
    public List<string> TestRecipients { get; set; } = new();
    public int ProspectsPerRun { get; set; } = 8;
    public int ResearchAttemptsPerRun { get; set; } = 15;
    /// <summary>Max contact-research attempts per growth/internal run.</summary>
    public int ResearchContactsPerRun { get; set; } = 10;
    public int DraftsPerRun { get; set; } = 5;
}

[DynamoDBTable("gettrainmate-partner-inbound-dedupe")]
public class PartnerInboundDedupe
{
    [DynamoDBHashKey]
    public string DedupeKey { get; set; } = "";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

[DynamoDBTable("gettrainmate-partner-discovery-jobs")]
public class PartnerDiscoveryJob
{
    [DynamoDBHashKey]
    public string JobId { get; set; } = Guid.NewGuid().ToString();
    /// <summary>starting|discovering|researching|scoring|preparing_drafts|complete|partial|failed</summary>
    public string Status { get; set; } = "starting";
    public string Stage { get; set; } = "starting";
    public int ProgressPct { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? CompletedAt { get; set; }
    public string? Error { get; set; }
    public string? RequestJson { get; set; }
    public string? ReportJson { get; set; }
    public int ProspectsFound { get; set; }
    public int DraftsCreated { get; set; }
    public int ContactsFound { get; set; }
    public string? Actor { get; set; }
    public string? CheckpointJson { get; set; }
}
