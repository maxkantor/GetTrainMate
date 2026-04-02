using GetTrainMate.Api.Models;

namespace GetTrainMate.Api.Services;

public interface IChatNotificationService
{
    /// <summary>Email + state update for the recipient of a new message (non-blocking errors).</summary>
    Task NotifyIncomingMessageAsync(
        string threadId,
        string senderName,
        string messagePreview,
        string recipientUserId,
        ChatNotificationHints hints,
        CancellationToken cancellationToken = default);
}
