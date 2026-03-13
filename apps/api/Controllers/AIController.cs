using System.Security.Claims;
using GetTrainMate.Api.Configuration;
using GetTrainMate.Api.Models;
using GetTrainMate.Api.Services;
using GetTrainMate.Api.Services.Ai;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace GetTrainMate.Api.Controllers;

[ApiController]
[Route("api/ai")]
public class AIController : ControllerBase
{
    private readonly IBedrockChatService _chat;
    private readonly IAiMatchInsightService _matchInsight;
    private readonly IAiIcebreakerService _icebreaker;
    private readonly IAiProfileOptimizerService _profileOptimizer;
    private readonly IAiWorkoutPlannerService _workoutPlanner;
    private readonly IAiHelpAssistantService _helpAssistant;
    private readonly ICreditsService _credits;
    private readonly IProfileService _profile;
    private readonly IOptions<AiCreditCostsOptions> _costs;
    private readonly ILogger<AIController> _logger;

    public AIController(
        IBedrockChatService chat,
        IAiMatchInsightService matchInsight,
        IAiIcebreakerService icebreaker,
        IAiProfileOptimizerService profileOptimizer,
        IAiWorkoutPlannerService workoutPlanner,
        IAiHelpAssistantService helpAssistant,
        ICreditsService credits,
        IProfileService profile,
        IOptions<AiCreditCostsOptions> costs,
        ILogger<AIController> logger)
    {
        _chat = chat;
        _matchInsight = matchInsight;
        _icebreaker = icebreaker;
        _profileOptimizer = profileOptimizer;
        _workoutPlanner = workoutPlanner;
        _helpAssistant = helpAssistant;
        _credits = credits;
        _profile = profile;
        _costs = costs;
        _logger = logger;
    }

    private string? UserId => User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("sub")?.Value;

    /// <summary>Streaming AI Coach chat. No credit charge by default (configurable).</summary>
    [HttpPost("chat/stream")]
    public async Task StreamChat([FromBody] AiChatStreamRequest request, CancellationToken cancellationToken)
    {
        var userId = UserId;
        if (string.IsNullOrEmpty(userId))
        {
            Response.StatusCode = 401;
            await Response.WriteAsync("Unauthorized", cancellationToken);
            return;
        }
        Response.ContentType = "text/event-stream";
        Response.Headers.CacheControl = "no-cache";
        var history = (request.History ?? Array.Empty<AiChatMessageDto>())
            .Select(m => new BedrockChatMessage(m.Role, m.Content ?? "")).ToList();
        try
        {
            await foreach (var token in _chat.SendStreamAsync(AiPrompts.CoachSystemPrompt, history, request.Message ?? "", cancellationToken))
            {
                await Response.WriteAsync($"data: {System.Text.Json.JsonSerializer.Serialize(new { text = token })}\n\n", cancellationToken);
                await Response.Body.FlushAsync(cancellationToken);
            }
        }
        catch (OperationCanceledException) { }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[AI] Chat stream failed");
            await Response.WriteAsync($"data: {{\"error\":\"Something went wrong.\"}}\n\n", cancellationToken);
        }
    }

    /// <summary>Single response AI Coach (e.g. for mobile or fallback).</summary>
    [HttpPost("chat")]
    public async Task<ActionResult<AiChatResponseDto>> Chat([FromBody] AiChatRequest request, CancellationToken cancellationToken)
    {
        var userId = UserId;
        if (string.IsNullOrEmpty(userId))
            return Unauthorized(new { message = "Invalid token" });
        var history = (request.History ?? Array.Empty<AiChatMessageDto>())
            .Select(m => new BedrockChatMessage(m.Role, m.Content ?? "")).ToList();
        var response = await _chat.SendAsync(AiPrompts.CoachSystemPrompt, history, request.Message ?? "", cancellationToken);
        return Ok(new AiChatResponseDto { Content = response.Content });
    }

    /// <summary>Generate AI match insight. Charges credits only on success.</summary>
    [HttpPost("match-insight")]
    public async Task<ActionResult<MatchInsightResponse>> MatchInsight([FromBody] MatchInsightRequest request, CancellationToken cancellationToken)
    {
        var userId = UserId;
        if (string.IsNullOrEmpty(userId))
            return Unauthorized(new { message = "Invalid token" });
        var cost = _costs.Value.MatchInsight;
        if (cost > 0)
        {
            var balance = await _credits.GetCreditsBalanceAsync(userId);
            if (balance.Balance < cost)
                return StatusCode(402, new { code = "INSUFFICIENT_CREDITS", message = "Not enough credits to unlock AI match insight.", balance = balance.Balance, required = cost });
        }
        try
        {
            var result = await _matchInsight.GenerateAsync(request, cancellationToken);
            if (cost > 0)
                await _credits.SpendCreditsAsync(userId, cost, CreditLedgerReason.AiInsight, request.TargetUserId);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[AI] Match insight failed");
            return StatusCode(500, new { message = "Failed to generate insight. Please try again." });
        }
    }

    /// <summary>Generate AI icebreakers. Charges credits only on success.</summary>
    [HttpPost("icebreakers")]
    public async Task<ActionResult<IcebreakerResponse>> Icebreakers([FromBody] IcebreakerRequest request, CancellationToken cancellationToken)
    {
        var userId = UserId;
        if (string.IsNullOrEmpty(userId))
            return Unauthorized(new { message = "Invalid token" });
        var cost = _costs.Value.Icebreakers;
        if (cost > 0)
        {
            var balance = await _credits.GetCreditsBalanceAsync(userId);
            if (balance.Balance < cost)
                return StatusCode(402, new { code = "INSUFFICIENT_CREDITS", message = "Not enough credits for AI icebreakers.", balance = balance.Balance, required = cost });
        }
        try
        {
            var result = await _icebreaker.GenerateAsync(request, cancellationToken);
            if (cost > 0)
                await _credits.SpendCreditsAsync(userId, cost, CreditLedgerReason.AiIcebreaker, null);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[AI] Icebreakers failed");
            return StatusCode(500, new { message = "Failed to generate icebreakers. Please try again." });
        }
    }

    /// <summary>Suggest profile improvements. Charges credits only on success.</summary>
    [HttpPost("profile-optimize")]
    public async Task<ActionResult<ProfileOptimizeResponse>> ProfileOptimize([FromBody] ProfileOptimizeRequest request, CancellationToken cancellationToken)
    {
        var userId = UserId;
        if (string.IsNullOrEmpty(userId))
            return Unauthorized(new { message = "Invalid token" });
        var cost = _costs.Value.ProfileOptimize;
        if (cost > 0)
        {
            var balance = await _credits.GetCreditsBalanceAsync(userId);
            if (balance.Balance < cost)
                return StatusCode(402, new { code = "INSUFFICIENT_CREDITS", message = "Not enough credits.", balance = balance.Balance, required = cost });
        }
        try
        {
            var result = await _profileOptimizer.SuggestAsync(request, cancellationToken);
            if (cost > 0)
                await _credits.SpendCreditsAsync(userId, cost, CreditLedgerReason.AiProfileOptimize, null);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[AI] Profile optimize failed");
            return StatusCode(500, new { message = "Failed to generate suggestions. Please try again." });
        }
    }

    /// <summary>Generate a simple workout plan. Charges credits only on success.</summary>
    [HttpPost("workout-plan")]
    public async Task<ActionResult<WorkoutPlanResponse>> WorkoutPlan([FromBody] WorkoutPlanRequest request, CancellationToken cancellationToken)
    {
        var userId = UserId;
        if (string.IsNullOrEmpty(userId))
            return Unauthorized(new { message = "Invalid token" });
        var cost = _costs.Value.WorkoutPlan;
        if (cost > 0)
        {
            var balance = await _credits.GetCreditsBalanceAsync(userId);
            if (balance.Balance < cost)
                return StatusCode(402, new { code = "INSUFFICIENT_CREDITS", message = "Not enough credits for AI workout plan.", balance = balance.Balance, required = cost });
        }
        try
        {
            var result = await _workoutPlanner.GenerateAsync(request, cancellationToken);
            if (cost > 0)
                await _credits.SpendCreditsAsync(userId, cost, CreditLedgerReason.AiWorkoutPlan, null);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[AI] Workout plan failed");
            return StatusCode(500, new { message = "Failed to generate plan. Please try again." });
        }
    }

    /// <summary>Help assistant (FAQ, credits, safety). No charge.</summary>
    [HttpPost("help")]
    public async Task<ActionResult<AiHelpResponseDto>> Help([FromBody] AiHelpRequest request, CancellationToken cancellationToken)
    {
        var userId = UserId;
        if (string.IsNullOrEmpty(userId))
            return Unauthorized(new { message = "Invalid token" });
        try
        {
            var answer = await _helpAssistant.AnswerAsync(request.Question ?? "", cancellationToken);
            return Ok(new AiHelpResponseDto { Answer = answer });
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[AI] Help failed");
            return Ok(new AiHelpResponseDto { Answer = "I couldn't find an answer. Please check the FAQ or contact support." });
        }
    }

    /// <summary>Return credit costs for AI features (for UI).</summary>
    [HttpGet("credit-costs")]
    public ActionResult<AiCreditCostsDto> GetCreditCosts()
    {
        var c = _costs.Value;
        return Ok(new AiCreditCostsDto
        {
            MatchInsight = c.MatchInsight,
            Icebreakers = c.Icebreakers,
            WorkoutPlan = c.WorkoutPlan,
            ProfileOptimize = c.ProfileOptimize,
        });
    }
}

public static class AiPrompts
{
    public const string CoachSystemPrompt = @"You are the GetTrainMate AI Coach. You help users with:
- Understanding match quality and compatibility
- Improving their profile (bio, goals, schedule)
- Generating first messages (icebreakers) and meetup ideas
- Simple workout or training session ideas (not medical advice)
- Product questions (credits, how the app works)

Keep responses concise, friendly, and practical. Do not give medical or safety guarantees. Do not use romantic or dating language unless the user's mode is dating. Focus on training, sports, and finding compatible partners.";
}

public class AiChatMessageDto
{
    public string Role { get; set; } = "user";
    public string? Content { get; set; }
}

public class AiChatStreamRequest
{
    public string? Message { get; set; }
    public AiChatMessageDto[]? History { get; set; }
}

public class AiChatRequest
{
    public string? Message { get; set; }
    public AiChatMessageDto[]? History { get; set; }
}

public class AiChatResponseDto
{
    public string Content { get; set; } = "";
}

public class AiHelpRequest
{
    public string? Question { get; set; }
}

public class AiHelpResponseDto
{
    public string Answer { get; set; } = "";
}

public class AiCreditCostsDto
{
    public int MatchInsight { get; set; }
    public int Icebreakers { get; set; }
    public int WorkoutPlan { get; set; }
    public int ProfileOptimize { get; set; }
}
