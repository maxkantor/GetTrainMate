using Amazon.DynamoDBv2;
using Amazon.DynamoDBv2.DocumentModel;
using GetTrainMate.Api.Models;

namespace GetTrainMate.Api.Services;

public class ChatService : IChatService
{
    private readonly IAmazonDynamoDB _dynamoDb;
    private readonly IProfileService _profileService;
    private readonly string _messagesTable;
    private readonly string _threadsTable;
    private readonly ILogger<ChatService> _logger;

    public ChatService(
        IAmazonDynamoDB dynamoDb,
        IProfileService profileService,
        IConfiguration configuration,
        ILogger<ChatService> logger)
    {
        _dynamoDb = dynamoDb;
        _profileService = profileService;
        _messagesTable = configuration["DYNAMODB_TABLE_MESSAGES"] ?? "gettrainmate-messages-dev";
        _threadsTable = configuration["DYNAMODB_TABLE_CHAT_THREADS"] ?? "gettrainmate-chat-threads-dev";
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

    public async Task<List<ThreadPreviewResponse>> GetUserThreadsAsync(string userId)
    {
        try
        {
            var threadsTable = Table.LoadTable(_dynamoDb, _threadsTable);
            var scanFilter = new ScanFilter();
            
            var search = threadsTable.Scan(scanFilter);
            var threadPreviews = new List<ThreadPreviewResponse>();

            do
            {
                var batch = await search.GetNextSetAsync();
                foreach (var doc in batch)
                {
                    var thread = DocumentToThread(doc);
                    
                    // Check if user is in thread
                    if (!thread.ParticipantIds.Contains(userId))
                        continue;

                    var otherUserId = thread.ParticipantIds.FirstOrDefault(id => id != userId);
                    if (string.IsNullOrEmpty(otherUserId))
                        continue;

                    var otherProfile = await _profileService.GetProfileAsync(otherUserId);
                    if (otherProfile == null)
                        continue;

                    // Count unread messages
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
            } while (!search.IsDone);

            // Sort by most recent first
            return threadPreviews
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
            var message = new ChatMessage
            {
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

            return message;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending message");
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

        return doc;
    }

    private ChatThread DocumentToThread(Document doc)
    {
        return new ChatThread
        {
            ThreadId = doc["threadId"],
            ParticipantIds = doc["participantIds"].AsListOfString(),
            LastMessage = doc["lastMessage"],
            LastMessageAt = DateTime.Parse(doc["lastMessageAt"]),
            CreatedAt = DateTime.Parse(doc["createdAt"])
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
