using Amazon.DynamoDBv2.DataModel;

namespace GetTrainMate.Api.Models;

[DynamoDBTable("gettrainmate-billing-plans")]
public class BillingPlan
{
    [DynamoDBHashKey]
    public string Key { get; set; } = string.Empty; // free | pro | elite

    public string DisplayName { get; set; } = string.Empty;
    public decimal MonthlyPrice { get; set; }
    public List<string> Features { get; set; } = new();
    public bool IsActive { get; set; } = true;
    public int SortOrder { get; set; }
    public string? StripePriceIdMonthly { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
