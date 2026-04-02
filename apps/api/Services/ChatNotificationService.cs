using System.Net;
using System.Text;
using Amazon.DynamoDBv2;
using Amazon.DynamoDBv2.DocumentModel;
using GetTrainMate.Api.Models;

namespace GetTrainMate.Api.Services;

public class ChatNotificationService : IChatNotificationService
{
    private readonly IAmazonDynamoDB _dynamoDb;
    private readonly IProfileService _profileService;
    private readonly IEmailService _emailService;
    private readonly IUserActivityService _userActivityService;
    private readonly IConfiguration _configuration;
    private readonly ILogger<ChatNotificationService> _logger;
    private readonly string _stateTableName;
    private readonly TimeSpan _onlineThreshold = TimeSpan.FromMinutes(5);
    private readonly TimeSpan _focusedThreadThreshold = TimeSpan.FromMinutes(15);

    public ChatNotificationService(
        IAmazonDynamoDB dynamoDb,
        IProfileService profileService,
        IEmailService emailService,
        IUserActivityService userActivityService,
        IConfiguration configuration,
        ILogger<ChatNotificationService> logger)
    {
        _dynamoDb = dynamoDb;
        _profileService = profileService;
        _emailService = emailService;
        _userActivityService = userActivityService;
        _configuration = configuration;
        _logger = logger;
        var prefix = configuration["DYNAMODB_TABLE_PREFIX"] ?? "gettrainmate-";
        _stateTableName = configuration["DYNAMODB_TABLE_CHAT_NOTIFICATION_STATE"]
            ?? $"{prefix}chat-notification-state";
    }

    public async Task NotifyIncomingMessageAsync(
        string threadId,
        string senderName,
        string messagePreview,
        string recipientUserId,
        ChatNotificationHints hints,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrEmpty(recipientUserId)) return;

        try
        {
            var profile = await _profileService.GetProfileAsync(recipientUserId);
            if (profile == null || string.IsNullOrWhiteSpace(profile.Email)) return;
            if (!profile.ChatNotificationsEnabled) return;

            var frequency = NormalizeFrequency(profile.ChatNotificationFrequency);

            var activity = await _userActivityService.GetActivityAsync(recipientUserId, cancellationToken);
            if (activity != null)
            {
                var viewingThisThread = string.Equals(activity.ActiveChatThreadId, threadId, StringComparison.Ordinal)
                    && activity.LastSeenUtc.HasValue
                    && DateTime.UtcNow - activity.LastSeenUtc.Value < _focusedThreadThreshold;
                if (viewingThisThread)
                    return;

                if (activity.LastSeenUtc.HasValue && DateTime.UtcNow - activity.LastSeenUtc.Value < _onlineThreshold)
                    return;
            }

            var priority = ClassifyPriority(hints);
            var cooldownMinutes = ResolveCooldownMinutes(frequency, priority);

            var stateKey = BuildStateKey(recipientUserId, threadId);
            var state = await LoadStateAsync(stateKey, cancellationToken);
            var pending = state.PendingCount + 1;
            var previewRaw = ChatNotificationPreviewSanitizer.Sanitize(messagePreview, _configuration);

            if (!ShouldSendNow(state.LastEmailSentUtc, cooldownMinutes))
            {
                await SaveStateAsync(stateKey, pending, state.LastEmailSentUtc, senderName, previewRaw, cancellationToken);
                return;
            }

            var baseUrl = GetFrontendBaseUrl().TrimEnd('/');
            var chatUrl = $"{baseUrl}/app/chat?thread={Uri.EscapeDataString(threadId)}";

            var count = pending;
            var subject = BuildSubject(count, senderName);
            var (text, html) = BuildEmailBodies(count, senderName, previewRaw, chatUrl, priority);

            await _emailService.SendEmailAsync(profile.Email, subject, text, html);

            await SaveStateAsync(stateKey, 0, DateTime.UtcNow, senderName, previewRaw, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Chat notification failed for recipient {RecipientId} thread {ThreadId}", recipientUserId, threadId);
        }
    }

    private static string NormalizeFrequency(string? raw)
    {
        var f = (raw ?? "smart").Trim().ToLowerInvariant();
        return f switch
        {
            "realtime" or "real-time" => "realtime",
            "daily" or "digest" => "daily",
            _ => "smart",
        };
    }

    private static NotificationPriority ClassifyPriority(ChatNotificationHints h)
    {
        if (h.IsBurstSpam) return NotificationPriority.Low;
        if (h.IsFirstMessageFromSender || h.IsReplyAfterInactivity) return NotificationPriority.High;
        return NotificationPriority.Medium;
    }

    private static int ResolveCooldownMinutes(string frequency, NotificationPriority priority)
    {
        if (frequency == "daily") return 24 * 60;
        if (frequency == "realtime") return 15;

        return priority switch
        {
            NotificationPriority.High => 15,
            NotificationPriority.Medium => 20,
            _ => 30,
        };
    }

    private static bool ShouldSendNow(DateTime? lastEmailSentUtc, int cooldownMinutes)
    {
        if (lastEmailSentUtc == null) return true;
        return DateTime.UtcNow - lastEmailSentUtc.Value >= TimeSpan.FromMinutes(cooldownMinutes);
    }

    private async Task<NotificationState> LoadStateAsync(string stateKey, CancellationToken cancellationToken)
    {
        try
        {
            var table = Table.LoadTable(_dynamoDb, _stateTableName);
            var doc = await table.GetItemAsync(stateKey, cancellationToken);
            if (doc == null) return new NotificationState();
            var pending = 0;
            if (doc.ContainsKey("pendingCount") && doc["pendingCount"].AsInt() is int pc) pending = pc;
            DateTime? lastEmail = null;
            if (doc.ContainsKey("lastEmailSentUtc"))
            {
                var s = doc["lastEmailSentUtc"].AsString();
                if (!string.IsNullOrEmpty(s) && DateTime.TryParse(s, out var le)) lastEmail = le.ToUniversalTime();
            }
            return new NotificationState { PendingCount = pending, LastEmailSentUtc = lastEmail };
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Load notification state failed for {Key}", stateKey);
            return new NotificationState();
        }
    }

    private async Task SaveStateAsync(
        string stateKey,
        int pendingCount,
        DateTime? lastEmailSentUtc,
        string senderName,
        string preview,
        CancellationToken cancellationToken)
    {
        try
        {
            var table = Table.LoadTable(_dynamoDb, _stateTableName);
            var doc = new Document
            {
                ["stateKey"] = stateKey,
                ["pendingCount"] = pendingCount,
                ["lastSenderName"] = senderName,
                ["lastPreview"] = preview,
            };
            if (lastEmailSentUtc.HasValue)
                doc["lastEmailSentUtc"] = lastEmailSentUtc.Value.ToString("O");
            await table.PutItemAsync(doc, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Save notification state failed for {Key}", stateKey);
        }
    }

    private static string BuildStateKey(string recipientUserId, string threadId) => $"{recipientUserId}#{threadId}";

    private string GetFrontendBaseUrl()
    {
        return Environment.GetEnvironmentVariable("FRONTEND_URL")
            ?? _configuration["FRONTEND_URL"]
            ?? _configuration["Frontend:BaseUrl"]
            ?? "https://localhost:5173";
    }

    private static string BuildSubject(int count, string senderName)
    {
        var name = string.IsNullOrWhiteSpace(senderName) ? "Someone" : senderName.Trim();
        if (count <= 1)
            return $"New message from {name}";
        return $"You have {count} new messages from {name}";
    }

    private static (string Text, string Html) BuildEmailBodies(
        int count,
        string senderName,
        string preview,
        string chatUrl,
        NotificationPriority priority)
    {
        var name = string.IsNullOrWhiteSpace(senderName) ? "Someone" : senderName.Trim();
        var headline = count <= 1
            ? $"{name} sent you a message on GetTrainMate."
            : $"You have {count} new messages from {name} on GetTrainMate.";
        var tagline = priority == NotificationPriority.Low
            ? "We'll group messages so you aren't overwhelmed."
            : "Open the app to reply when you're ready.";

        var text = new StringBuilder();
        text.AppendLine(headline);
        text.AppendLine();
        text.AppendLine("Preview:");
        text.AppendLine(preview);
        text.AppendLine();
        text.AppendLine(tagline);
        text.AppendLine();
        text.AppendLine("Reply now:");
        text.AppendLine(chatUrl);

        var safePreview = WebUtility.HtmlEncode(preview);
        var html = $@"<p>{WebUtility.HtmlEncode(headline)}</p>
<p style=""color:#555;font-size:14px""><strong>Preview:</strong> {safePreview}</p>
<p style=""color:#666;font-size:13px"">{WebUtility.HtmlEncode(tagline)}</p>
<p><a href=""{WebUtility.HtmlEncode(chatUrl)}"" style=""display:inline-block;padding:12px 20px;background:#6366f1;color:#fff;text-decoration:none;border-radius:8px;font-weight:600"">Reply now</a></p>";

        return (text.ToString(), html);
    }

    private sealed class NotificationState
    {
        public int PendingCount { get; set; }
        public DateTime? LastEmailSentUtc { get; set; }
    }

    private enum NotificationPriority
    {
        Low,
        Medium,
        High,
    }
}
