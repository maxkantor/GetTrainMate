using Amazon.DynamoDBv2;
using Amazon.DynamoDBv2.Model;
using GetTrainMate.Api.Services.ContactForm;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace GetTrainMate.Api.Tests;

/// <summary>In-memory atomic guard for cross-request rate / dedupe unit tests.</summary>
file sealed class MemoryContactFormGuardStore : IContactFormGuardStore
{
    private readonly Dictionary<string, int> _counts = new(StringComparer.Ordinal);
    private readonly HashSet<string> _claimed = new(StringComparer.Ordinal);
    private readonly object _gate = new();

    public Task<bool> TryIncrementRateAsync(string bucketKey, int limit, TimeSpan ttl, CancellationToken cancellationToken)
    {
        lock (_gate)
        {
            _counts.TryGetValue(bucketKey, out var n);
            if (n >= limit) return Task.FromResult(false);
            _counts[bucketKey] = n + 1;
            return Task.FromResult(true);
        }
    }

    public Task<bool> TryClaimDedupeAsync(string fingerprint, TimeSpan ttl, CancellationToken cancellationToken)
    {
        lock (_gate)
        {
            var id = "dedupe:" + fingerprint;
            if (!_claimed.Add(id)) return Task.FromResult(false);
            return Task.FromResult(true);
        }
    }

    public Task<bool> TryClaimTokenAsync(string tokenHash, TimeSpan ttl, CancellationToken cancellationToken)
    {
        lock (_gate)
        {
            var id = "token:" + tokenHash;
            if (!_claimed.Add(id)) return Task.FromResult(false);
            return Task.FromResult(true);
        }
    }
}

public class ContactFormGuardStoreTests
{
    [Fact]
    public async Task Memory_rate_limit_works_across_requests()
    {
        var store = new MemoryContactFormGuardStore();
        Assert.True(await store.TryIncrementRateAsync("rate:ip:a", 2, TimeSpan.FromMinutes(15), CancellationToken.None));
        Assert.True(await store.TryIncrementRateAsync("rate:ip:a", 2, TimeSpan.FromMinutes(15), CancellationToken.None));
        Assert.False(await store.TryIncrementRateAsync("rate:ip:a", 2, TimeSpan.FromMinutes(15), CancellationToken.None));
        // Different bucket still allowed
        Assert.True(await store.TryIncrementRateAsync("rate:ip:b", 2, TimeSpan.FromMinutes(15), CancellationToken.None));
    }

    [Fact]
    public async Task Memory_dedupe_blocks_second_claim()
    {
        var store = new MemoryContactFormGuardStore();
        Assert.True(await store.TryClaimDedupeAsync("fp1", TimeSpan.FromMinutes(15), CancellationToken.None));
        Assert.False(await store.TryClaimDedupeAsync("fp1", TimeSpan.FromMinutes(15), CancellationToken.None));
    }

    [Fact]
    public async Task Dynamo_store_uses_conditional_update_for_rate()
    {
        var ddb = new Mock<IAmazonDynamoDB>();
        var calls = 0;
        ddb.Setup(d => d.UpdateItemAsync(It.IsAny<UpdateItemRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(() =>
            {
                calls++;
                if (calls > 2)
                    throw new ConditionalCheckFailedException("over");
                return new UpdateItemResponse();
            });

        var store = new DynamoContactFormGuardStore(ddb.Object, NullLogger<DynamoContactFormGuardStore>.Instance);
        Assert.True(await store.TryIncrementRateAsync("rate:ip:x", 2, TimeSpan.FromMinutes(15), CancellationToken.None));
        Assert.True(await store.TryIncrementRateAsync("rate:ip:x", 2, TimeSpan.FromMinutes(15), CancellationToken.None));
        Assert.False(await store.TryIncrementRateAsync("rate:ip:x", 2, TimeSpan.FromMinutes(15), CancellationToken.None));
    }

    [Fact]
    public async Task Dynamo_store_dedupe_put_is_conditional()
    {
        var ddb = new Mock<IAmazonDynamoDB>();
        var puts = 0;
        ddb.Setup(d => d.PutItemAsync(It.IsAny<PutItemRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(() =>
            {
                puts++;
                if (puts > 1)
                    throw new ConditionalCheckFailedException("dup");
                return new PutItemResponse();
            });

        var store = new DynamoContactFormGuardStore(ddb.Object, NullLogger<DynamoContactFormGuardStore>.Instance);
        Assert.True(await store.TryClaimDedupeAsync("abc", TimeSpan.FromMinutes(15), CancellationToken.None));
        Assert.False(await store.TryClaimDedupeAsync("abc", TimeSpan.FromMinutes(15), CancellationToken.None));
    }
}
