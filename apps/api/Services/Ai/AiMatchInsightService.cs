using GetTrainMate.Api.Models;
using GetTrainMate.Api.Services;
using GetTrainMate.Api.Services.Bedrock;
using Microsoft.Extensions.Logging;

namespace GetTrainMate.Api.Services.Ai;

public class AiMatchInsightService : IAiMatchInsightService
{
    private readonly IBedrockChatService _chat;
    private readonly IBedrockClientWrapper _bedrock;
    private readonly ILogger<AiMatchInsightService> _logger;

    private const string SystemPrompt = @"You are a training-partner compatibility assistant for GetTrainMate. Given two user profiles, output a SHORT match insight.

RULES:
- Output ONLY valid JSON in this exact shape (no markdown, no extra text): { ""summary"": ""one short paragraph"", ""reasons"": [""reason1"",""reason2"",""reason3""], ""caution"": ""optional note or null"" }
- summary: 2-4 sentences on why they might be a good (or poor) training match. Be specific: sports, level, schedule, goals. Do not fabricate facts not provided.
- reasons: 3-5 bullet reasons (short phrases). Use only information from the profiles.
- caution: if there is a clear mismatch (e.g. level, schedule), one short note; otherwise null.
- Do not promise chemistry, safety, or outcomes. Do not use romantic or dating language. Keep tone practical and sport-focused.";

    public AiMatchInsightService(IBedrockChatService chat, IBedrockClientWrapper bedrock, ILogger<AiMatchInsightService> logger)
    {
        _chat = chat;
        _bedrock = bedrock;
        _logger = logger;
    }

    public async Task<MatchInsightResponse> GenerateAsync(MatchInsightRequest request, CancellationToken cancellationToken = default)
    {
        if (!_bedrock.IsAvailable)
            return BuildRuleBasedInsight(request);

        var userMsg = BuildUserMessage(request);
        var response = await _chat.SendAsync(SystemPrompt, Array.Empty<BedrockChatMessage>(), userMsg, cancellationToken);
        return ParseResponse(response.Content);
    }

    private static MatchInsightResponse BuildRuleBasedInsight(MatchInsightRequest r)
    {
        var score = r.CompatibilityScore;
        var reasons = new List<string>();

        if (!string.IsNullOrEmpty(r.OtherLevel) && !string.IsNullOrEmpty(r.MyLevel))
            reasons.Add($"Similar level ({r.MyLevel} / {r.OtherLevel})");

        var common = (r.MySports ?? Enumerable.Empty<string>()).Intersect(r.OtherSports ?? Enumerable.Empty<string>(), StringComparer.OrdinalIgnoreCase).ToList();
        if (common.Count > 0)
            reasons.Add($"{common.Count} shared sport(s): {string.Join(", ", common)}");
        else if ((r.OtherSports?.Count ?? 0) > 0)
            reasons.Add("Different sports; could complement each other");

        if (!string.IsNullOrEmpty(r.OtherBio))
            reasons.Add("Bio indicates training goals");

        if (!string.IsNullOrEmpty(r.MyScheduleSummary) && r.MyScheduleSummary != "unknown")
            reasons.Add("You have availability set");

        var summary = score >= 70
            ? $"{r.OtherName} looks like a solid training match. You share interests and similar experience level. Good potential for workouts together."
            : score >= 50
                ? $"Moderate compatibility with {r.OtherName}. Some shared interests; schedule or goals may need alignment for the best fit."
                : $"{r.OtherName} may have different focus. Check their profile for details — opposites can sometimes make great training partners too.";

        return new MatchInsightResponse
        {
            Summary = summary,
            Reasons = reasons,
            Caution = score < 50 ? "Different experience levels or goals — verify compatibility before committing." : null,
        };
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
