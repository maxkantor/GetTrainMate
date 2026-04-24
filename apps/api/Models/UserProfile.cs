namespace GetTrainMate.Api.Models;

public class UserProfile
{
    public string UserId { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty; // Display name (required)
    public string? City { get; set; }
    public string? State { get; set; }
    public string? Country { get; set; } = "US";
    public string? Bio { get; set; } // Required, 20-500 chars
    public DateTime? BirthDate { get; set; } // Optional age
    public string? Gender { get; set; } // Optional
    public List<string> SportTags { get; set; } = new(); // Training types (required, at least 1)
    public string? Level { get; set; } // "beginner", "intermediate", "advanced", "pro" (required)
    public List<string> Goals { get; set; } = new(); // Training goals (optional)
    public List<AvailabilitySlot> AvailabilitySchedule { get; set; } = new(); // Required, at least 1 slot
    /// <summary>Legacy single mode; kept in sync with first entry in <see cref="Modes"/> when saving.</summary>
    public string Mode { get; set; } = "TRAIN"; // "TRAIN", "VIBE", "DATE"
    /// <summary>One or more intent modes (TRAIN, VIBE, DATE). When empty, <see cref="Mode"/> is used.</summary>
    public List<string> Modes { get; set; } = new();
    public string? WorkoutStyle { get; set; }
    public string? PersonalityTag { get; set; }
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public string? PhotoKey { get; set; } // S3 key for primary / cover photo (optional; mirrors first PhotoKeys entry)
    public List<string> PhotoKeys { get; set; } = new(); // Ordered S3 keys for gallery (optional)
    public List<string> PhotoUrls { get; set; } = new(); // Legacy support
    public double? PreferredDistanceMiles { get; set; } // Optional
    public bool IsComplete { get; set; } = false;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>Email/push style chat notifications when not in app.</summary>
    public bool ChatNotificationsEnabled { get; set; } = true;

    /// <summary>realtime | smart | daily</summary>
    public string ChatNotificationFrequency { get; set; } = "smart";

    // Discover lifecycle (admin-tunable; defaults preserve current product behavior)
    public bool DiscoverCanReviewSkippedProfiles { get; set; } = true;
    public bool DiscoverCanReviewLikedProfiles { get; set; } = true;
    public bool DiscoverCanReplayDiscoverQueue { get; set; }
    public bool DiscoverCanRewindLastSkip { get; set; } = true;
    public bool DiscoverCanRecycleSkippedProfiles { get; set; }

    // Events early-access (waitlist; user-scoped; no billing until bookings go live)
    public bool EventsWaitlistEnabled { get; set; }
    public string? EventsCityInterest { get; set; }
    public List<string> EventsInterestTypes { get; set; } = new();
    public DateTime? EventsJoinedWaitlistAt { get; set; }
    public DateTime? EventsNotifiedAt { get; set; }
    /// <summary>User-requested city for future coverage (separate from waitlist city).</summary>
    public string? EventsCitySuggestion { get; set; }
    public DateTime? EventsCitySuggestionAt { get; set; }
    public List<string> FavoriteSports { get; set; } = new();
    public List<string> FavoriteTeams { get; set; } = new();
    public List<string> ActiveEventIds { get; set; } = new();
    public List<string> EventActivities { get; set; } = new();

    /// <summary>CRM-only: closed account has been cleared for Cognito so the same email can sign up again.</summary>
    public bool EmailReleasedForSignup { get; set; }
}

public class AvailabilitySlot
{
    public List<string> Days { get; set; } = new(); // e.g., ["Mon", "Wed", "Fri"]
    public string TimeStart { get; set; } = string.Empty; // e.g., "18:00"
    public string TimeEnd { get; set; } = string.Empty; // e.g., "20:00"
}

public class UpdateProfileRequest
{
    public string? Name { get; set; } // Display name (required for completion)
    public string? City { get; set; }
    public string? State { get; set; }
    public string? Country { get; set; }
    public string? Bio { get; set; } // Required, 20-500 chars
    public DateTime? BirthDate { get; set; }
    public string? Gender { get; set; }
    public List<string>? SportTags { get; set; } // Training types (required, at least 1)
    public string? Level { get; set; } // Required
    public List<string>? Goals { get; set; }
    public List<AvailabilitySlot>? AvailabilitySchedule { get; set; } // Required, at least 1 slot
    public string? Mode { get; set; }
    public List<string>? Modes { get; set; }
    public string? WorkoutStyle { get; set; }
    public string? PersonalityTag { get; set; }
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public string? PhotoKey { get; set; } // S3 key for profile photo
    public List<string>? PhotoKeys { get; set; } // Full gallery (ordered); primary is first
    public double? PreferredDistanceMiles { get; set; }
    public bool? ChatNotificationsEnabled { get; set; }
    public string? ChatNotificationFrequency { get; set; }

    public bool? EventsWaitlistEnabled { get; set; }
    public string? EventsCityInterest { get; set; }
    public List<string>? EventsInterestTypes { get; set; }
    public string? EventsCitySuggestion { get; set; }
    public List<string>? FavoriteSports { get; set; }
    public List<string>? FavoriteTeams { get; set; }
    public List<string>? ActiveEventIds { get; set; }
    public List<string>? EventActivities { get; set; }
}
