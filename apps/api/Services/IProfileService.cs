using Amazon.DynamoDBv2.Model;
using GetTrainMate.Api.Models;

namespace GetTrainMate.Api.Services;

public interface IProfileService
{
    /// <summary>Deserialize a DynamoDB item from Scan into <see cref="UserProfile"/> (for public preview, etc.).</summary>
    UserProfile? TryMapDynamoItemToProfile(Dictionary<string, AttributeValue>? item);

    Task<UserProfile?> GetProfileAsync(string userId);
    /// <summary>CRM/admin: load profile row even when <see cref="IsAccountClosedAsync"/> is true (app <see cref="GetProfileAsync"/> returns null).</summary>
    Task<UserProfile?> GetProfileForAdminAsync(string userId);
    Task<UserProfile> CreateProfileAsync(UserProfile profile);
    /// <summary>If the profile exists and <see cref="UserProfile.Email"/> is empty, set it and persist (idempotent).</summary>
    Task<UserProfile?> SetProfileEmailIfEmptyAsync(string userId, string email);
    Task<UserProfile> UpdateProfileAsync(string userId, UpdateProfileRequest request);
    Task<bool> DeleteProfileAsync(string userId);
    /// <summary>True when the profile row is marked <c>accountClosed</c> (soft-deleted CRM row or legacy tombstone).</summary>
    Task<bool> IsAccountClosedAsync(string userId);
    /// <summary>Persist CRM flag on a <b>closed</b> profile row (tombstone). Used with Cognito removal so the email can register again.</summary>
    Task<bool> SetEmailReleasedForSignupAsync(string userId, bool released);
    Task<UserProfile> AddPhotoUrlAsync(string userId, string url);
    Task<UserProfile?> PatchDiscoverLifecycleAsync(string userId, DiscoverLifecycleFlagsPatch patch);
}
