using GetTrainMate.Api.Models;
using GetTrainMate.Api.Services;
using Xunit;

namespace GetTrainMate.Api.Tests;

/// <summary>World Cup predictions are free — no credit service involvement in EventHubService.</summary>
public class EventHubPredictionPolicyTests
{
    [Fact]
    public void EventHubService_DoesNotReferenceCreditsService()
    {
        var methods = typeof(EventHubService).GetMethods()
            .Concat(typeof(EventHubService).GetConstructors().Cast<System.Reflection.MethodBase>());
        var paramTypes = typeof(EventHubService).GetConstructors()
            .SelectMany(c => c.GetParameters())
            .Select(p => p.ParameterType.Name);
        Assert.DoesNotContain(paramTypes, n => n.Contains("Credits", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public void CreateOrUpdatePrediction_AllowsEditBeforeKickoff()
    {
        var future = DateTime.UtcNow.AddDays(3);
        var match = new EventMatch
        {
            Status = EventMatchStatus.Scheduled,
            MatchDate = future.ToString("yyyy-MM-dd"),
            MatchTime = future.ToString("HH:mm"),
        };
        Assert.True(EventMatchRules.ArePredictionsOpen(match));
    }
}
