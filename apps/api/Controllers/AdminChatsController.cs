using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using GetTrainMate.Api.Models;
using GetTrainMate.Api.Services;
using Amazon.DynamoDBv2.DataModel;
using System.Security.Claims;

namespace GetTrainMate.Api.Controllers;

[ApiController]
[Route("api/admin/chats")]
[Authorize]
public class AdminChatsController : ControllerBase
{
    private readonly IDynamoDBContext _context;
    private readonly IChatService _chatService;
    private readonly IProfileService _profileService;
    private readonly IAuditLogService _auditLogService;
    private readonly ILogger<AdminChatsController> _logger;

    public AdminChatsController(
        IDynamoDBContext context,
        IChatService chatService,
        IProfileService profileService,
        IAuditLogService auditLogService,
        ILogger<AdminChatsController> logger)
    {
        _context = context;
        _chatService = chatService;
        _profileService = profileService;
        _auditLogService = auditLogService;
        _logger = logger;
    }

    private AdminIdentity GetAdminIdentity()
    {
        if (HttpContext.Items["AdminIdentity"] is AdminIdentity identity)
        {
            return identity;
        }

        var sub = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? User.FindFirst("sub")?.Value
            ?? throw new UnauthorizedAccessException("Admin identity not found");

        return new AdminIdentity
        {
            Sub = sub,
            CognitoUsername = User.FindFirst("cognito:username")?.Value,
            Email = User.FindFirst(ClaimTypes.Email)?.Value ?? User.FindFirst("email")?.Value
        };
    }

    /// <summary>
    /// GET /api/admin/chats?search=&page=&pageSize=
    /// List chat threads with pagination (from gettrainmate-chat-threads).
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<PagedResponse<AdminChatThreadListItem>>> GetChats(
        [FromQuery] string? search = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        try
        {
            var (items, total) = await _chatService.ListThreadsForAdminAsync(page, pageSize, search);

            return Ok(new PagedResponse<AdminChatThreadListItem>
            {
                Items = items,
                Page = page,
                PageSize = pageSize,
                TotalCount = total,
                TotalPages = Math.Max(1, (int)Math.Ceiling(total / (double)pageSize))
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error listing chats");
            return StatusCode(500, new { error = "Failed to list chats" });
        }
    }

    /// <summary>
    /// GET /api/admin/chats/{chatId}
    /// Thread metadata, participant display names, and ordered messages for moderation.
    /// </summary>
    [HttpGet("{chatId}")]
    public async Task<ActionResult<AdminChatThreadDetail>> GetChat(string chatId)
    {
        try
        {
            var thread = await _chatService.GetThreadAsync(chatId);
            if (thread == null)
                return NotFound(new { error = "Thread not found" });

            var messages = await _chatService.GetMessagesAsync(chatId, 500);
            var ordered = messages.OrderBy(m => m.CreatedAt).ToList();

            var participantTasks = thread.ParticipantIds.Select(async userId =>
            {
                try
                {
                    var p = await _profileService.GetProfileAsync(userId);
                    var display = !string.IsNullOrWhiteSpace(p?.Name) ? p!.Name.Trim() : ShortUserLabel(userId);
                    return new AdminChatParticipantInfo { UserId = userId, DisplayName = display };
                }
                catch (Exception ex)
                {
                    _logger.LogDebug(ex, "Admin chat detail: profile {UserId}", userId);
                    return new AdminChatParticipantInfo { UserId = userId, DisplayName = ShortUserLabel(userId) };
                }
            });
            var participants = (await Task.WhenAll(participantTasks)).ToList();

            return Ok(new AdminChatThreadDetail
            {
                ThreadId = thread.ThreadId,
                MatchId = thread.MatchId,
                UnlockedByUserA = thread.UnlockedByUserA,
                UnlockedByUserB = thread.UnlockedByUserB,
                Participants = participants,
                Messages = ordered
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting chat {ChatId}", chatId);
            return StatusCode(500, new { error = "Failed to get chat" });
        }
    }

    private static string ShortUserLabel(string userId)
    {
        if (string.IsNullOrWhiteSpace(userId)) return "—";
        return userId.Length > 14 ? userId[..8] + "…" : userId;
    }

    /// <summary>
    /// DELETE /api/admin/chats/{chatId}/messages/{messageId}
    /// Soft delete a message
    /// </summary>
    [HttpDelete("{chatId}/messages/{messageId}")]
    public async Task<ActionResult> DeleteMessage(string chatId, string messageId, [FromBody] DeleteMessageRequest? request)
    {
        try
        {
            var admin = GetAdminIdentity();

            var message = await _context.LoadAsync<ChatMessage>(chatId, messageId);
            if (message == null)
            {
                return NotFound(new { error = "Message not found" });
            }

            var before = System.Text.Json.JsonSerializer.Serialize(message);

            await _context.DeleteAsync<ChatMessage>(chatId, messageId);

            await _auditLogService.LogActionAsync(
                admin,
                "chat.message.delete",
                "message",
                messageId,
                before: System.Text.Json.JsonSerializer.Deserialize<object>(before),
                after: message);

            return Ok(new { message = "Message deleted successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting message {MessageId}", messageId);
            return StatusCode(500, new { error = "Failed to delete message" });
        }
    }
}

public class DeleteMessageRequest
{
    public string? Reason { get; set; }
}
