using System.Net;
using System.Text;
using Amazon;
using Amazon.Runtime;
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
        var raw = (configuration["MEDIA_BUCKET"]
                ?? configuration["MEDIA_BUCKET_NAME"]
                ?? Environment.GetEnvironmentVariable("MEDIA_BUCKET")
                ?? Environment.GetEnvironmentVariable("MEDIA_BUCKET_NAME")
                ?? string.Empty)
            .Trim()
            .TrimStart('\uFEFF');
        _bucket = SanitizeDnsBucketName(raw);
        if (string.IsNullOrWhiteSpace(_bucket))
        {
            throw new InvalidOperationException("MEDIA_BUCKET is not configured");
        }

        if (!string.Equals(raw, _bucket, StringComparison.Ordinal))
        {
            _logger.LogWarning(
                "MEDIA_BUCKET name was sanitized (remove BOM/quotes/non-DNS chars). RawLen={RawLen} Sanitized={Bucket}",
                raw.Length,
                _bucket);
        }

        // Smart quotes / Unicode in Lambda env → stripped chars → wrong bucket → NoSuchBucket (looks "correct" in logs).
        if (_bucket.Length < raw.Length)
        {
            _logger.LogCritical(
                "MEDIA_BUCKET lost {Removed} character(s) during DNS sanitization (non a-z0-9.-). Sanitized={Bucket} Utf8Hex={Hex} — re-type MEDIA_BUCKET / MEDIA_BUCKET_NAME in Lambda (ASCII only, no smart quotes).",
                raw.Length - _bucket.Length,
                _bucket,
                Convert.ToHexString(Encoding.UTF8.GetBytes(raw)));
        }

        LogIfLikelyMediaBucketTypo(_bucket, _logger);
        _logger.LogInformation("S3 media operations use bucket {Bucket}", _bucket);
    }

    /// <summary>
    /// Production typo: <c>gettraindmat-media-bucket</c> (…n-d-m-a-t…) vs real <c>gettrainmate-media-bucket</c> (…n-m-a-t-e…).
    /// Same length (25); S3 returns NoSuchBucket for the misspelled name.
    /// </summary>
    private static void LogIfLikelyMediaBucketTypo(string bucket, ILogger logger)
    {
        const string expected = "gettrainmate-media-bucket";
        if (string.Equals(bucket, expected, StringComparison.OrdinalIgnoreCase))
            return;

        if (bucket.Contains("gettraindmat", StringComparison.OrdinalIgnoreCase)
            || (bucket.StartsWith("gettrain", StringComparison.OrdinalIgnoreCase)
                && bucket.Contains("dmat-media", StringComparison.OrdinalIgnoreCase)))
        {
            logger.LogCritical(
                "MEDIA_BUCKET_NAME is misspelled: got {Actual} — set Lambda env to {Expected} (AWS Console → Lambda → Configuration → Environment variables). No code or S3 redesign required.",
                bucket,
                expected);
        }
    }

    /// <summary>S3 bucket names are DNS labels: lowercase letters, digits, dot, hyphen.</summary>
    private static string SanitizeDnsBucketName(string raw)
    {
        var sb = new StringBuilder(raw.Length);
        foreach (var c in raw)
        {
            if (c is >= 'a' and <= 'z' or >= '0' and <= '9' or '.' or '-')
                sb.Append(c);
            else if (c is >= 'A' and <= 'Z')
                sb.Append(char.ToLowerInvariant(c));
        }

        return sb.ToString();
    }

    private static string NormalizeObjectKey(string key)
    {
        var t = (key ?? string.Empty).Trim().TrimStart('\uFEFF');
        return t.Length == 0 ? string.Empty : t;
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
        var k = TryGetObjectKeyFromCanonicalMediaUrl(url);
        if (string.IsNullOrEmpty(k)) return null;
        try
        {
            return GetPresignedDownloadUrl(k, expiresIn);
        }
        catch
        {
            return null;
        }
    }

    public async Task PutMediaObjectAsync(string key, Stream body, string contentType, CancellationToken cancellationToken = default)
    {
        var objectKey = NormalizeObjectKey(key);
        if (objectKey.Length == 0)
            throw new ArgumentException("Object key is required.", nameof(key));

        if (body == null)
            throw new ArgumentNullException(nameof(body));

        await using var ms = new MemoryStream();
        var buffer = new byte[65536];
        long total = 0;
        int read;
        while ((read = await body.ReadAsync(buffer.AsMemory(0, buffer.Length), cancellationToken).ConfigureAwait(false)) > 0)
        {
            total += read;
            if (total > MaxProfileImageBytes)
                throw new InvalidOperationException($"Image exceeds max size ({MaxProfileImageBytes} bytes).");
            ms.Write(buffer, 0, read);
        }

        if (total == 0)
            throw new InvalidOperationException("Empty upload body.");

        ms.Position = 0;
        var ct = string.IsNullOrWhiteSpace(contentType) ? "application/octet-stream" : contentType.Trim();
        var req = new PutObjectRequest
        {
            BucketName = _bucket,
            Key = objectKey,
            InputStream = ms,
            ContentType = ct,
        };

        await _s3.PutObjectAsync(req, cancellationToken).ConfigureAwait(false);
    }

    public async Task<MediaObjectRead?> TryReadMediaObjectAsync(string key, CancellationToken cancellationToken = default)
    {
        var objectKey = NormalizeObjectKey(key);
        if (objectKey.Length == 0) return null;

        try
        {
            return await ReadObjectBodyAsync(_s3, _bucket, objectKey, cancellationToken).ConfigureAwait(false);
        }
        catch (AmazonS3Exception ex) when (ex.StatusCode == HttpStatusCode.NotFound
                                          && string.Equals(ex.ErrorCode, "NoSuchKey", StringComparison.OrdinalIgnoreCase))
        {
            _logger.LogWarning(
                "S3 GetObject NoSuchKey Bucket={Bucket} Key={Key}",
                _bucket,
                KeyLog(objectKey));
            return null;
        }
        catch (AmazonS3Exception ex) when (ex.StatusCode == HttpStatusCode.NotFound
                                          && string.Equals(ex.ErrorCode, "NoSuchBucket", StringComparison.OrdinalIgnoreCase))
        {
            LogBucketDiagnostics(objectKey, ex);
            var located = await TryGetBucketLocationRegionNameAsync(cancellationToken).ConfigureAwait(false);
            if (!string.IsNullOrEmpty(located))
            {
                try
                {
                    using var regional = CreateRegionalS3Client(located);
                    var retry = await ReadObjectBodyAsync(regional, _bucket, objectKey, cancellationToken)
                        .ConfigureAwait(false);
                    _logger.LogInformation(
                        "S3 GetObject succeeded after GetBucketLocation retry Bucket={Bucket} region={Region}",
                        _bucket,
                        located);
                    return retry;
                }
                catch (Exception retryEx)
                {
                    _logger.LogWarning(
                        retryEx,
                        "S3 GetObject retry after location failed Bucket={Bucket} region={Region}",
                        _bucket,
                        located);
                }
            }

            try
            {
                using var pathStyle = CreateUsEast1PathStyleClient();
                var alt = await ReadObjectBodyAsync(pathStyle, _bucket, objectKey, cancellationToken)
                    .ConfigureAwait(false);
                _logger.LogInformation(
                    "S3 GetObject succeeded via us-east-1 path-style fallback Bucket={Bucket}",
                    _bucket);
                return alt;
            }
            catch (Exception pathEx)
            {
                _logger.LogWarning(
                    pathEx,
                    "S3 GetObject path-style fallback failed Bucket={Bucket} Key={Key}",
                    _bucket,
                    KeyLog(objectKey));
            }

            try
            {
                using var legacy = CreateUsEast1LegacyVirtualHostedClient();
                var legacyBody = await ReadObjectBodyAsync(legacy, _bucket, objectKey, cancellationToken)
                    .ConfigureAwait(false);
                _logger.LogInformation(
                    "S3 GetObject succeeded via us-east-1 legacy global endpoint fallback Bucket={Bucket}",
                    _bucket);
                return legacyBody;
            }
            catch (Exception legacyEx)
            {
                _logger.LogWarning(
                    legacyEx,
                    "S3 GetObject legacy global endpoint fallback failed Bucket={Bucket} Key={Key}",
                    _bucket,
                    KeyLog(objectKey));
            }

            return null;
        }
        catch (AmazonS3Exception ex)
        {
            _logger.LogWarning(
                ex,
                "S3 GetObject failed Bucket={Bucket} Key={Key} ErrorCode={ErrorCode} Status={Status}",
                _bucket,
                KeyLog(objectKey),
                ex.ErrorCode,
                ex.StatusCode);
            return null;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "S3 GetObject unexpected error Bucket={Bucket} Key={Key}", _bucket, KeyLog(objectKey));
            return null;
        }
    }

    private void LogBucketDiagnostics(string objectKey, AmazonS3Exception ex)
    {
        var prefix = new StringBuilder(Math.Min(12, _bucket.Length) * 5);
        for (var i = 0; i < Math.Min(12, _bucket.Length); i++)
        {
            if (i > 0) prefix.Append(',');
            prefix.AppendFormat("U+{0:X4}", (int)_bucket[i]);
        }

        _logger.LogWarning(
            "S3 GetObject NoSuchBucket Bucket={Bucket} bucketLen={BucketLen} firstChars={Chars} utf8Hex={Utf8Hex} Key={Key} Message={Message}",
            _bucket,
            _bucket.Length,
            prefix.ToString(),
            Convert.ToHexString(Encoding.UTF8.GetBytes(_bucket)),
            KeyLog(objectKey),
            ex.Message);
    }

    /// <summary>Maps S3 GetBucketLocation constraint to a region system name.</summary>
    private static string? MapLocationConstraintToRegion(string? location)
    {
        if (string.IsNullOrEmpty(location)) return "us-east-1";
        var u = location.Trim().ToUpperInvariant();
        if (u is "EU") return "eu-west-1";
        if (u is "US" or "US-EAST-1") return "us-east-1";
        return location.Trim().ToLowerInvariant();
    }

    private async Task<string?> TryGetBucketLocationRegionNameAsync(CancellationToken cancellationToken)
    {
        try
        {
            using var probe = CreateUsEast1ProbeClient();
            var resp = await probe
                .GetBucketLocationAsync(new GetBucketLocationRequest { BucketName = _bucket }, cancellationToken)
                .ConfigureAwait(false);
            var region = MapLocationConstraintToRegion(resp.Location);
            _logger.LogInformation(
                "S3 GetBucketLocation Bucket={Bucket} rawConstraint={Raw} mappedRegion={Region}",
                _bucket,
                resp.Location ?? "(null)",
                region ?? "(null)");
            return region;
        }
        catch (Exception ex)
        {
            if (ex is AmazonS3Exception s3e)
            {
                _logger.LogWarning(
                    ex,
                    "S3 GetBucketLocation failed Bucket={Bucket} ErrorCode={Code} Status={Status} (add s3:GetBucketLocation on bucket ARN if empty; NoSuchBucket here also means wrong bucket name)",
                    _bucket,
                    s3e.ErrorCode,
                    s3e.StatusCode);
            }
            else
            {
                _logger.LogWarning(ex, "S3 GetBucketLocation failed Bucket={Bucket}", _bucket);
            }

            return null;
        }
    }

    private static AmazonS3Client CreateUsEast1ProbeClient()
    {
        var cfg = new AmazonS3Config
        {
            RegionEndpoint = RegionEndpoint.USEast1,
            USEast1RegionalEndpointValue = S3UsEast1RegionalEndpointValue.Regional,
        };
        return new AmazonS3Client(cfg);
    }

    private static AmazonS3Client CreateUsEast1PathStyleClient()
    {
        var cfg = new AmazonS3Config
        {
            RegionEndpoint = RegionEndpoint.USEast1,
            USEast1RegionalEndpointValue = S3UsEast1RegionalEndpointValue.Regional,
            ForcePathStyle = true,
        };
        return new AmazonS3Client(cfg);
    }

    /// <summary>Legacy <c>s3.amazonaws.com</c> virtual-hosted style (rare; some misconfigurations only succeed here).</summary>
    private static AmazonS3Client CreateUsEast1LegacyVirtualHostedClient()
    {
        var cfg = new AmazonS3Config
        {
            RegionEndpoint = RegionEndpoint.USEast1,
            USEast1RegionalEndpointValue = S3UsEast1RegionalEndpointValue.Legacy,
        };
        return new AmazonS3Client(cfg);
    }

    private static AmazonS3Client CreateRegionalS3Client(string regionName)
    {
        var re = RegionEndpoint.GetBySystemName(regionName);
        var cfg = new AmazonS3Config { RegionEndpoint = re };
        if (string.Equals(regionName, "us-east-1", StringComparison.OrdinalIgnoreCase))
        {
            cfg.USEast1RegionalEndpointValue = S3UsEast1RegionalEndpointValue.Regional;
        }

        return new AmazonS3Client(cfg);
    }

    private static async Task<MediaObjectRead> ReadObjectBodyAsync(
        IAmazonS3 s3,
        string bucket,
        string objectKey,
        CancellationToken cancellationToken)
    {
        var request = new GetObjectRequest
        {
            BucketName = bucket,
            Key = objectKey,
        };

        using var resp = await s3.GetObjectAsync(request, cancellationToken).ConfigureAwait(false);
        if (resp.ContentLength > 0 && resp.ContentLength > MaxProfileImageBytes)
        {
            throw new InvalidOperationException($"S3 object too large: {resp.ContentLength}");
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
            throw new InvalidOperationException("S3 GetObject returned zero bytes");
        }

        var ct = string.IsNullOrWhiteSpace(resp.Headers.ContentType)
            ? "application/octet-stream"
            : resp.Headers.ContentType;
        return new MediaObjectRead { Body = body, ContentType = ct };
    }

    private static string KeyLog(string key) =>
        key.Length > 96 ? key[..96] + "…" : key;
}
