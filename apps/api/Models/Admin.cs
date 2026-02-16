using Amazon.DynamoDBv2.DataModel;
using System.ComponentModel.DataAnnotations;

namespace GetTrainMate.Api.Models;

[DynamoDBTable("gettrainmate-admins")]
public class AdminUser
{
    [DynamoDBHashKey]
    public string Email { get; set; }

    [DynamoDBRangeKey]
    public string AdminId { get; set; } = Guid.NewGuid().ToString();

    public string Name { get; set; }
    public List<string> Permissions { get; set; } = new(); // "content_management", "user_management", "analytics", "settings"
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? LastLoginAt { get; set; }
}

public class AdminLoginRequest
{
    [Required]
    public string Email { get; set; }

    [Required]
    public string Password { get; set; }
}

public class AdminTokenResponse
{
    public string Token { get; set; }
    public AdminUserDto Admin { get; set; }
}

public class AdminUserDto
{
    public string AdminId { get; set; }
    public string Email { get; set; }
    public string Name { get; set; }
    public List<string> Permissions { get; set; }
    public bool IsActive { get; set; }
}

