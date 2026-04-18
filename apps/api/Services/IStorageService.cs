using System;

namespace GetTrainMate.Api.Services;

/// <summary>In-bucket object bytes for admin CRM image streaming (img tags cannot send X-Admin-Token).</summary>
public sealed class MediaObjectRead
{
    public required byte[] Body { get; init; }
    public required string ContentType { get; init; }
}

public interface IStorageService
{
    string GetPresignedUploadUrl(string key, string contentType, TimeSpan expiresIn);
    string GetPublicUrl(string key);
    string GetPresignedDownloadUrl(string key, TimeSpan expiresIn);
    /// <summary>If <paramref name="url"/> is an https URL for this app&apos;s media bucket, return the object key; otherwise null (virtual-hosted or path-style).</summary>
    string? TryGetObjectKeyFromCanonicalMediaUrl(string? url);
    /// <summary>If <paramref name="url"/> is an https URL for this app&apos;s media bucket, return a presigned GET URL; otherwise null.</summary>
    string? TryPresignCanonicalMediaUrl(string? url, TimeSpan expiresIn);
    /// <summary>Read object from the configured media bucket (admin stream / diagnostics).</summary>
    Task<MediaObjectRead?> TryReadMediaObjectAsync(string key, CancellationToken cancellationToken = default);

    /// <summary>Write or replace an object in the media bucket (server-side; avoids browser→S3 CORS on presigned PUT).</summary>
    Task PutMediaObjectAsync(string key, Stream body, string contentType, CancellationToken cancellationToken = default);
}
