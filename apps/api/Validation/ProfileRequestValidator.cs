using GetTrainMate.Api.Models;

namespace GetTrainMate.Api.Validation;

/// <summary>Validates update profile request when fields are present; returns field-level errors. Empty = valid.</summary>
public static class ProfileRequestValidator
{
    private static readonly string[] ValidLevels = { "beginner", "intermediate", "advanced", "pro" };
    private static readonly string[] ValidModes = { "TRAIN", "VIBE", "DATE" };
    private static readonly string[] ValidChatNotificationFrequencies = { "realtime", "smart", "daily" };

    public static Dictionary<string, string[]> Validate(UpdateProfileRequest request)
    {
        var errors = new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase);

        if (request.Name != null)
        {
            if (string.IsNullOrWhiteSpace(request.Name))
                errors["name"] = new[] { "Display name is required" };
            else if (request.Name.Trim().Length > 200)
                errors["name"] = new[] { "Display name must be 200 characters or less" };
        }

        if (request.Bio != null)
        {
            if (request.Bio.Length < 20)
                errors["bio"] = new[] { "Bio must be at least 20 characters" };
            else if (request.Bio.Length > 500)
                errors["bio"] = new[] { "Bio must be 500 characters or less" };
        }

        if (request.SportTags != null && request.SportTags.Count == 0)
            errors["sportTags"] = new[] { "Select at least one training type" };

        if (request.Level != null && !ValidLevels.Contains(request.Level.Trim(), StringComparer.OrdinalIgnoreCase))
            errors["level"] = new[] { "Level must be one of: beginner, intermediate, advanced, pro" };

        if (request.Mode != null && !ValidModes.Contains(request.Mode.Trim(), StringComparer.OrdinalIgnoreCase))
            errors["mode"] = new[] { "Mode must be one of: TRAIN, VIBE, DATE" };

        if (request.ChatNotificationFrequency != null)
        {
            var f = request.ChatNotificationFrequency.Trim().ToLowerInvariant();
            if (!ValidChatNotificationFrequencies.Contains(f))
                errors["chatNotificationFrequency"] = new[] { "Must be one of: realtime, smart, daily" };
        }

        if (request.AvailabilitySchedule != null)
        {
            for (var i = 0; i < request.AvailabilitySchedule.Count; i++)
            {
                var slot = request.AvailabilitySchedule[i];
                var prefix = $"availabilitySchedule[{i}]";
                if (slot.Days == null || slot.Days.Count == 0)
                    errors[$"{prefix}.days"] = new[] { "At least one day is required" };
                if (string.IsNullOrWhiteSpace(slot.TimeStart))
                    errors[$"{prefix}.timeStart"] = new[] { "Start time is required" };
                if (string.IsNullOrWhiteSpace(slot.TimeEnd))
                    errors[$"{prefix}.timeEnd"] = new[] { "End time is required" };
            }
        }

        if (request.EventsCityInterest != null && request.EventsCityInterest.Length > 120)
            errors["eventsCityInterest"] = new[] { "City must be 120 characters or less" };

        if (request.EventsInterestTypes != null)
        {
            if (request.EventsInterestTypes.Count > 12)
                errors["eventsInterestTypes"] = new[] { "At most 12 interest tags" };
            else
            {
                for (var i = 0; i < request.EventsInterestTypes.Count; i++)
                {
                    var t = request.EventsInterestTypes[i];
                    if (t != null && t.Length > 80)
                        errors[$"eventsInterestTypes[{i}]"] = new[] { "Each tag must be 80 characters or less" };
                }
            }
        }

        return errors;
    }
}
