using GetTrainMate.Api.Models;

namespace GetTrainMate.Api.Services;

public interface IProfileService
{
    Task<UserProfile?> GetProfileAsync(string userId);
    Task<UserProfile> CreateProfileAsync(UserProfile profile);
    Task<UserProfile> UpdateProfileAsync(string userId, UpdateProfileRequest request);
    Task<bool> DeleteProfileAsync(string userId);
    Task<UserProfile> AddPhotoUrlAsync(string userId, string url);
}
