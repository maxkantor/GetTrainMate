using System.Net;
using Amazon.S3;
using Amazon.S3.Model;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace GetTrainMate.Api.Services;

public class S3StorageService : IStorageService
{
    private const int MaxProfileImageBytes = 15 * 1024 * 1024;

    private readonly IAmazonS3 _s3;
    private readonly string _bucket;
    private readonly ILogger<S3StorageService> _logger;

    public S3StorageService(IAmazonS3 s3, IConfiguration configuration, ILogger<S3StorageService> logger)
    {
        _s3 = s3;
        _logger = logger;
        _bucket = configuration["MEDIA_BUCKET"] 
            ?? configuration["MEDIA_BUCKET_NAME"]
            ?? Environment.GetEnvironmentVariable("MEDIA_BUCKET") 
            ?? Environment.GetEnvironmentVariable("MEDIA_BUCKET_NAME") 
            ?? string.Empty;
        if (string.IsNullOrWhiteSpace(_bucket))
        {
            throw new InvalidOperationException("MEDIA_BUCKET is not configured");
        }

        _logger.LogInformation("S3 media operations use bucket {Bucket}", _bucket);
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
            {
                _logger.LogWarning(
                    "S3 GetObject rejected oversized object Bucket={Bucket} Key={Key} ContentLength={Len}",
                    _bucket,
                    KeyLog(key),
                    resp.ContentLength);
                return null;
            }

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

            var body = ms.ToArray();
            if (body.Length == 0)
            {
                _logger.LogWarning(
                    "S3 GetObject returned zero bytes Bucket={Bucket} Key={Key} DeclaredContentLength={Declared}",
                    _bucket,
                    KeyLog(key),
                    resp.ContentLength);
                return null;
            }

            var ct = string.IsNullOrWhiteSpace(resp.Headers.ContentType)
                ? "application/octet-stream"
                : resp.Headers.ContentType;
            return new MediaObjectRead { Body = body, ContentType = ct };
        }
        catch (AmazonS3Exception ex) when (ex.StatusCode == HttpStatusCode.NotFound)
        {
            _logger.LogWarning(
                "S3 GetObject 404 Bucket={Bucket} Key={Key} ErrorCode={ErrorCode} (NoSuchBucket=wrong S3 client region or bucket name; NoSuchKey=object missing)",
                _bucket,
                KeyLog(key),
                ex.ErrorCode);
            return null;
        }
        catch (AmazonS3Exception ex)
        {
            _logger.LogWarning(
                ex,
                "S3 GetObject failed Bucket={Bucket} Key={Key} ErrorCode={ErrorCode} Status={Status}",
                _bucket,
                KeyLog(key),
                ex.ErrorCode,
                ex.StatusCode);
            return null;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "S3 GetObject unexpected error Bucket={Bucket} Key={Key}", _bucket, KeyLog(key));
            return null;
        }
    }

    private static string KeyLog(string key) =>
        key.Length > 96 ? key[..96] + "…" : key;
}
