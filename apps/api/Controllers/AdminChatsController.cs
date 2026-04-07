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
    private readonly IAuditLogService _auditLogService;
    private readonly ILogger<AdminChatsController> _logger;

    public AdminChatsController(
        IDynamoDBContext context,
        IChatService chatService,
        IAuditLogService auditLogService,
        ILogger<AdminChatsController> logger)
    {
        _context = context;
        _chatService = chatService;
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
    /// Get chat thread details and messages
    /// </summary>
    [HttpGet("{chatId}")]
    public async Task<ActionResult<ChatThreadDetail>> GetChat(string chatId)
    {
        try
        {
            var messages = await _context.QueryAsync<ChatMessage>(chatId)
                .GetRemainingAsync();

            return Ok(new ChatThreadDetail
            {
                ThreadId = chatId,
                Messages = messages.OrderBy(m => m.CreatedAt).ToList()
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting chat {ChatId}", chatId);
            return StatusCode(500, new { error = "Failed to get chat" });
        }
    }

    /// <summary>
    /// DELETE /api/admin/chats/{chatId}/messages/{messageId}
    /// Soft delete a message
    /// </summary>
    [HttpDelete("{chatId}/messages/{messageId}")]
    public async Task<ActionResult> DeleteMessage(string chatId, string messageId, [FromBody] DeleteMessageRequest request)
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

public class ChatThreadDetail
{
    public string ThreadId { get; set; } = string.Empty;
    public List<ChatMessage> Messages { get; set; } = new();
}

public class DeleteMessageRequest
{
    public string? Reason { get; set; }
}
