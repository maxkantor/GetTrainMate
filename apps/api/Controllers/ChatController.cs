using Microsoft.AspNetCore.Mvc;
using GetTrainMate.Api.Models;
using GetTrainMate.Api.Services;
using System.Security.Claims;

namespace GetTrainMate.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ChatController : ControllerBase
{
    private readonly IChatService _chatService;
    private readonly IProfileService _profileService;
    private readonly ILogger<ChatController> _logger;

    public ChatController(
        IChatService chatService,
        IProfileService profileService,
        ILogger<ChatController> logger)
    {
        _chatService = chatService;
        _profileService = profileService;
        _logger = logger;
    }

    [HttpPost("threads")]
    public async Task<ActionResult<ChatThread>> CreateThread([FromBody] CreateThreadRequest request)
    {
        try
        {
            var userId = GetUserIdFromToken();
            if (string.IsNullOrEmpty(userId))
                return Unauthorized(new { message = "Invalid token" });

            if (string.IsNullOrEmpty(request.OtherUserId))
                return BadRequest(new { message = "OtherUserId is required" });

            var thread = await _chatService.CreateThreadAsync(userId, request.OtherUserId);
            return Ok(thread);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating chat thread");
            return StatusCode(500, new { message = "Error creating thread" });
        }
    }

    [HttpGet("threads")]
    public async Task<ActionResult<List<ThreadPreviewResponse>>> GetThreads()
    {
        try
        {
            var userId = GetUserIdFromToken();
            if (string.IsNullOrEmpty(userId))
                return Unauthorized(new { message = "Invalid token" });

            var threads = await _chatService.GetUserThreadsAsync(userId);
            return Ok(threads);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting threads");
            return StatusCode(500, new { message = "Error retrieving threads" });
        }
    }

    [HttpGet("threads/{threadId}/messages")]
    public async Task<ActionResult<List<ChatMessage>>> GetMessages(string threadId, [FromQuery] int limit = 50)
    {
        try
        {
            var userId = GetUserIdFromToken();
            if (string.IsNullOrEmpty(userId))
                return Unauthorized(new { message = "Invalid token" });

            var messages = await _chatService.GetMessagesAsync(threadId, limit);
            return Ok(messages);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting messages");
            return StatusCode(500, new { message = "Error retrieving messages" });
        }
    }

    [HttpPost("threads/{threadId}/messages")]
    public async Task<ActionResult<ChatMessage>> SendMessage(string threadId, [FromBody] SendMessageRequest request)
    {
        try
        {
            var userId = GetUserIdFromToken();
            if (string.IsNullOrEmpty(userId))
                return Unauthorized(new { message = "Invalid token" });

            if (string.IsNullOrEmpty(request.Content))
                return BadRequest(new { message = "Content is required" });

            var userProfile = await _profileService.GetProfileAsync(userId);
            if (userProfile == null)
                return NotFound(new { message = "User profile not found" });

            var message = await _chatService.SendMessageAsync(
                threadId,
                userId,
                userProfile.Name,
                request.Content
            );

            return Ok(message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending message");
            return StatusCode(500, new { message = "Error sending message" });
        }
    }

    [HttpPost("threads/{threadId}/mark-read")]
    public async Task<ActionResult> MarkAsRead(string threadId)
    {
        try
        {
            var userId = GetUserIdFromToken();
            if (string.IsNullOrEmpty(userId))
                return Unauthorized(new { message = "Invalid token" });

            await _chatService.MarkThreadAsReadAsync(threadId, userId);
            return Ok(new { message = "Thread marked as read" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error marking thread as read");
            return StatusCode(500, new { message = "Error marking thread as read" });
        }
    }

    private string? GetUserIdFromToken()
    {
        return User.FindFirst(ClaimTypes.NameIdentifier)?.Value 
            ?? User.FindFirst("sub")?.Value;
    }
}
