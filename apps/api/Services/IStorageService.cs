using System;

namespace GetTrainMate.Api.Services;

public interface IStorageService
{
    string GetPresignedUploadUrl(string key, string contentType, TimeSpan expiresIn);
    string GetPublicUrl(string key);
    string GetPresignedDownloadUrl(string key, TimeSpan expiresIn);
    /// <summary>If <paramref name="url"/> is an https URL for this app&apos;s media bucket, return the object key; otherwise null (virtual-hosted or path-style).</summary>
    string? TryGetObjectKeyFromCanonicalMediaUrl(string? url);
    /// <summary>If <paramref name="url"/> is an https URL for this app&apos;s media bucket, return a presigned GET URL; otherwise null.</summary>
    string? TryPresignCanonicalMediaUrl(string? url, TimeSpan expiresIn);
}
