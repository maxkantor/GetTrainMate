using GetTrainMate.Api.Models;
using GetTrainMate.Api.Services;
using Xunit;

namespace GetTrainMate.Api.Tests;

public class ProfilePhotoRequiredTests
{
    [Fact]
    public void HasRealProfilePhoto_False_WhenEmpty()
    {
        var p = new UserProfile { UserId = "u1" };
        Assert.False(ProfileService.HasRealProfilePhoto(p));
    }

    [Fact]
    public void HasRealProfilePhoto_True_WhenPhotoKeyPresent()
    {
        var p = new UserProfile { UserId = "u1", PhotoKey = "profiles/u1/a.jpg" };
        Assert.True(ProfileService.HasRealProfilePhoto(p));
    }

    [Fact]
    public void HasRealProfilePhoto_False_ForRandomUserPlaceholder()
    {
        var p = new UserProfile
        {
            UserId = "u1",
            PhotoUrls = new List<string> { "https://randomuser.me/api/portraits/men/1.jpg" },
        };
        Assert.False(ProfileService.HasRealProfilePhoto(p));
    }

    [Fact]
    public void HasRealProfilePhoto_True_ForHttpsUrl()
    {
        var p = new UserProfile
        {
            UserId = "u1",
            PhotoUrls = new List<string> { "https://gettrainmate-media-bucket.s3.amazonaws.com/profiles/u1/a.jpg" },
        };
        Assert.True(ProfileService.HasRealProfilePhoto(p));
    }
}
