using GetTrainMate.Api.Models;
using GetTrainMate.Api.Services;
using Microsoft.Extensions.Logging;

namespace GetTrainMate.Api.Services.Ai;

public class AiProfileOptimizerService : IAiProfileOptimizerService
{
    private readonly IBedrockChatService _chat;
    private readonly ILogger<AiProfileOptimizerService> _logger;

    private const string SystemPrompt = @"You are a GetTrainMate profile assistant. Suggest clearer, more specific text for a training partner profile. Keep the user's voice; do not make it robotic or generic.

Output ONLY valid JSON: { ""suggestedBio"": ""string or null"", ""suggestedGoals"": [""goal1"",""goal2""], ""suggestedScheduleSummary"": ""string or null"" }.
- suggestedBio: improved bio (20-500 chars), or null if input bio is already good.
- suggestedGoals: 1-5 short goal phrases. More specific is better.
- suggestedScheduleSummary: e.g. ""Mon/Wed/Fri evenings"" or null.
Do not fabricate sports or facts. Output only the JSON.";

    public AiProfileOptimizerService(IBedrockChatService chat, ILogger<AiProfileOptimizerService> logger)
    {
        _chat = chat;
        _logger = logger;
    }

    public async Task<ProfileOptimizeResponse> SuggestAsync(ProfileOptimizeRequest request, CancellationToken cancellationToken = default)
    {
        var userMsg = $@"Current bio: {request.Bio ?? "(empty)"}. Goals: [{string.Join(", ", request.Goals)}]. Sports: [{string.Join(", ", request.SportTags)}]. Level: {request.Level}. Schedule: {request.ScheduleSummary ?? "unknown"}. Output the JSON only.";
        var response = await _chat.SendAsync(SystemPrompt, Array.Empty<BedrockChatMessage>(), userMsg, cancellationToken);
        return ParseResponse(response.Content);
    }

    private static ProfileOptimizeResponse ParseResponse(string content)
    {
        try
        {
            var json = System.Text.Json.JsonSerializer.Deserialize<JsonShape>(content.Trim());
            if (json != null)
                return new ProfileOptimizeResponse
                {
                    SuggestedBio = json.suggestedBio,
                    SuggestedGoals = json.suggestedGoals ?? new List<string>(),
                    SuggestedScheduleSummary = json.suggestedScheduleSummary
                };
        }
        catch { /* fallback */ }
        return new ProfileOptimizeResponse();
    }

    private class JsonShape
    {
        public string? suggestedBio { get; set; }
        public List<string>? suggestedGoals { get; set; }
        public string? suggestedScheduleSummary { get; set; }
    }
}
