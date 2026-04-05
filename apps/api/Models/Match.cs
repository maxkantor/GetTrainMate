namespace GetTrainMate.Api.Models;

public class Match
{
    public string MatchId { get; set; } = Guid.NewGuid().ToString();
    public string UserId1 { get; set; } = string.Empty;
    public string UserId2 { get; set; } = string.Empty;
    public int CompatibilityScore { get; set; } // 0-100
    public List<string> CommonSports { get; set; } = new();
    public List<string> CommonSchedule { get; set; } = new();
    public double Distance { get; set; } // kilometers
    public bool User1Liked { get; set; } = false;
    public bool User2Liked { get; set; } = false;
    public bool IsMatched { get; set; } = false; // true when both have liked
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public class MatchFeedItem
{
    public string UserId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? City { get; set; }
    public string? Bio { get; set; }
    public List<string> SportTags { get; set; } = new();
    public string? Level { get; set; }
    public List<string> PhotoUrls { get; set; } = new();
    public int CompatibilityScore { get; set; }
    public List<string> CommonSports { get; set; } = new();
    public string? Mode { get; set; }
    public List<string> Modes { get; set; } = new();
    /// <summary>exact | overlap | unknown</summary>
    public string IntentMatchTier { get; set; } = "unknown";
    public List<string> MatchPreviewReasons { get; set; } = new();
    public List<string> LockedInsightReasons { get; set; } = new();
    /// <summary>True when this row was previously skipped (or recycled) and is not a first-time discover.</summary>
    public bool SeenBefore { get; set; }
}

public class LikeRequest
{
    public string TargetUserId { get; set; } = string.Empty;
}

public class PassRequest
{
    public string TargetUserId { get; set; } = string.Empty;
}

public class CancelSentInviteRequest
{
    public string TargetUserId { get; set; } = string.Empty;
}

public class MatchResponse
{
    public string MatchId { get; set; } = string.Empty;
    public int CompatibilityScore { get; set; }
    public bool IsMatched { get; set; }
}

public class DiscoverSkipRecord
{
    public string TargetUserId { get; set; } = string.Empty;
    public DateTime SkippedAt { get; set; }
    public string SkippedByUserId { get; set; } = string.Empty;
    public bool IsSkipped { get; set; } = true;
    public bool Restored { get; set; }
}

public class AdminDiscoverControls
{
    public bool IgnoreSkippedProfilesInDiscoverForAdmin { get; set; }
}

public class AdminDiscoverProfileRow
{
    public string UserId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Status { get; set; } = "active"; // active | skipped | matched | hidden
    public DateTime? LastSkippedAt { get; set; }
    public string? LastSkippedByUserId { get; set; }
}

public class CompatibilityInfo
{
    public int CompatibilityScore { get; set; }
    public List<string> CommonSports { get; set; } = new();
    public string? Level { get; set; }
    public string? City { get; set; }
    public string? Mode { get; set; }
    public List<string> Modes { get; set; } = new();
}
