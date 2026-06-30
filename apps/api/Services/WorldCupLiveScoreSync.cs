using System.Globalization;
using System.Text.Json;
using GetTrainMate.Api.Data;
using GetTrainMate.Api.Models;

namespace GetTrainMate.Api.Services;

/// <summary>
/// Pulls World Cup 2026 scores from public feeds on every hub refresh — no hardcoded results.
/// Primary: ESPN scoreboard (live + final). Fallback: openfootball/worldcup.json (final only).
/// </summary>
public sealed class WorldCupLiveScoreSync
{
    private const string EspnScoreboardUrl =
        "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard";
    private const string OpenFootballUrl =
        "https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json";

    private static readonly Dictionary<string, string> NameToTeamId = BuildNameMap();

    public async Task<IReadOnlyDictionary<string, ExternalMatchScore>> FetchScoresAsync(
        HttpClient http,
        DateTime utcNow,
        CancellationToken cancellationToken = default)
    {
        var merged = new Dictionary<string, ExternalMatchScore>(StringComparer.OrdinalIgnoreCase);

        var from = utcNow.Date.AddDays(-14);
        var to = utcNow.Date.AddDays(1);
        for (var day = from; day <= to; day = day.AddDays(1))
        {
            try
            {
                var dateParam = day.ToString("yyyyMMdd", CultureInfo.InvariantCulture);
                var url = $"{EspnScoreboardUrl}?dates={dateParam}";
                await using var stream = await http.GetStreamAsync(url, cancellationToken);
                MergeEspnScoreboard(stream, merged);
            }
            catch
            {
                // Best-effort per day — other days may still succeed.
            }
        }

        try
        {
            await using var stream = await http.GetStreamAsync(OpenFootballUrl, cancellationToken);
            MergeOpenFootball(stream, merged);
        }
        catch
        {
            // openfootball is a fallback only
        }

        return merged;
    }

    internal static void MergeEspnScoreboard(Stream json, Dictionary<string, ExternalMatchScore> merged)
    {
        using var doc = JsonDocument.Parse(json);
        if (!doc.RootElement.TryGetProperty("events", out var events) || events.ValueKind != JsonValueKind.Array)
            return;

        foreach (var ev in events.EnumerateArray())
        {
            if (!ev.TryGetProperty("competitions", out var comps) || comps.GetArrayLength() == 0)
                continue;
            var comp = comps[0];

            if (!comp.TryGetProperty("competitors", out var competitors) || competitors.GetArrayLength() < 2)
                continue;

            string? homeId = null, awayId = null;
            int? homeScore = null, awayScore = null;
            string? winnerId = null;
            foreach (var c in competitors.EnumerateArray())
            {
                var name = c.GetProperty("team").GetProperty("displayName").GetString() ?? "";
                var teamId = ResolveTeamId(name);
                if (teamId == null) continue;

                var homeAway = c.TryGetProperty("homeAway", out var ha) ? ha.GetString() : null;
                var scoreStr = c.TryGetProperty("score", out var sc) ? sc.GetString() : null;
                int? score = int.TryParse(scoreStr, out var n) ? n : null;

                if (c.TryGetProperty("winner", out var winnerEl) && winnerEl.ValueKind == JsonValueKind.True)
                    winnerId = teamId;

                if (string.Equals(homeAway, "home", StringComparison.OrdinalIgnoreCase))
                {
                    homeId = teamId;
                    homeScore = score;
                }
                else if (string.Equals(homeAway, "away", StringComparison.OrdinalIgnoreCase))
                {
                    awayId = teamId;
                    awayScore = score;
                }
            }

            if (homeId == null || awayId == null) continue;

            var statusEl = comp.TryGetProperty("status", out var st) ? st : default;
            var state = statusEl.ValueKind != JsonValueKind.Undefined
                && statusEl.TryGetProperty("type", out var typeEl)
                && typeEl.TryGetProperty("state", out var stateEl)
                ? stateEl.GetString() ?? "pre"
                : "pre";
            var completed = statusEl.ValueKind != JsonValueKind.Undefined
                && statusEl.TryGetProperty("type", out var typeEl2)
                && typeEl2.TryGetProperty("completed", out var compEl)
                && compEl.GetBoolean();

            var status = MapEspnStatus(state, completed);
            if (status == EventMatchStatus.Scheduled && homeScore == null && awayScore == null)
                continue;

            Upsert(merged, homeId, awayId, homeScore, awayScore, status, "espn", priority: 2, winnerId);
        }
    }

    internal static void MergeOpenFootball(Stream json, Dictionary<string, ExternalMatchScore> merged)
    {
        using var doc = JsonDocument.Parse(json);
        if (!doc.RootElement.TryGetProperty("matches", out var matches) || matches.ValueKind != JsonValueKind.Array)
            return;

        foreach (var m in matches.EnumerateArray())
        {
            if (!m.TryGetProperty("score", out var scoreObj)) continue;
            if (!scoreObj.TryGetProperty("ft", out var ft) || ft.GetArrayLength() < 2) continue;

            var team1 = m.GetProperty("team1").GetString() ?? "";
            var team2 = m.GetProperty("team2").GetString() ?? "";
            var id1 = ResolveTeamId(team1);
            var id2 = ResolveTeamId(team2);
            if (id1 == null || id2 == null) continue;

            var s1 = ft[0].GetInt32();
            var s2 = ft[1].GetInt32();
            Upsert(merged, id1, id2, s1, s2, EventMatchStatus.Completed, "openfootball", priority: 1, winnerId: s1 == s2 ? null : (s1 > s2 ? id1 : id2));
        }
    }

    private static void Upsert(
        Dictionary<string, ExternalMatchScore> merged,
        string team1Id,
        string team2Id,
        int? score1,
        int? score2,
        string status,
        string source,
        int priority,
        string? winnerId = null)
    {
        var key = EventMatchRules.NormalizePairKey(team1Id, team2Id);
        var candidate = new ExternalMatchScore(team1Id, team2Id, score1, score2, status, source, priority, winnerId);

        if (!merged.TryGetValue(key, out var existing))
        {
            merged[key] = candidate;
            return;
        }

        if (candidate.Priority > existing.Priority
            || EventMatchRules.MatchStatusOrder(candidate.Status) > EventMatchRules.MatchStatusOrder(existing.Status)
            || (!string.IsNullOrWhiteSpace(candidate.WinnerTeamId) && string.IsNullOrWhiteSpace(existing.WinnerTeamId)))
        {
            merged[key] = candidate;
        }
    }

    internal static string MapEspnStatus(string state, bool completed)
    {
        if (string.Equals(state, "post", StringComparison.OrdinalIgnoreCase) && completed)
            return EventMatchStatus.Completed;
        if (string.Equals(state, "in", StringComparison.OrdinalIgnoreCase))
            return EventMatchStatus.Live;
        return EventMatchStatus.Scheduled;
    }

    internal static string? ResolveTeamId(string name)
    {
        var trimmed = name.Trim();
        if (trimmed.Length == 0) return null;
        if (NameToTeamId.TryGetValue(trimmed, out var id)) return id;

        var normalized = trimmed.ToLowerInvariant();
        if (NameToTeamId.TryGetValue(normalized, out id)) return id;

        return null;
    }

    private static Dictionary<string, string> BuildNameMap()
    {
        var map = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var t in WorldCupOfficialFixtures.Teams)
        {
            map[t.Name] = t.TeamId;
            map[t.Country] = t.TeamId;
            map[t.TeamId] = t.TeamId;
        }

        map["Czech Republic"] = "czechia";
        map["Bosnia & Herzegovina"] = "bosnia-herzegovina";
        map["Bosnia and Herzegovina"] = "bosnia-herzegovina";
        map["United States"] = "usa";
        map["US"] = "usa";
        map["South Korea"] = "south-korea";
        map["Korea Republic"] = "south-korea";
        map["Turkey"] = "turkiye";
        map["Türkiye"] = "turkiye";
        map["Curaçao"] = "curacao";
        map["Curacao"] = "curacao";
        map["Ivory Coast"] = "ivory-coast";
        map["Côte d'Ivoire"] = "ivory-coast";
        map["DR Congo"] = "dr-congo";
        map["Cape Verde"] = "cape-verde";
        map["Saudi Arabia"] = "saudi-arabia";
        map["New Zealand"] = "new-zealand";
        return map;
    }
}

public sealed record ExternalMatchScore(
    string Team1Id,
    string Team2Id,
    int? Score1,
    int? Score2,
    string Status,
    string Source,
    int Priority,
    string? WinnerTeamId = null);
