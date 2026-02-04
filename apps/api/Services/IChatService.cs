using GetTrainMate.Api.Models;

namespace GetTrainMate.Api.Services;

public interface IChatService
{
    Task<ChatThread> CreateThreadAsync(string userId1, string userId2);
    Task<ChatThread?> GetThreadAsync(string threadId);
    Task<ChatThread?> GetThreadByMatchIdAsync(string matchId);
    Task<ChatThread> GetOrCreateThreadForMatchAsync(string matchId, string userId1, string userId2);
    Task<bool> UnlockThreadForUserAsync(string matchId, string userId);
    Task<ThreadByMatchResponse?> GetThreadByMatchIdForUserAsync(string matchId, string userId);
    Task<List<ThreadPreviewResponse>> GetUserThreadsAsync(string userId);
    Task<List<ChatMessage>> GetMessagesAsync(string threadId, int limit = 50);
    Task<ChatMessage> SendMessageAsync(string threadId, string senderId, string senderName, string content);
    Task<bool> MarkThreadAsReadAsync(string threadId, string userId);
}
