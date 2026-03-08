using GetTrainMate.Api.Models;
using GetTrainMate.Api.Services;
using Microsoft.Extensions.Logging;

namespace GetTrainMate.Api.Services.Ai;

public class AiIcebreakerService : IAiIcebreakerService
{
    private readonly IBedrockChatService _chat;
    private readonly ILogger<AiIcebreakerService> _logger;

    private const string SystemPrompt = @"You are a GetTrainMate assistant that suggests short, friendly first messages for two people who might train together. Output ONLY a JSON object: { ""suggestions"": [""message1"",""message2"",""message3"",""message4"",""message5""] }.

RULES:
- 3 to 5 suggestions. Each is one short sentence (under 100 chars).
- Reference shared sport, level, goals, or schedule when available. Be specific and natural.
- Tone: friendly, sporty, not flirty or creepy. No pickup lines. No medical or safety claims.
- If data is limited, suggest generic but safe openers (e.g. ask about training style or availability).
- Output only the JSON, no markdown or explanation.";

    public AiIcebreakerService(IBedrockChatService chat, ILogger<AiIcebreakerService> logger)
    {
        _chat = chat;
        _logger = logger;
    }

    public async Task<IcebreakerResponse> GenerateAsync(IcebreakerRequest request, CancellationToken cancellationToken = default)
    {
        var userMsg = $@"Profile A: {request.MyName}. Bio: {request.MyBio}. Sports: [{string.Join(", ", request.MySports)}]. Level: {request.MyLevel}. Goals: [{string.Join(", ", request.MyGoals)}].
Profile B: {request.OtherName}. Bio: {request.OtherBio}. Sports: [{string.Join(", ", request.OtherSports)}]. Level: {request.OtherLevel}. Goals: [{string.Join(", ", request.OtherGoals)}].
Output the JSON only.";
        var response = await _chat.SendAsync(SystemPrompt, Array.Empty<BedrockChatMessage>(), userMsg, cancellationToken);
        return ParseResponse(response.Content);
    }

    private static IcebreakerResponse ParseResponse(string content)
    {
        try
        {
            var json = System.Text.Json.JsonSerializer.Deserialize<JsonShape>(content.Trim());
            if (json?.suggestions != null)
                return new IcebreakerResponse { Suggestions = json.suggestions };
        }
        catch { /* fallback */ }
        return new IcebreakerResponse { Suggestions = new List<string> { "Hey! Want to plan a training session together?" } };
    }

    private class JsonShape
    {
        public List<string>? suggestions { get; set; }
    }
}
