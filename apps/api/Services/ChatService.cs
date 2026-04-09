using Amazon.DynamoDBv2;
using Amazon.DynamoDBv2.DocumentModel;
using Amazon.DynamoDBv2.Model;
using GetTrainMate.Api.Models;

namespace GetTrainMate.Api.Services;

public class ChatService : IChatService
{
    private readonly IAmazonDynamoDB _dynamoDb;
    private readonly IProfileService _profileService;
    private readonly ICreditsService _creditsService;
    private readonly IMatchService _matchService;
    private readonly IChatNotificationService _chatNotificationService;
    private readonly string _messagesTable;
    private readonly string _threadsTable;
    private readonly ILogger<ChatService> _logger;

    public ChatService(
        IAmazonDynamoDB dynamoDb,
        IProfileService profileService,
        ICreditsService creditsService,
        IMatchService matchService,
        IChatNotificationService chatNotificationService,
        IConfiguration configuration,
        ILogger<ChatService> logger)
    {
        _dynamoDb = dynamoDb;
        _profileService = profileService;
        _creditsService = creditsService;
        _matchService = matchService;
        _chatNotificationService = chatNotificationService;
        var prefix = configuration["DYNAMODB_TABLE_PREFIX"] ?? "gettrainmate-";
        _messagesTable = configuration["DYNAMODB_TABLE_MESSAGES"] ?? $"{prefix}messages";
        _threadsTable = configuration["DYNAMODB_TABLE_CHAT_THREADS"] ?? $"{prefix}chat-threads";
        _logger = logger;
    }

    public async Task<ChatThread> CreateThreadAsync(string userId1, string userId2)
    {
        try
        {
            var existingThread = await FindThreadAsync(userId1, userId2);
            if (existingThread != null)
                return existingThread;

            var thread = new ChatThread
            {
                ParticipantIds = new List<string> { userId1, userId2 },
                CreatedAt = DateTime.UtcNow
            };

            var table = Table.LoadTable(_dynamoDb, _threadsTable);
            var doc = ThreadToDocument(thread);
            await table.PutItemAsync(doc);

            return thread;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating chat thread");
            throw;
        }
    }

    public async Task<ChatThread?> GetThreadAsync(string threadId)
    {
        try
        {
            var table = Table.LoadTable(_dynamoDb, _threadsTable);
            var doc = await table.GetItemAsync(threadId);
            return doc != null ? DocumentToThread(doc) : null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting thread {ThreadId}", threadId);
            return null;
        }
    }

    public Task<ChatThread?> GetThreadByMatchIdAsync(string matchId)
    {
        return GetThreadAsync(matchId);
    }

    public async Task<ChatThread> GetOrCreateThreadForMatchAsync(string matchId, string userId1, string userId2)
    {
        var existing = await GetThreadByMatchIdAsync(matchId);
        if (existing != null)
            return existing;

        var thread = new ChatThread
        {
            ThreadId = matchId,
            MatchId = matchId,
            ParticipantIds = new List<string> { userId1, userId2 },
            UnlockedByUserA = false,
            UnlockedByUserB = false,
            CreatedAt = DateTime.UtcNow
        };

        var table = Table.LoadTable(_dynamoDb, _threadsTable);
        var doc = ThreadToDocument(thread);
        await table.PutItemAsync(doc);
        _logger.LogInformation("Created chat thread for match {MatchId}", matchId);
        return thread;
    }

    public async Task<bool> UnlockThreadForUserAsync(string matchId, string userId)
    {
        var thread = await GetThreadByMatchIdAsync(matchId);
        if (thread == null)
        {
            var seedMatch = await _matchService.GetMatchByIdAsync(matchId);
            if (seedMatch == null)
            {
                _logger.LogWarning("Match {MatchId} not found for unlock", matchId);
                return false;
            }
            thread = await GetOrCreateThreadForMatchAsync(matchId, seedMatch.UserId1, seedMatch.UserId2);
        }

        var userId1 = thread.ParticipantIds.ElementAtOrDefault(0);
        var userId2 = thread.ParticipantIds.ElementAtOrDefault(1);
        if (string.IsNullOrEmpty(userId1) || string.IsNullOrEmpty(userId2))
        {
            _logger.LogWarning("Thread {MatchId} has invalid participants", matchId);
            return false;
        }

        var isUserA = userId == userId1;
        var isUserB = userId == userId2;
        if (!isUserA && !isUserB)
        {
            _logger.LogWarning("User {UserId} is not a participant of thread {MatchId}", userId, matchId);
            return false;
        }

        await GrandfatherLegacyMutualChatAsync(thread);
        thread = (await GetThreadByMatchIdAsync(matchId)) ?? thread;

        if (isUserA && thread.UnlockedByUserA || isUserB && thread.UnlockedByUserB)
        {
            _logger.LogInformation("User {UserId} already unlocked thread {MatchId}", userId, matchId);
            return true;
        }

        await _creditsService.SpendCreditsAsync(
            userId,
            CreditRules.ChatUnlock,
            CreditLedgerReason.ChatUnlock,
            $"unlock:{userId}:{matchId}",
            idempotent: true);

        if (isUserA)
            thread.UnlockedByUserA = true;
        else
            thread.UnlockedByUserB = true;

        var table = Table.LoadTable(_dynamoDb, _threadsTable);
        var doc = ThreadToDocument(thread);
        await table.PutItemAsync(doc);
        _logger.LogInformation("User {UserId} unlocked chat for match {MatchId}", userId, matchId);
        return true;
    }

    public async Task<ThreadByMatchResponse?> GetThreadByMatchIdForUserAsync(string matchId, string userId)
    {
        var thread = await GetThreadByMatchIdAsync(matchId);
        if (thread == null) return null;
        await GrandfatherLegacyMutualChatAsync(thread);
        thread = (await GetThreadByMatchIdAsync(matchId)) ?? thread;
        var userId1 = thread.ParticipantIds.ElementAtOrDefault(0);
        var userId2 = thread.ParticipantIds.ElementAtOrDefault(1);
        var isUserA = userId == userId1;
        var isUserB = userId == userId2;
        if (!isUserA && !isUserB) return null;
        var unlockedByCurrentUser = isUserA ? thread.UnlockedByUserA : thread.UnlockedByUserB;
        return new ThreadByMatchResponse
        {
            ThreadId = thread.ThreadId,
            UnlockedByCurrentUser = unlockedByCurrentUser
        };
    }

    public async Task<List<ThreadPreviewResponse>> GetUserThreadsAsync(string userId)
    {
        try
        {
            var threadPreviews = new List<ThreadPreviewResponse>();
            Dictionary<string, AttributeValue>? exclusiveStartKey = null;

            do
            {
                var scanResponse = await _dynamoDb.ScanAsync(new ScanRequest
                {
                    TableName = _threadsTable,
                    FilterExpression = "contains(participantIds, :uid)",
                    ExpressionAttributeValues = new Dictionary<string, AttributeValue>
                    {
                        [":uid"] = new AttributeValue { S = userId }
                    },
                    ExclusiveStartKey = exclusiveStartKey
                });

                foreach (var item in scanResponse.Items)
                {
                    var doc = Document.FromAttributeMap(item);
                    var thread = DocumentToThread(doc);

                    var otherUserId = thread.ParticipantIds.FirstOrDefault(id => id != userId);
                    if (string.IsNullOrEmpty(otherUserId))
                        continue;

                    var otherProfile = await _profileService.GetProfileAsync(otherUserId);
                    if (otherProfile == null)
                        continue;

                    var messages = await GetMessagesAsync(thread.ThreadId, 1000);
                    var unreadCount = messages.Count(m => m.SenderId != userId && !m.IsRead);

                    threadPreviews.Add(new ThreadPreviewResponse
                    {
                        ThreadId = thread.ThreadId,
                        OtherUserId = otherUserId,
                        OtherUserName = otherProfile.Name,
                        LastMessage = thread.LastMessage,
                        LastMessageAt = thread.LastMessageAt,
                        UnreadCount = unreadCount
                    });
                }

                exclusiveStartKey = scanResponse.LastEvaluatedKey is { Count: > 0 }
                    ? scanResponse.LastEvaluatedKey
                    : null;
            } while (exclusiveStartKey != null);

            return threadPreviews
                .GroupBy(t => t.OtherUserId)
                .Select(g => g.OrderByDescending(x => x.LastMessageAt).First())
                .OrderByDescending(x => x.LastMessageAt)
                .ToList();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting threads for user {UserId}", userId);
            throw;
        }
    }

    public async Task<List<ChatMessage>> GetMessagesAsync(string threadId, int limit = 50)
    {
        try
        {
            var table = Table.LoadTable(_dynamoDb, _messagesTable);
            var scanFilter = new ScanFilter();
            scanFilter.AddCondition("threadId", ScanOperator.Equal, threadId);
            
            var search = table.Scan(scanFilter);
            var messages = new List<ChatMessage>();

            do
            {
                var batch = await search.GetNextSetAsync();
                foreach (var doc in batch)
                {
                    messages.Add(DocumentToMessage(doc));
                }
            } while (!search.IsDone);

            // Sort by timestamp and take limit
            return messages
                .OrderBy(m => m.CreatedAt)
                .TakeLast(limit)
                .ToList();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting messages for thread {ThreadId}", threadId);
            throw;
        }
    }

    public async Task<ChatMessage> SendMessageAsync(string threadId, string senderId, string senderName, string content)
    {
        try
        {
            await EnsureUserMayPostInThreadAsync(threadId, senderId);

            var message = new ChatMessage
            {
                MessageId = Guid.NewGuid().ToString(),
                ThreadId = threadId,
                SenderId = senderId,
                SenderName = senderName,
                Content = content,
                CreatedAt = DateTime.UtcNow
            };

            // Save message
            var messagesTable = Table.LoadTable(_dynamoDb, _messagesTable);
            var messageDoc = MessageToDocument(message);
            await messagesTable.PutItemAsync(messageDoc);

            // Update thread last message
            var thread = await GetThreadAsync(threadId);
            if (thread != null)
            {
                thread.LastMessage = content;
                thread.LastMessageAt = DateTime.UtcNow;
                
                var threadsTable = Table.LoadTable(_dynamoDb, _threadsTable);
                var threadDoc = ThreadToDocument(thread);
                await threadsTable.PutItemAsync(threadDoc);
            }

            if (thread != null)
            {
                var recipientId = thread.ParticipantIds.FirstOrDefault(p => p != senderId);
                if (!string.IsNullOrEmpty(recipientId))
                {
                    try
                    {
                        var allMessages = await GetMessagesAsync(threadId, 500);
                        var hints = BuildChatNotificationHints(allMessages, senderId, message);
                        await _chatNotificationService.NotifyIncomingMessageAsync(
                            threadId,
                            senderName,
                            content,
                            recipientId,
                            hints);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Chat notification hook failed for thread {ThreadId}", threadId);
                    }
                }
            }

            return message;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending message");
            throw;
        }
    }

    /// <inheritdoc />
    public async Task<(List<AdminChatThreadListItem> Items, int TotalCount)> ListThreadsForAdminAsync(int page, int pageSize, string? search = null)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 200);
        try
        {
            var table = Table.LoadTable(_dynamoDb, _threadsTable);
            var scanOp = table.Scan(new ScanFilter());
            var threads = new List<ChatThread>();
            do
            {
                var batch = await scanOp.GetNextSetAsync();
                foreach (var doc in batch)
                {
                    try
                    {
                        threads.Add(DocumentToThread(doc));
                    }
                    catch (Exception ex)
                    {
                        _logger.LogDebug(ex, "Admin thread list: skip malformed row");
                    }
                }
            } while (!scanOp.IsDone);

            var ordered = threads
                .OrderByDescending(t => t.LastMessageAt)
                .ThenBy(t => t.ThreadId)
                .ToList();

            if (!string.IsNullOrWhiteSpace(search))
            {
                var q = search.Trim();
                ordered = ordered
                    .Where(t =>
                        t.ThreadId.Contains(q, StringComparison.OrdinalIgnoreCase)
                        || (!string.IsNullOrEmpty(t.MatchId) &&
                            t.MatchId.Contains(q, StringComparison.OrdinalIgnoreCase))
                        || t.ParticipantIds.Any(p => p.Contains(q, StringComparison.OrdinalIgnoreCase))
                        || (t.LastMessage?.Contains(q, StringComparison.OrdinalIgnoreCase) ?? false))
                    .ToList();
            }

            var total = ordered.Count;
            var slice = ordered
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToList();

            var nameIds = slice
                .SelectMany(t => t.ParticipantIds)
                .Where(id => !string.IsNullOrWhiteSpace(id))
                .Distinct(StringComparer.Ordinal)
                .ToList();
            var nameMap = await ResolveDisplayNamesForAdminAsync(nameIds);

            var items = new List<AdminChatThreadListItem>();
            foreach (var t in slice)
            {
                var u1 = t.ParticipantIds.ElementAtOrDefault(0) ?? string.Empty;
                var u2 = t.ParticipantIds.ElementAtOrDefault(1) ?? string.Empty;
                nameMap.TryGetValue(u1, out var dn1);
                nameMap.TryGetValue(u2, out var dn2);
                items.Add(new AdminChatThreadListItem
                {
                    ThreadId = t.ThreadId,
                    MatchId = t.MatchId,
                    UserId1 = u1,
                    UserId2 = u2,
                    UserDisplayName1 = !string.IsNullOrEmpty(dn1) ? dn1 : FormatAdminUserFallback(u1),
                    UserDisplayName2 = !string.IsNullOrEmpty(dn2) ? dn2 : FormatAdminUserFallback(u2),
                    LastMessageAt = t.LastMessageAt,
                    LastMessagePreview = TruncateAdminPreview(t.LastMessage),
                    UnlockedByUserA = t.UnlockedByUserA,
                    UnlockedByUserB = t.UnlockedByUserB,
                    MessageCount = 0
                });
            }

            return (items, total);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error listing threads for admin");
            throw;
        }
    }

    public async Task<bool> MarkThreadAsReadAsync(string threadId, string userId)
    {
        try
        {
            var messages = await GetMessagesAsync(threadId, 1000);
            var messagesTable = Table.LoadTable(_dynamoDb, _messagesTable);

            foreach (var message in messages.Where(m => m.SenderId != userId && !m.IsRead))
            {
                message.IsRead = true;
                var doc = MessageToDocument(message);
                await messagesTable.UpdateItemAsync(doc);
            }

            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error marking thread as read");
            return false;
        }
    }

    private async Task<ChatThread?> FindThreadAsync(string userId1, string userId2)
    {
        try
        {
            var table = Table.LoadTable(_dynamoDb, _threadsTable);
            var scanFilter = new ScanFilter();
            
            var search = table.Scan(scanFilter);
            
            do
            {
                var batch = await search.GetNextSetAsync();
                foreach (var doc in batch)
                {
                    var thread = DocumentToThread(doc);
                    if ((thread.ParticipantIds.Contains(userId1) && thread.ParticipantIds.Contains(userId2)))
                    {
                        return thread;
                    }
                }
            } while (!search.IsDone);

            return null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error finding thread");
            return null;
        }
    }

    private Document ThreadToDocument(ChatThread thread)
    {
        var doc = new Document
        {
            ["threadId"] = thread.ThreadId,
            ["participantIds"] = new DynamoDBList(thread.ParticipantIds.Select(id => new Primitive(id))),
            ["lastMessage"] = thread.LastMessage,
            ["lastMessageAt"] = thread.LastMessageAt.ToString("O"),
            ["createdAt"] = thread.CreatedAt.ToString("O")
        };
        if (!string.IsNullOrEmpty(thread.MatchId))
            doc["matchId"] = thread.MatchId;
        doc["unlockedByUserA"] = thread.UnlockedByUserA;
        doc["unlockedByUserB"] = thread.UnlockedByUserB;
        return doc;
    }

    private ChatThread DocumentToThread(Document doc)
    {
        var lastMessage = string.Empty;
        if (doc.ContainsKey("lastMessage"))
        {
            try { lastMessage = doc["lastMessage"].AsString() ?? string.Empty; } catch { }
        }
        var lastMessageAt = DateTime.UtcNow;
        if (doc.ContainsKey("lastMessageAt"))
        {
            try
            {
                var s = doc["lastMessageAt"].AsString();
                if (!string.IsNullOrEmpty(s) && DateTime.TryParse(s, out var parsed))
                    lastMessageAt = parsed;
            }
            catch { }
        }
        var createdAt = DateTime.UtcNow;
        if (doc.ContainsKey("createdAt"))
        {
            try
            {
                var s = doc["createdAt"].AsString();
                if (!string.IsNullOrEmpty(s) && DateTime.TryParse(s, out var parsed))
                    createdAt = parsed;
            }
            catch { }
        }
        var participantIds = new List<string>();
        if (doc.ContainsKey("participantIds"))
        {
            try { participantIds = doc["participantIds"].AsListOfString(); } catch { }
        }
        var thread = new ChatThread
        {
            ThreadId = doc["threadId"],
            ParticipantIds = participantIds,
            LastMessage = lastMessage,
            LastMessageAt = lastMessageAt,
            CreatedAt = createdAt
        };
        if (doc.ContainsKey("matchId"))
            thread.MatchId = doc["matchId"];
        if (doc.ContainsKey("unlockedByUserA"))
            thread.UnlockedByUserA = doc["unlockedByUserA"].AsBoolean();
        if (doc.ContainsKey("unlockedByUserB"))
            thread.UnlockedByUserB = doc["unlockedByUserB"].AsBoolean();
        return thread;
    }

    /// <summary>
    /// Mutual matches may message without a per-user credit unlock; otherwise the sender must have unlocked this thread.
    /// </summary>
    /// <summary>
    /// Legacy: mutual matches could message without spending unlock credits. If the thread already has messages
    /// but unlock flags are false, mark both unlocked once so existing conversations keep working.
    /// </summary>
    private async Task GrandfatherLegacyMutualChatAsync(ChatThread thread)
    {
        try
        {
            if (thread.ParticipantIds == null || thread.ParticipantIds.Count < 2)
                return;
            var matchId = !string.IsNullOrEmpty(thread.MatchId) ? thread.MatchId : thread.ThreadId;
            var match = await _matchService.GetMatchByIdAsync(matchId);
            if (match == null || !match.IsMatched)
                return;
            if (thread.UnlockedByUserA && thread.UnlockedByUserB)
                return;
            var msgs = await GetMessagesAsync(thread.ThreadId, 1);
            if (msgs.Count == 0)
                return;
            thread.UnlockedByUserA = true;
            thread.UnlockedByUserB = true;
            var table = Table.LoadTable(_dynamoDb, _threadsTable);
            await table.PutItemAsync(ThreadToDocument(thread));
            _logger.LogInformation(
                "Grandfather mutual chat unlock for thread {ThreadId} (legacy messages present).",
                thread.ThreadId);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "GrandfatherLegacyMutualChatAsync failed for {ThreadId}", thread.ThreadId);
        }
    }

    private async Task EnsureUserMayPostInThreadAsync(string threadId, string userId)
    {
        var thread = await GetThreadAsync(threadId);
        if (thread == null)
            throw new InvalidOperationException("CHAT_LOCKED: Thread not found.");

        if (!thread.ParticipantIds.Contains(userId))
            throw new UnauthorizedAccessException();

        await GrandfatherLegacyMutualChatAsync(thread);
        thread = (await GetThreadAsync(threadId)) ?? thread;

        var userId1 = thread.ParticipantIds.ElementAtOrDefault(0);
        var userId2 = thread.ParticipantIds.ElementAtOrDefault(1);
        var isUserA = userId == userId1;
        var unlocked = isUserA ? thread.UnlockedByUserA : thread.UnlockedByUserB;
        if (!unlocked)
            throw new InvalidOperationException(
                "CHAT_LOCKED: Unlock chat to start messaging — 1 credit.");
    }

    private static ChatNotificationHints BuildChatNotificationHints(
        List<ChatMessage> all,
        string senderId,
        ChatMessage current)
    {
        var fromSender = all.Where(m => m.SenderId == senderId).OrderBy(m => m.CreatedAt).ToList();
        var isFirst = fromSender.Count == 1;
        var prevFromSender = fromSender
            .Where(m => m.MessageId != current.MessageId)
            .OrderByDescending(m => m.CreatedAt)
            .FirstOrDefault();
        var replyAfterInactivity = prevFromSender != null
            && (current.CreatedAt - prevFromSender.CreatedAt).TotalHours >= 1;
        var windowStart = current.CreatedAt.AddSeconds(-60);
        var burst = all.Count(m => m.SenderId == senderId && m.CreatedAt >= windowStart) >= 3;
        return new ChatNotificationHints
        {
            IsFirstMessageFromSender = isFirst,
            IsReplyAfterInactivity = replyAfterInactivity,
            IsBurstSpam = burst,
        };
    }

    private Document MessageToDocument(ChatMessage message)
    {
        var doc = new Document
        {
            ["messageId"] = message.MessageId,
            ["threadId"] = message.ThreadId,
            ["senderId"] = message.SenderId,
            ["senderName"] = message.SenderName,
            ["content"] = message.Content,
            ["isRead"] = message.IsRead,
            ["createdAt"] = message.CreatedAt.ToString("O")
        };

        return doc;
    }

    private ChatMessage DocumentToMessage(Document doc)
    {
        return new ChatMessage
        {
            MessageId = doc["messageId"],
            ThreadId = doc["threadId"],
            SenderId = doc["senderId"],
            SenderName = doc["senderName"],
            Content = doc["content"],
            IsRead = doc["isRead"].AsBoolean(),
            CreatedAt = DateTime.Parse(doc["createdAt"])
        };
    }

    private static string TruncateAdminPreview(string? text, int maxLen = 160)
    {
        if (string.IsNullOrWhiteSpace(text)) return string.Empty;
        var t = text.Trim().ReplaceLineEndings(" ");
        if (t.Length <= maxLen) return t;
        return string.Concat(t.AsSpan(0, maxLen - 1), "…");
    }

    private static string FormatAdminUserFallback(string userId)
    {
        if (string.IsNullOrWhiteSpace(userId)) return "—";
        return userId.Length > 14 ? string.Concat(userId.AsSpan(0, 8), "…") : userId;
    }

    private async Task<Dictionary<string, string>> ResolveDisplayNamesForAdminAsync(IEnumerable<string> userIds)
    {
        var distinct = userIds
            .Where(id => !string.IsNullOrWhiteSpace(id))
            .Select(id => id.Trim())
            .Distinct(StringComparer.Ordinal)
            .ToList();
        if (distinct.Count == 0)
            return new Dictionary<string, string>(StringComparer.Ordinal);

        var tasks = distinct.Select(async id =>
        {
            try
            {
                var p = await _profileService.GetProfileAsync(id);
                var label = !string.IsNullOrWhiteSpace(p?.Name) ? p!.Name.Trim() : null;
                return (id, label);
            }
            catch (Exception ex)
            {
                _logger.LogDebug(ex, "Admin chat list: could not load profile for {UserId}", id);
                return (id, (string?)null);
            }
        });
        var pairs = await Task.WhenAll(tasks);
        var map = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var (id, label) in pairs)
        {
            if (!string.IsNullOrEmpty(label))
                map[id] = label;
        }

        return map;
    }
}
