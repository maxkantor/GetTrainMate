using GetTrainMate.Api.Models;
using GetTrainMate.Api.Services;
using Xunit;

namespace GetTrainMate.Api.Tests;

public class EventMatchRulesTests
{
    [Fact]
    public void ArePredictionsOpen_ReturnsFalse_WhenMatchIsLive()
    {
        var match = new EventMatch { Status = EventMatchStatus.Live };
        Assert.False(EventMatchRules.ArePredictionsOpen(match));
    }

    [Fact]
    public void ArePredictionsOpen_ReturnsFalse_WhenMatchIsFinal()
    {
        var match = new EventMatch { Status = EventMatchStatus.Completed };
        Assert.False(EventMatchRules.ArePredictionsOpen(match));
    }

    [Fact]
    public void ArePredictionsOpen_ReturnsFalse_WhenManuallyLocked()
    {
        var match = new EventMatch { Status = EventMatchStatus.Scheduled, PredictionsLocked = true };
        Assert.False(EventMatchRules.ArePredictionsOpen(match));
    }

    [Fact]
    public void ArePredictionsOpen_ReturnsFalse_AfterKickoff()
    {
        var past = DateTime.UtcNow.AddHours(-1);
        var match = new EventMatch
        {
            Status = EventMatchStatus.Scheduled,
            MatchDate = past.ToString("yyyy-MM-dd"),
            MatchTime = past.ToString("HH:mm"),
        };
        Assert.False(EventMatchRules.ArePredictionsOpen(match));
    }

    [Fact]
    public void ArePredictionsOpen_ReturnsTrue_BeforeKickoff()
    {
        var future = DateTime.UtcNow.AddDays(2);
        var match = new EventMatch
        {
            Status = EventMatchStatus.Scheduled,
            MatchDate = future.ToString("yyyy-MM-dd"),
            MatchTime = future.ToString("HH:mm"),
        };
        Assert.True(EventMatchRules.ArePredictionsOpen(match));
    }

    [Fact]
    public void IsDuplicateFixture_DetectsReversedPairing()
    {
        var existing = new List<EventMatch>
        {
            new() { MatchId = "m1", TeamAId = "mexico", TeamBId = "south-africa" },
        };
        Assert.True(EventMatchRules.IsDuplicateFixture(existing, "south-africa", "mexico"));
        Assert.False(EventMatchRules.IsDuplicateFixture(existing, "south-africa", "mexico", "m1"));
    }

    [Fact]
    public void CompareChronological_PutsDatedFixturesBeforeUndatedKnockoutSlots()
    {
        var group = new EventMatch
        {
            MatchId = "gs-a",
            GroupId = "group-a",
            MatchDate = "2026-06-18",
            MatchTime = "16:00",
        };
        var final = new EventMatch { MatchId = "final", Stage = "Final" };
        Assert.True(EventMatchRules.CompareChronological(group, final) < 0);
    }

    [Fact]
    public void CompareChronological_OrdersUndatedKnockoutByStage()
    {
        var r16 = new EventMatch { MatchId = "r16", Stage = "Round of 16" };
        var final = new EventMatch { MatchId = "final", Stage = "Final" };
        Assert.True(EventMatchRules.CompareChronological(r16, final) < 0);
    }

    [Fact]
    public void ShouldApplyOfficialScoreOverride_AppliesWhenFixtureStillScheduled()
    {
        var match = new EventMatch { Status = EventMatchStatus.Scheduled };
        Assert.True(EventMatchRules.ShouldApplyOfficialScoreOverride(match, EventMatchStatus.Completed, 4, 1));
    }

    [Fact]
    public void ShouldApplyOfficialScoreOverride_DoesNotOverwriteStoredFullTimeResult()
    {
        var match = new EventMatch
        {
            Status = EventMatchStatus.Completed,
            ScoreA = 4,
            ScoreB = 1,
        };
        Assert.False(EventMatchRules.ShouldApplyOfficialScoreOverride(match, EventMatchStatus.Live, 2, 0));
        Assert.False(EventMatchRules.ShouldApplyOfficialScoreOverride(match, EventMatchStatus.Completed, 2, 0));
    }

    [Fact]
    public void ShouldApplyOfficialScoreOverride_AdvancesLiveToCompleted()
    {
        var match = new EventMatch
        {
            Status = EventMatchStatus.Live,
            ScoreA = 2,
            ScoreB = 0,
        };
        Assert.True(EventMatchRules.ShouldApplyOfficialScoreOverride(match, EventMatchStatus.Completed, 4, 1));
    }

    [Fact]
    public void ShouldMarkLiveFromKickoff_ReturnsTrue_WithinMatchWindow()
    {
        var kickoff = DateTime.UtcNow.AddMinutes(-30);
        var match = new EventMatch
        {
            Status = EventMatchStatus.Scheduled,
            MatchDate = kickoff.ToString("yyyy-MM-dd"),
            MatchTime = kickoff.ToString("HH:mm"),
        };
        Assert.True(EventMatchRules.ShouldMarkLiveFromKickoff(match, DateTime.UtcNow));
    }

    [Fact]
    public void ShouldMarkLiveFromKickoff_ReturnsFalse_WhenAlreadyCompleted()
    {
        var kickoff = DateTime.UtcNow.AddMinutes(-30);
        var match = new EventMatch
        {
            Status = EventMatchStatus.Completed,
            MatchDate = kickoff.ToString("yyyy-MM-dd"),
            MatchTime = kickoff.ToString("HH:mm"),
        };
        Assert.False(EventMatchRules.ShouldMarkLiveFromKickoff(match, DateTime.UtcNow));
    }
}
