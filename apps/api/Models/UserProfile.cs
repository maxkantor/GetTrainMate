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
    public string Mode { get; set; } = "TRAIN"; // "TRAIN", "VIBE", "DATE"
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public string? PhotoKey { get; set; } // S3 key for profile photo (optional)
    public List<string> PhotoUrls { get; set; } = new(); // Legacy support
    public double? PreferredDistanceMiles { get; set; } // Optional
    public bool IsComplete { get; set; } = false;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
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
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public string? PhotoKey { get; set; } // S3 key for profile photo
    public double? PreferredDistanceMiles { get; set; }
}
