namespace GetTrainMate.Api.Models;

public class LandingMatchPreviewRequest
{
    /// <summary>Canonical sport tag (e.g. Gym, Running) from landing training dropdown.</summary>
    public string SportTag { get; set; } = "";

    /// <summary>Beginner | Intermediate | Advanced (landing labels).</summary>
    public string Level { get; set; } = "";

    /// <summary>Morning (5–9am) | Mid-day | Evening</summary>
    public string TimePref { get; set; } = "";
}

/// <summary>real = DB matches; demo = labeled example when pool has users but no filter match; empty = no complete profiles in DB.</summary>
public class LandingMatchPreviewResponse
{
    public string Kind { get; set; } = "demo";

    /// <summary>Number of real matches (0–3) when Kind is real; 1 for demo; 0 for empty.</summary>
    public int MatchCount { get; set; }

    public IReadOnlyList<LandingMatchPreviewUserDto> Users { get; set; } = Array.Empty<LandingMatchPreviewUserDto>();

    /// <summary>Shown under headline for demo only.</summary>
    public string? ExampleLabel { get; set; }
}

public class LandingMatchPreviewUserDto
{
    public string Name { get; set; } = "";
    public int? Age { get; set; }

    /// <summary>Training types only (no location).</summary>
    public string TrainingSummary { get; set; } = "";

    public string GoalLine { get; set; } = "";
    public string? PhotoUrl { get; set; }
}
