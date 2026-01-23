using Amazon.DynamoDBv2.DataModel;
using System.ComponentModel.DataAnnotations;

namespace GetTrainMate.Api.Models;

[DynamoDBTable("admins")]
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

[DynamoDBTable("cms-content")]
public class CMSContent
{
    [DynamoDBHashKey]
    public string ContentType { get; set; } // "landing_hero", "feature", "testimonial", "faq", "blog"

    [DynamoDBRangeKey]
    public string ContentId { get; set; } = Guid.NewGuid().ToString();

    public string Title { get; set; }
    public string Body { get; set; }
    public Dictionary<string, string> Translations { get; set; } = new(); // language -> content
    public string Status { get; set; } = "draft"; // draft, published, archived
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? PublishedAt { get; set; }
    public string CreatedBy { get; set; } // adminId
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

public class CreateContentRequest
{
    [Required]
    public string ContentType { get; set; }

    [Required]
    public string Title { get; set; }

    [Required]
    public string Body { get; set; }

    public Dictionary<string, string> Translations { get; set; } = new();
    public string Status { get; set; } = "draft";
}

public class ContentResponse
{
    public string ContentId { get; set; }
    public string ContentType { get; set; }
    public string Title { get; set; }
    public string Body { get; set; }
    public Dictionary<string, string> Translations { get; set; }
    public string Status { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? PublishedAt { get; set; }
}
