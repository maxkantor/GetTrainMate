namespace GetTrainMate.Api.Models;

/// <summary>User credits balance (gettrainmate-user-credits).</summary>
public class UserCredits
{
    public string UserId { get; set; } = string.Empty;
    public int Balance { get; set; }
    public int LifetimeEarned { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
