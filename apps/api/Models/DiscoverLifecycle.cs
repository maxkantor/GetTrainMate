namespace GetTrainMate.Api.Models;

/// <summary>Admin-updatable flags controlling discover visibility and review surfaces.</summary>
public class DiscoverLifecycleFlagsPatch
{
    public bool? CanReviewSkippedProfiles { get; set; }
    public bool? CanReviewLikedProfiles { get; set; }
    public bool? CanReplayDiscoverQueue { get; set; }
    public bool? CanRewindLastSkip { get; set; }
    public bool? CanRecycleSkippedProfiles { get; set; }
}

public class DiscoverLifecycleDto
{
    public bool CanReviewSkippedProfiles { get; set; } = true;
    public bool CanReviewLikedProfiles { get; set; } = true;
    public bool CanReplayDiscoverQueue { get; set; }
    public bool CanRewindLastSkip { get; set; } = true;
    public bool CanRecycleSkippedProfiles { get; set; }

    public static DiscoverLifecycleDto FromProfile(UserProfile? p)
    {
        if (p == null) return new DiscoverLifecycleDto();
        return new DiscoverLifecycleDto
        {
            CanReviewSkippedProfiles = p.DiscoverCanReviewSkippedProfiles,
            CanReviewLikedProfiles = p.DiscoverCanReviewLikedProfiles,
            CanReplayDiscoverQueue = p.DiscoverCanReplayDiscoverQueue,
            CanRewindLastSkip = p.DiscoverCanRewindLastSkip,
            CanRecycleSkippedProfiles = p.DiscoverCanRecycleSkippedProfiles,
        };
    }
}

public class SentRequestItem
{
    public string UserId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? City { get; set; }
    public List<string> PhotoUrls { get; set; } = new();
    public string Status { get; set; } = "Pending";
    public string MatchId { get; set; } = string.Empty;
    public int CompatibilityScore { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class SkippedProfileItem
{
    public string UserId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? City { get; set; }
    public List<string> PhotoUrls { get; set; } = new();
    public DateTime SkippedAt { get; set; }
}
