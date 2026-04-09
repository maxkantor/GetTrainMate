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

/// <summary>Anonymous landing hero activity cards + swipe demo deck (real profile photos; no distance/city).</summary>
public class LandingShowcaseResponse
{
    /// <summary>live = at least one image from DB; empty = no usable profiles.</summary>
    public string Kind { get; set; } = "empty";

    /// <summary>Marketing: premium match preview price (USD) shown next to hero / matching demo.</summary>
    public decimal PremiumMatchPreviewUsd { get; set; } = 10m;

    public IReadOnlyList<LandingShowcaseActivityDto> Activity { get; set; } = Array.Empty<LandingShowcaseActivityDto>();

    public IReadOnlyList<LandingShowcaseDeckCardDto> Deck { get; set; } = Array.Empty<LandingShowcaseDeckCardDto>();
}

public class LandingShowcaseActivityDto
{
    public string Line { get; set; } = "";
    public string? AvatarUrl { get; set; }

    /// <summary>Second face for &quot;A matched with B&quot; rows (mutual matches).</summary>
    public string? SecondaryAvatarUrl { get; set; }
}

public class LandingShowcaseDeckCardDto
{
    public string Name { get; set; } = "";
    public int? Age { get; set; }
    public string? PhotoUrl { get; set; }
    public IReadOnlyList<string> Tags { get; set; } = Array.Empty<string>();
    public int MatchPct { get; set; }
}
