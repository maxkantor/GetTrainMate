using System.Net;
using Amazon.S3;
using Amazon.S3.Model;
using Microsoft.Extensions.Configuration;

namespace GetTrainMate.Api.Services;

public class S3StorageService : IStorageService
{
    private const int MaxProfileImageBytes = 15 * 1024 * 1024;

    private readonly IAmazonS3 _s3;
    private readonly string _bucket;

    public S3StorageService(IAmazonS3 s3, IConfiguration configuration)
    {
        _s3 = s3;
        _bucket = configuration["MEDIA_BUCKET"] 
            ?? configuration["MEDIA_BUCKET_NAME"]
            ?? Environment.GetEnvironmentVariable("MEDIA_BUCKET") 
            ?? Environment.GetEnvironmentVariable("MEDIA_BUCKET_NAME") 
            ?? string.Empty;
        if (string.IsNullOrWhiteSpace(_bucket))
        {
            throw new InvalidOperationException("MEDIA_BUCKET is not configured");
        }
    }

    public string GetPresignedUploadUrl(string key, string contentType, TimeSpan expiresIn)
    {
        var request = new GetPreSignedUrlRequest
        {
            BucketName = _bucket,
            Key = key,
            Verb = HttpVerb.PUT,
            Expires = DateTime.UtcNow.Add(expiresIn),
            ContentType = contentType
        };

        return _s3.GetPreSignedURL(request);
    }

    public string GetPublicUrl(string key)
    {
        return $"https://{_bucket}.s3.amazonaws.com/{key}";
    }

    public string GetPresignedDownloadUrl(string key, TimeSpan expiresIn)
    {
        var request = new GetPreSignedUrlRequest
        {
            BucketName = _bucket,
            Key = key,
            Verb = HttpVerb.GET,
            Expires = DateTime.UtcNow.Add(expiresIn)
        };

        return _s3.GetPreSignedURL(request);
    }

    public string? TryGetObjectKeyFromCanonicalMediaUrl(string? url)
    {
        if (string.IsNullOrWhiteSpace(url)) return null;
        if (!Uri.TryCreate(url.Trim(), UriKind.Absolute, out var uri)) return null;
        if (!string.Equals(uri.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase)) return null;

        var host = uri.IdnHost;
        if (string.IsNullOrEmpty(host)) return null;

        var bucketPrefix = $"{_bucket}.s3.";
        if (host.StartsWith(bucketPrefix, StringComparison.OrdinalIgnoreCase)
            && host.EndsWith(".amazonaws.com", StringComparison.OrdinalIgnoreCase))
        {
            var vhKey = Uri.UnescapeDataString(uri.AbsolutePath.TrimStart('/'));
            return string.IsNullOrEmpty(vhKey) ? null : vhKey;
        }

        if (host.StartsWith("s3.", StringComparison.OrdinalIgnoreCase)
            && host.EndsWith(".amazonaws.com", StringComparison.OrdinalIgnoreCase)
            && !host.StartsWith(bucketPrefix, StringComparison.OrdinalIgnoreCase))
        {
            var segments = uri.AbsolutePath.TrimStart('/').Split('/', StringSplitOptions.RemoveEmptyEntries);
            if (segments.Length >= 2
                && string.Equals(segments[0], _bucket, StringComparison.OrdinalIgnoreCase))
            {
                var pathKey = Uri.UnescapeDataString(string.Join("/", segments.Skip(1)));
                return string.IsNullOrEmpty(pathKey) ? null : pathKey;
            }
        }

        return null;
    }

    public string? TryPresignCanonicalMediaUrl(string? url, TimeSpan expiresIn)
    {
        var key = TryGetObjectKeyFromCanonicalMediaUrl(url);
        if (string.IsNullOrEmpty(key)) return null;
        try
        {
            return GetPresignedDownloadUrl(key, expiresIn);
        }
        catch
        {
            return null;
        }
    }

    public async Task<MediaObjectRead?> TryReadMediaObjectAsync(string key, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(key)) return null;
        try
        {
            var request = new GetObjectRequest
            {
                BucketName = _bucket,
                Key = key,
            };

            using var resp = await _s3.GetObjectAsync(request, cancellationToken).ConfigureAwait(false);
            if (resp.ContentLength > 0 && resp.ContentLength > MaxProfileImageBytes)
                return null;

            await using var input = resp.ResponseStream;
            var capacity = resp.ContentLength > 0
                ? (int)Math.Min(resp.ContentLength, MaxProfileImageBytes)
                : 64 * 1024;
            await using var ms = new MemoryStream(capacity);
            var buffer = new byte[65536];
            long total = 0;
            while (total < MaxProfileImageBytes)
            {
                var toRead = (int)Math.Min(buffer.Length, MaxProfileImageBytes - total);
                var n = await input.ReadAsync(buffer.AsMemory(0, toRead), cancellationToken).ConfigureAwait(false);
                if (n == 0) break;
                ms.Write(buffer, 0, n);
                total += n;
            }

            var ct = string.IsNullOrWhiteSpace(resp.Headers.ContentType)
                ? "application/octet-stream"
                : resp.Headers.ContentType;
            return new MediaObjectRead { Body = ms.ToArray(), ContentType = ct };
        }
        catch (AmazonS3Exception ex) when (ex.StatusCode == HttpStatusCode.NotFound)
        {
            return null;
        }
        catch
        {
            return null;
        }
    }
}
