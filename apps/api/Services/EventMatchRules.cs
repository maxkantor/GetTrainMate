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

    public static int MatchStatusOrder(string? status)
    {
        if (string.Equals(status, EventMatchStatus.Completed, StringComparison.OrdinalIgnoreCase)) return 2;
        if (string.Equals(status, EventMatchStatus.Live, StringComparison.OrdinalIgnoreCase)) return 1;
        return 0;
    }

    /// <summary>
    /// Apply catalog scores only when DynamoDB is behind — never overwrite a stored full-time result.
    /// </summary>
    public static bool ShouldApplyOfficialScoreOverride(
        EventMatch match,
        string officialStatus,
        int officialScoreA,
        int officialScoreB)
    {
        if (string.Equals(match.Status, officialStatus, StringComparison.OrdinalIgnoreCase)
            && match.ScoreA == officialScoreA
            && match.ScoreB == officialScoreB)
            return false;

        if (string.Equals(match.Status, EventMatchStatus.Completed, StringComparison.OrdinalIgnoreCase)
            && match.ScoreA.HasValue
            && match.ScoreB.HasValue)
            return false;

        if (MatchStatusOrder(officialStatus) < MatchStatusOrder(match.Status))
            return false;

        return true;
    }

    /// <summary>Scheduled fixtures past kickoff but still within a typical match window should show as Live.</summary>
    public static bool ShouldMarkLiveFromKickoff(EventMatch match, DateTime utcNow, int matchDurationMinutes = 105)
    {
        if (!string.Equals(match.Status, EventMatchStatus.Scheduled, StringComparison.OrdinalIgnoreCase))
            return false;

        var kickoff = ParseKickoffUtc(match.MatchDate, match.MatchTime);
        if (!kickoff.HasValue) return false;

        return utcNow >= kickoff.Value && utcNow < kickoff.Value.AddMinutes(matchDurationMinutes);
    }

    /// <summary>Undo Live status when kickoff is still in the future (bad fixture date or early flip).</summary>
    public static bool ShouldRevertPrematureLive(EventMatch match, DateTime utcNow)
    {
        if (!string.Equals(match.Status, EventMatchStatus.Live, StringComparison.OrdinalIgnoreCase))
            return false;

        var kickoff = ParseKickoffUtc(match.MatchDate, match.MatchTime);
        if (!kickoff.HasValue) return false;

        return utcNow < kickoff.Value;
    }
}
