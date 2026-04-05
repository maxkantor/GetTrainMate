using GetTrainMate.Api.Models;

namespace GetTrainMate.Api.Services;

public interface IProfileService
{
    Task<UserProfile?> GetProfileAsync(string userId);
    Task<UserProfile> CreateProfileAsync(UserProfile profile);
    /// <summary>If the profile exists and <see cref="UserProfile.Email"/> is empty, set it and persist (idempotent).</summary>
    Task<UserProfile?> SetProfileEmailIfEmptyAsync(string userId, string email);
    Task<UserProfile> UpdateProfileAsync(string userId, UpdateProfileRequest request);
    Task<bool> DeleteProfileAsync(string userId);
    Task<UserProfile> AddPhotoUrlAsync(string userId, string url);
    Task<UserProfile?> PatchDiscoverLifecycleAsync(string userId, DiscoverLifecycleFlagsPatch patch);
}
