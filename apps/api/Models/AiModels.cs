namespace GetTrainMate.Api.Models;

/// <summary>Request for AI match insight (two profiles).</summary>
public class MatchInsightRequest
{
    public string UserId { get; set; } = string.Empty;
    public string TargetUserId { get; set; } = string.Empty;
    public string? MyName { get; set; }
    public string? MyBio { get; set; }
    public List<string> MySports { get; set; } = new();
    public string? MyLevel { get; set; }
    public List<string> MyGoals { get; set; } = new();
    public string? MyScheduleSummary { get; set; }
    public string? OtherName { get; set; }
    public string? OtherBio { get; set; }
    public List<string> OtherSports { get; set; } = new();
    public string? OtherLevel { get; set; }
    public List<string> OtherGoals { get; set; } = new();
    public string? OtherScheduleSummary { get; set; }
    public int CompatibilityScore { get; set; }
}

/// <summary>Response for AI match insight.</summary>
public class MatchInsightResponse
{
    public string Summary { get; set; } = string.Empty;
    public List<string> Reasons { get; set; } = new();
    public string? Caution { get; set; }
}

/// <summary>Request for AI icebreakers (two profiles for a match).</summary>
public class IcebreakerRequest
{
    public string MyName { get; set; } = string.Empty;
    public string? MyBio { get; set; }
    public List<string> MySports { get; set; } = new();
    public string? MyLevel { get; set; }
    public List<string> MyGoals { get; set; } = new();
    public string? OtherName { get; set; }
    public string? OtherBio { get; set; }
    public List<string> OtherSports { get; set; } = new();
    public string? OtherLevel { get; set; }
    public List<string> OtherGoals { get; set; } = new();
}

/// <summary>Response with 3-5 opener suggestions.</summary>
public class IcebreakerResponse
{
    public List<string> Suggestions { get; set; } = new();
}

/// <summary>Request for profile optimization (bio, goals, etc.).</summary>
public class ProfileOptimizeRequest
{
    public string? Bio { get; set; }
    public List<string> Goals { get; set; } = new();
    public List<string> SportTags { get; set; } = new();
    public string? Level { get; set; }
    public string? ScheduleSummary { get; set; }
}

/// <summary>Response with improved text suggestions (user accepts/rejects).</summary>
public class ProfileOptimizeResponse
{
    public string? SuggestedBio { get; set; }
    public List<string> SuggestedGoals { get; set; } = new();
    public string? SuggestedScheduleSummary { get; set; }
}

/// <summary>Request for workout plan.</summary>
public class WorkoutPlanRequest
{
    public string Sport { get; set; } = string.Empty;
    public string Level { get; set; } = "intermediate";
    public string? Goal { get; set; }
    public List<string> AvailableDays { get; set; } = new();
    public int DurationMinutes { get; set; } = 60;
    public string? Equipment { get; set; }
    public string? Constraints { get; set; }
}

/// <summary>Response with a simple plan (not medical advice).</summary>
public class WorkoutPlanResponse
{
    public string Title { get; set; } = string.Empty;
    public string Summary { get; set; } = string.Empty;
    public List<string> Sessions { get; set; } = new();
}

/// <summary>Credit check result for an AI action.</summary>
public class CreditCheckResult
{
    public bool Allowed { get; set; }
    public int Balance { get; set; }
    public int Required { get; set; }
    public string? Message { get; set; }
}
