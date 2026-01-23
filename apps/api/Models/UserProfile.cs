namespace GetTrainMate.Api.Models;

public class UserProfile
{
    public string UserId { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? City { get; set; }
    public string? Bio { get; set; }
    public DateTime? BirthDate { get; set; }
    public string? Gender { get; set; }
    public List<string> SportTags { get; set; } = new();
    public string? Level { get; set; } // "beginner", "intermediate", "advanced", "pro"
    public string? Goals { get; set; }
    public List<string> AvailabilitySchedule { get; set; } = new(); // e.g., ["monday-morning", "wednesday-evening"]
    public string Mode { get; set; } = "TRAIN"; // "TRAIN", "VIBE", "DATE"
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public List<string> PhotoUrls { get; set; } = new();
    public bool IsComplete { get; set; } = false;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public class UpdateProfileRequest
{
    public string? Name { get; set; }
    public string? City { get; set; }
    public string? Bio { get; set; }
    public DateTime? BirthDate { get; set; }
    public string? Gender { get; set; }
    public List<string>? SportTags { get; set; }
    public string? Level { get; set; }
    public string? Goals { get; set; }
    public List<string>? AvailabilitySchedule { get; set; }
    public string? Mode { get; set; }
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
}
