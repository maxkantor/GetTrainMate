using GetTrainMate.Api.Models;

namespace GetTrainMate.Api.Services;

public static class EventMatchRules
{
    public static string NormalizePairKey(string teamAId, string teamBId)
    {
        var a = teamAId.Trim().ToLowerInvariant();
        var b = teamBId.Trim().ToLowerInvariant();
        return string.CompareOrdinal(a, b) <= 0 ? $"{a}|{b}" : $"{b}|{a}";
    }

    public static bool IsDuplicateFixture(IEnumerable<EventMatch> existing, string teamAId, string teamBId, string? excludeMatchId = null)
    {
        var key = NormalizePairKey(teamAId, teamBId);
        return existing.Any(m =>
            (excludeMatchId == null || !string.Equals(m.MatchId, excludeMatchId, StringComparison.OrdinalIgnoreCase))
            && NormalizePairKey(m.TeamAId, m.TeamBId) == key);
    }

    public static DateTime? ParseKickoffUtc(string? matchDate, string? matchTime)
    {
        if (string.IsNullOrWhiteSpace(matchDate) || string.IsNullOrWhiteSpace(matchTime)) return null;
        var time = matchTime.Trim();
        if (time.Length == 5) time += ":00";
        if (!DateTime.TryParse($"{matchDate.Trim()}T{time}Z", null, System.Globalization.DateTimeStyles.AssumeUniversal | System.Globalization.DateTimeStyles.AdjustToUniversal, out var kickoff))
            return null;
        return kickoff;
    }

    public static bool ArePredictionsOpen(EventMatch match)
    {
        if (match.PredictionsLocked) return false;

        if (string.Equals(match.Status, EventMatchStatus.Completed, StringComparison.OrdinalIgnoreCase)
            || string.Equals(match.Status, EventMatchStatus.Live, StringComparison.OrdinalIgnoreCase)
            || string.Equals(match.Status, EventMatchStatus.Postponed, StringComparison.OrdinalIgnoreCase))
            return false;

        var kickoff = ParseKickoffUtc(match.MatchDate, match.MatchTime);
        if (kickoff.HasValue && kickoff.Value <= DateTime.UtcNow)
            return false;

        return true;
    }

    public static EventMatch Enrich(EventMatch match)
    {
        match.PredictionsOpen = ArePredictionsOpen(match);
        return match;
    }

    public static int StageSortOrder(EventMatch match)
    {
        if (!string.IsNullOrWhiteSpace(match.GroupId)) return 0;
        return (match.Stage ?? "").Trim().ToLowerInvariant() switch
        {
            "round of 32" => 1,
            "round of 16" => 2,
            "quarter-final" => 3,
            "semi-final" => 4,
            "third-place match" => 5,
            "final" => 6,
            _ => 0,
        };
    }

    public static int CompareChronological(EventMatch a, EventMatch b)
    {
        var kickA = ParseKickoffUtc(a.MatchDate, a.MatchTime);
        var kickB = ParseKickoffUtc(b.MatchDate, b.MatchTime);
        var keyA = kickA?.Ticks ?? long.MaxValue;
        var keyB = kickB?.Ticks ?? long.MaxValue;
        var cmp = keyA.CompareTo(keyB);
        if (cmp != 0) return cmp;
        cmp = StageSortOrder(a).CompareTo(StageSortOrder(b));
        if (cmp != 0) return cmp;
        return string.Compare(a.MatchId, b.MatchId, StringComparison.OrdinalIgnoreCase);
    }
}
