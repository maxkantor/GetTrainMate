using Amazon.DynamoDBv2;
using Amazon.DynamoDBv2.Model;
using GetTrainMate.Api.Models;
using GetTrainMate.Api.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace GetTrainMate.Api.Tests;

public class LandingMatchPreviewServiceTests
{
    private static IConfiguration TestConfiguration() =>
        new ConfigurationBuilder()
            .AddInMemoryCollection(
                new Dictionary<string, string?>
                {
                    ["DYNAMODB_TABLE_PREFIX"] = "test-",
                    ["DYNAMODB_TABLE_PROFILES"] = "test-profiles",
                    ["DYNAMODB_TABLE_MATCHES"] = "test-matches",
                })
            .Build();

    private static LandingMatchPreviewService CreateService(
        Mock<IAmazonDynamoDB> ddb,
        Mock<IProfileService> profiles,
        Mock<IStorageService> storage)
    {
        storage
            .Setup(s => s.TryPresignCanonicalMediaUrl(It.IsAny<string>(), It.IsAny<TimeSpan>()))
            .Returns<string, TimeSpan>((url, _) =>
                url.StartsWith("https://", StringComparison.OrdinalIgnoreCase) ? url : null);
        storage
            .Setup(s => s.GetPresignedDownloadUrl(It.IsAny<string>(), It.IsAny<TimeSpan>()))
            .Returns("https://signed.example/presigned");

        return new LandingMatchPreviewService(
            ddb.Object,
            profiles.Object,
            storage.Object,
            TestConfiguration(),
            NullLogger<LandingMatchPreviewService>.Instance);
    }

    private static LandingMatchPreviewRequest ValidRequest() =>
        new()
        {
            SportTag = "Gym",
            Level = "intermediate",
            TimePref = "evening",
        };

    [Fact]
    public async Task GetPreviewAsync_WhenScanReturnsNoProfiles_ReturnsDemoDeck_NeverEmpty()
    {
        var ddb = new Mock<IAmazonDynamoDB>();
        ddb.Setup(x => x.ScanAsync(It.IsAny<ScanRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(
                new ScanResponse
                {
                    Items = new List<Dictionary<string, AttributeValue>>(),
                    LastEvaluatedKey = null,
                });

        var profiles = new Mock<IProfileService>();
        var storage = new Mock<IStorageService>();
        var svc = CreateService(ddb, profiles, storage);

        var result = await svc.GetPreviewAsync(ValidRequest(), CancellationToken.None);

        Assert.Equal("demo", result.Kind);
        Assert.NotEqual("empty", result.Kind);
        Assert.Equal(5, result.MatchCount);
        Assert.Equal(5, result.Users.Count);
        Assert.Contains(result.Users, u => string.Equals(u.Name, "Alex Drogba", StringComparison.Ordinal));
        Assert.All(
            result.Users,
            u =>
            {
                Assert.False(string.IsNullOrWhiteSpace(u.Name));
                Assert.False(string.IsNullOrWhiteSpace(u.LevelLabel));
                Assert.False(string.IsNullOrWhiteSpace(u.TimePrefLabel));
                Assert.False(string.IsNullOrWhiteSpace(u.DistanceLabel));
                Assert.False(string.IsNullOrWhiteSpace(u.TrainingSummary));
            });
    }

    [Fact]
    public async Task GetPreviewAsync_WhenOneMatchingProfile_PadsToFour_AndKindIsReal()
    {
        var row = new Dictionary<string, AttributeValue>
        {
            ["userId"] = new AttributeValue { S = "unit-test-user-1" },
        };

        var ddb = new Mock<IAmazonDynamoDB>();
        ddb.Setup(x => x.ScanAsync(It.IsAny<ScanRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(
                new ScanResponse
                {
                    Items = new List<Dictionary<string, AttributeValue>> { row },
                    LastEvaluatedKey = null,
                });

        var matchingProfile = new UserProfile
        {
            UserId = "unit-test-user-1",
            Name = "Unit Match User",
            IsComplete = true,
            SportTags = new List<string> { "Gym" },
            Level = "intermediate",
            Goals = new List<string> { "Build strength" },
            AvailabilitySchedule = new List<AvailabilitySlot>
            {
                new()
                {
                    Days = new List<string> { "Mon" },
                    TimeStart = "18:00",
                    TimeEnd = "20:00",
                },
            },
            UpdatedAt = DateTime.UtcNow,
            PhotoUrls = new List<string> { "https://cdn.example.com/profiles/unit-test-user-1/cover.jpg" },
        };

        var profiles = new Mock<IProfileService>();
        profiles
            .Setup(p => p.TryMapDynamoItemToProfile(It.IsAny<Dictionary<string, AttributeValue>>()))
            .Returns(matchingProfile);

        var storage = new Mock<IStorageService>();
        var svc = CreateService(ddb, profiles, storage);

        var result = await svc.GetPreviewAsync(ValidRequest(), CancellationToken.None);

        Assert.Equal("real", result.Kind);
        Assert.Equal(4, result.MatchCount);
        Assert.Equal(4, result.Users.Count);
        Assert.Contains(result.Users, u => u.Name == "Unit Match User");
        Assert.Contains(result.Users, u => u.Name == "Alex Drogba");
    }
}
