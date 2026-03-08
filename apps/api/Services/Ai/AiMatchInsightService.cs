using GetTrainMate.Api.Models;
using GetTrainMate.Api.Services;
using Microsoft.Extensions.Logging;

namespace GetTrainMate.Api.Services.Ai;

public class AiMatchInsightService : IAiMatchInsightService
{
    private readonly IBedrockChatService _chat;
    private readonly ILogger<AiMatchInsightService> _logger;

    private const string SystemPrompt = @"You are a training-partner compatibility assistant for GetTrainMate. Given two user profiles, output a SHORT match insight.

RULES:
- Output ONLY valid JSON in this exact shape (no markdown, no extra text): { ""summary"": ""one short paragraph"", ""reasons"": [""reason1"",""reason2"",""reason3""], ""caution"": ""optional note or null"" }
- summary: 2-4 sentences on why they might be a good (or poor) training match. Be specific: sports, level, schedule, goals. Do not fabricate facts not provided.
- reasons: 3-5 bullet reasons (short phrases). Use only information from the profiles.
- caution: if there is a clear mismatch (e.g. level, schedule), one short note; otherwise null.
- Do not promise chemistry, safety, or outcomes. Do not use romantic or dating language. Keep tone practical and sport-focused.";

    public AiMatchInsightService(IBedrockChatService chat, ILogger<AiMatchInsightService> logger)
    {
        _chat = chat;
        _logger = logger;
    }

    public async Task<MatchInsightResponse> GenerateAsync(MatchInsightRequest request, CancellationToken cancellationToken = default)
    {
        var userMsg = BuildUserMessage(request);
        var response = await _chat.SendAsync(SystemPrompt, Array.Empty<BedrockChatMessage>(), userMsg, cancellationToken);
        return ParseResponse(response.Content);
    }

    private static string BuildUserMessage(MatchInsightRequest r)
    {
        return $@"Compatibility score: {r.CompatibilityScore}%.

Profile A: Name={r.MyName}. Bio={r.MyBio}. Sports=[{string.Join(", ", r.MySports)}]. Level={r.MyLevel}. Goals=[{string.Join(", ", r.MyGoals)}]. Schedule={r.MyScheduleSummary ?? "unknown"}.

Profile B: Name={r.OtherName}. Bio={r.OtherBio}. Sports=[{string.Join(", ", r.OtherSports)}]. Level={r.OtherLevel}. Goals=[{string.Join(", ", r.OtherGoals)}]. Schedule={r.OtherScheduleSummary ?? "unknown"}.

Output the JSON only.";
    }

    private static MatchInsightResponse ParseResponse(string content)
    {
        var result = new MatchInsightResponse();
        try
        {
            var json = System.Text.Json.JsonSerializer.Deserialize<JsonShape>(content.Trim());
            if (json != null)
            {
                result.Summary = json.summary ?? "";
                result.Reasons = json.reasons ?? new List<string>();
                result.Caution = json.caution;
            }
        }
        catch
        {
            result.Summary = content.Length > 500 ? content[..500] + "…" : content;
            result.Reasons = new List<string>();
        }
        return result;
    }

    private class JsonShape
    {
        public string? summary { get; set; }
        public List<string>? reasons { get; set; }
        public string? caution { get; set; }
    }
}
