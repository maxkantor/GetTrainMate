using Amazon.DynamoDBv2;
using Amazon.DynamoDBv2.Model;
using Microsoft.Extensions.Logging;

namespace GetTrainMate.Api.Services.ContactForm;

/// <summary>
/// Cross-Lambda atomic rate limit + dedupe via DynamoDB conditional updates (TTL expiry).
/// </summary>
public sealed class DynamoContactFormGuardStore : IContactFormGuardStore
{
    public const string TableName = "gettrainmate-contact-form-guard";

    private readonly IAmazonDynamoDB _ddb;
    private readonly ILogger<DynamoContactFormGuardStore> _logger;

    public DynamoContactFormGuardStore(IAmazonDynamoDB ddb, ILogger<DynamoContactFormGuardStore> logger)
    {
        _ddb = ddb;
        _logger = logger;
    }

    public async Task<bool> TryIncrementRateAsync(string bucketKey, int limit, TimeSpan ttl, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(bucketKey) || limit < 1)
            return true;

        var expires = DateTimeOffset.UtcNow.Add(ttl).ToUnixTimeSeconds();
        try
        {
            await _ddb.UpdateItemAsync(new UpdateItemRequest
            {
                TableName = TableName,
                Key = new Dictionary<string, AttributeValue>
                {
                    ["Id"] = new AttributeValue { S = bucketKey },
                },
                UpdateExpression = "ADD #c :one SET ExpiresAt = if_not_exists(ExpiresAt, :ttl), Kind = if_not_exists(Kind, :kind)",
                ConditionExpression = "attribute_not_exists(#c) OR #c < :limit",
                ExpressionAttributeNames = new Dictionary<string, string> { ["#c"] = "Count" },
                ExpressionAttributeValues = new Dictionary<string, AttributeValue>
                {
                    [":one"] = new AttributeValue { N = "1" },
                    [":limit"] = new AttributeValue { N = limit.ToString() },
                    [":ttl"] = new AttributeValue { N = expires.ToString() },
                    [":kind"] = new AttributeValue { S = "rate" },
                },
            }, cancellationToken);
            return true;
        }
        catch (ConditionalCheckFailedException)
        {
            return false;
        }
        catch (Exception ex)
        {
            // Fail open on infra errors so a Dynamo outage does not block all contact forms.
            _logger.LogWarning(ex, "Contact form rate increment failed for bucket (fail-open)");
            return true;
        }
    }

    public async Task<bool> TryClaimDedupeAsync(string fingerprint, TimeSpan ttl, CancellationToken cancellationToken)
    {
        return await TryClaimKeyAsync($"dedupe:{fingerprint}", "dedupe", ttl, cancellationToken);
    }

    public async Task<bool> TryClaimTokenAsync(string tokenHash, TimeSpan ttl, CancellationToken cancellationToken)
    {
        return await TryClaimKeyAsync($"token:{tokenHash}", "token", ttl, cancellationToken);
    }

    private async Task<bool> TryClaimKeyAsync(string id, string kind, TimeSpan ttl, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(id)) return true;
        var expires = DateTimeOffset.UtcNow.Add(ttl).ToUnixTimeSeconds();
        try
        {
            await _ddb.PutItemAsync(new PutItemRequest
            {
                TableName = TableName,
                Item = new Dictionary<string, AttributeValue>
                {
                    ["Id"] = new AttributeValue { S = id },
                    ["Kind"] = new AttributeValue { S = kind },
                    ["Count"] = new AttributeValue { N = "1" },
                    ["ExpiresAt"] = new AttributeValue { N = expires.ToString() },
                    ["CreatedAt"] = new AttributeValue { S = DateTime.UtcNow.ToString("O") },
                },
                ConditionExpression = "attribute_not_exists(Id)",
            }, cancellationToken);
            return true;
        }
        catch (ConditionalCheckFailedException)
        {
            return false;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Contact form claim failed for {Kind} (fail-open)", kind);
            return true;
        }
    }
}
