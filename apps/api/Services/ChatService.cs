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

        var match = await _matchService.GetMatchByIdAsync(thread.MatchId ?? matchId);
        if (match != null && match.IsMatched)
        {
            // Mutual match: chat is included — no credit unlock per side.
            thread.UnlockedByUserA = true;
            thread.UnlockedByUserB = true;
            var tMutual = Table.LoadTable(_dynamoDb, _threadsTable);
            await tMutual.PutItemAsync(ThreadToDocument(thread));
            _logger.LogInformation("Mutual match {MatchId}: chat unlocked for both users (no charge)", matchId);
            return true;
        }

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
        var userId1 = thread.ParticipantIds.ElementAtOrDefault(0);
        var userId2 = thread.ParticipantIds.ElementAtOrDefault(1);
        var isUserA = userId == userId1;
        var isUserB = userId == userId2;
        if (!isUserA && !isUserB) return null;
        var match = await _matchService.GetMatchByIdAsync(matchId);
        var mutual = match != null && match.IsMatched;
        var unlockedByCurrentUser = mutual || (isUserA ? thread.UnlockedByUserA : thread.UnlockedByUserB);
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
                        || t.ParticipantIds.Any(p => p.Contains(q, StringComparison.OrdinalIgnoreCase)))
                    .ToList();
            }

            var total = ordered.Count;
            var slice = ordered
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToList();

            var items = slice.Select(t => new AdminChatThreadListItem
            {
                ThreadId = t.ThreadId,
                UserId1 = t.ParticipantIds.ElementAtOrDefault(0) ?? string.Empty,
                UserId2 = t.ParticipantIds.ElementAtOrDefault(1) ?? string.Empty,
                LastMessageAt = t.LastMessageAt,
                MessageCount = 0
            }).ToList();

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
    private async Task EnsureUserMayPostInThreadAsync(string threadId, string userId)
    {
        var thread = await GetThreadAsync(threadId);
        if (thread == null)
            throw new InvalidOperationException("CHAT_LOCKED: Thread not found.");

        if (!thread.ParticipantIds.Contains(userId))
            throw new UnauthorizedAccessException();

        var matchId = !string.IsNullOrEmpty(thread.MatchId) ? thread.MatchId : threadId;
        var match = await _matchService.GetMatchByIdAsync(matchId);
        if (match != null && match.IsMatched)
            return;

        var userId1 = thread.ParticipantIds.ElementAtOrDefault(0);
        var userId2 = thread.ParticipantIds.ElementAtOrDefault(1);
        var isUserA = userId == userId1;
        var unlocked = isUserA ? thread.UnlockedByUserA : thread.UnlockedByUserB;
        if (!unlocked)
            throw new InvalidOperationException(
                "CHAT_LOCKED: Unlock this chat from your match (or wait until it's a mutual match).");
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
}
