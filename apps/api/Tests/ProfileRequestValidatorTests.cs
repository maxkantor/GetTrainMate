using Xunit;
using GetTrainMate.Api.Models;
using GetTrainMate.Api.Validation;

namespace GetTrainMate.Api.Tests;

public class ProfileRequestValidatorTests
{
    [Fact]
    public void Validate_ValidRequest_ReturnsNoErrors()
    {
        var request = new UpdateProfileRequest
        {
            Name = "Jane Doe",
            Bio = new string('x', 25),
            SportTags = new List<string> { "Running" },
            Level = "intermediate",
            Mode = "TRAIN",
            AvailabilitySchedule = new List<AvailabilitySlot>
            {
                new() { Days = new List<string> { "Mon", "Wed" }, TimeStart = "17:00", TimeEnd = "21:00" }
            }
        };

        var errors = ProfileRequestValidator.Validate(request);

        Assert.Empty(errors);
    }

    [Fact]
    public void Validate_EmptyName_ReturnsNameError()
    {
        var request = new UpdateProfileRequest { Name = "   " };

        var errors = ProfileRequestValidator.Validate(request);

        Assert.True(errors.ContainsKey("name"));
        Assert.Contains("Display name is required", errors["name"]);
    }

    [Fact]
    public void Validate_ShortBio_ReturnsBioError()
    {
        var request = new UpdateProfileRequest { Bio = "too short" };

        var errors = ProfileRequestValidator.Validate(request);

        Assert.True(errors.ContainsKey("bio"));
        Assert.Contains("at least 20 characters", errors["bio"][0]);
    }

    [Fact]
    public void Validate_EmptySportTags_ReturnsSportTagsError()
    {
        var request = new UpdateProfileRequest { SportTags = new List<string>() };

        var errors = ProfileRequestValidator.Validate(request);

        Assert.True(errors.ContainsKey("sportTags"));
        Assert.Contains("at least one training type", errors["sportTags"][0]);
    }

    [Fact]
    public void Validate_InvalidLevel_ReturnsLevelError()
    {
        var request = new UpdateProfileRequest { Level = "expert" };

        var errors = ProfileRequestValidator.Validate(request);

        Assert.True(errors.ContainsKey("level"));
        Assert.Contains("beginner, intermediate, advanced, pro", errors["level"][0]);
    }

    [Fact]
    public void Validate_InvalidMode_ReturnsModeError()
    {
        var request = new UpdateProfileRequest { Mode = "INVALID" };

        var errors = ProfileRequestValidator.Validate(request);

        Assert.True(errors.ContainsKey("mode"));
    }

    [Fact]
    public void Validate_AvailabilitySlotWithNoDays_ReturnsSlotError()
    {
        var request = new UpdateProfileRequest
        {
            AvailabilitySchedule = new List<AvailabilitySlot>
            {
                new() { Days = new List<string>(), TimeStart = "17:00", TimeEnd = "21:00" }
            }
        };

        var errors = ProfileRequestValidator.Validate(request);

        Assert.True(errors.ContainsKey("availabilitySchedule[0].days"));
    }

    [Fact]
    public void Validate_PartialUpdate_NoErrorsWhenOptionalFieldsOmitted()
    {
        var request = new UpdateProfileRequest { PhotoKey = "profiles/123/photo.png" };

        var errors = ProfileRequestValidator.Validate(request);

        Assert.Empty(errors);
    }
}
