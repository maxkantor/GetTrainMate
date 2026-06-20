using GetTrainMate.Api.Data;
using GetTrainMate.Api.Services;
using Xunit;

namespace GetTrainMate.Api.Tests;

public class WorldCupOfficialKickoffsTests
{
    [Fact]
    public void TunisiaJapan_Kickoff_IsFifaUtcCalendarDate()
    {
        var kickoff = WorldCupOfficialFixtures.GroupKickoffs
            .Single(k => k.TeamAId == "tunisia" && k.TeamBId == "japan");

        Assert.Equal("2026-06-21", kickoff.DateUtc);
        Assert.Equal("04:00", kickoff.TimeUtc);

        var parsed = EventMatchRules.ParseKickoffUtc(kickoff.DateUtc, kickoff.TimeUtc);
        Assert.NotNull(parsed);
        // Sun 21 Jun 2026 04:00 UTC = Sun 12:00 AM Eastern (EDT)
        Assert.Equal(new DateTime(2026, 6, 21, 4, 0, 0, DateTimeKind.Utc), parsed.Value);
    }
}
