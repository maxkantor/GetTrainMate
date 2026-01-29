using System;

namespace GetTrainMate.Api.Services;

public interface IStorageService
{
    string GetPresignedUploadUrl(string key, string contentType, TimeSpan expiresIn);
    string GetPublicUrl(string key);
    string GetPresignedDownloadUrl(string key, TimeSpan expiresIn);
}
