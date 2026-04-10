using Amazon.S3;
using Amazon.S3.Model;
using Microsoft.Extensions.Configuration;

namespace GetTrainMate.Api.Services;

public class S3StorageService : IStorageService
{
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

    public string? TryPresignCanonicalMediaUrl(string? url, TimeSpan expiresIn)
    {
        if (string.IsNullOrWhiteSpace(url)) return null;
        if (!Uri.TryCreate(url.Trim(), UriKind.Absolute, out var uri)) return null;
        if (!string.Equals(uri.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase)) return null;

        var host = uri.IdnHost;
        if (string.IsNullOrEmpty(host)) return null;

        // Virtual-hosted: {bucket}.s3.amazonaws.com or {bucket}.s3.<region>.amazonaws.com
        var bucketPrefix = $"{_bucket}.s3.";
        if (host.StartsWith(bucketPrefix, StringComparison.OrdinalIgnoreCase)
            && host.EndsWith(".amazonaws.com", StringComparison.OrdinalIgnoreCase))
        {
            var vhKey = Uri.UnescapeDataString(uri.AbsolutePath.TrimStart('/'));
            if (string.IsNullOrEmpty(vhKey)) return null;
            try
            {
                return GetPresignedDownloadUrl(vhKey, expiresIn);
            }
            catch
            {
                return null;
            }
        }

        // Path-style: https://s3.<region>.amazonaws.com/<bucket>/<key> (stored URLs differ from GetPublicUrl)
        if (host.StartsWith("s3.", StringComparison.OrdinalIgnoreCase)
            && host.EndsWith(".amazonaws.com", StringComparison.OrdinalIgnoreCase)
            && !host.StartsWith(bucketPrefix, StringComparison.OrdinalIgnoreCase))
        {
            var segments = uri.AbsolutePath.TrimStart('/').Split('/', StringSplitOptions.RemoveEmptyEntries);
            if (segments.Length >= 2
                && string.Equals(segments[0], _bucket, StringComparison.OrdinalIgnoreCase))
            {
                var pathKey = Uri.UnescapeDataString(string.Join("/", segments.Skip(1)));
                if (string.IsNullOrEmpty(pathKey)) return null;
                try
                {
                    return GetPresignedDownloadUrl(pathKey, expiresIn);
                }
                catch
                {
                    return null;
                }
            }
        }

        return null;
    }
}
