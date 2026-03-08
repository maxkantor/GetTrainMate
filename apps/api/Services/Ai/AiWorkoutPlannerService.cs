using GetTrainMate.Api.Models;
using GetTrainMate.Api.Services;
using Microsoft.Extensions.Logging;

namespace GetTrainMate.Api.Services.Ai;

public class AiWorkoutPlannerService : IAiWorkoutPlannerService
{
    private readonly IBedrockChatService _chat;
    private readonly ILogger<AiWorkoutPlannerService> _logger;

    private const string SystemPrompt = @"You are a GetTrainMate workout assistant. Generate a simple, practical training plan. This is NOT medical advice; keep it general and safe.

Output ONLY valid JSON: { ""title"": ""string"", ""summary"": ""2-4 sentences"", ""sessions"": [""session1"",""session2"",...] }.
- title: short plan name (e.g. ""1-week running intro"").
- summary: brief overview, tone beginner/intermediate friendly.
- sessions: 3-7 short session descriptions (what to do, duration, focus). Be concise.
Use only the inputs provided. If equipment or constraints are given, respect them. Do not prescribe injury rehab or medical advice.";

    public AiWorkoutPlannerService(IBedrockChatService chat, ILogger<AiWorkoutPlannerService> logger)
    {
        _chat = chat;
        _logger = logger;
    }

    public async Task<WorkoutPlanResponse> GenerateAsync(WorkoutPlanRequest request, CancellationToken cancellationToken = default)
    {
        var userMsg = $@"Sport: {request.Sport}. Level: {request.Level}. Goal: {request.Goal ?? "general fitness"}. Days: [{string.Join(", ", request.AvailableDays)}]. Duration per session: {request.DurationMinutes} min. Equipment: {request.Equipment ?? "standard"}. Constraints: {request.Constraints ?? "none"}. Output the JSON only.";
        var response = await _chat.SendAsync(SystemPrompt, Array.Empty<BedrockChatMessage>(), userMsg, cancellationToken);
        return ParseResponse(response.Content);
    }

    private static WorkoutPlanResponse ParseResponse(string content)
    {
        try
        {
            var json = System.Text.Json.JsonSerializer.Deserialize<JsonShape>(content.Trim());
            if (json != null)
                return new WorkoutPlanResponse
                {
                    Title = json.title ?? "Workout plan",
                    Summary = json.summary ?? "",
                    Sessions = json.sessions ?? new List<string>()
                };
        }
        catch { /* fallback */ }
        return new WorkoutPlanResponse { Title = "Workout plan", Summary = content, Sessions = new List<string>() };
    }

    private class JsonShape
    {
        public string? title { get; set; }
        public string? summary { get; set; }
        public List<string>? sessions { get; set; }
    }
}
