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

    /// <summary>Known production spellings (25 chars each) — wrong env/CDK name yields NoSuchBucket on the other.</summary>
    private static readonly string[] HardcodedMediaBucketFallbacks =
    [
        "gettrainmate-media-bucket",
        "gettraindmat-media-bucket",
    ];

    private readonly IAmazonS3 _s3;
    private readonly string _configuredBucket;
    private readonly ILogger<S3StorageService> _logger;

    private readonly object _bucketGate = new();

    /// <summary>Effective bucket after first successful read (may differ from env if env was wrong).</summary>
    private string _activeBucket;

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
        _configuredBucket = SanitizeDnsBucketName(raw);
        if (string.IsNullOrWhiteSpace(_configuredBucket))
        {
            throw new InvalidOperationException("MEDIA_BUCKET is not configured");
        }

        _activeBucket = _configuredBucket;

        if (!string.Equals(raw, _configuredBucket, StringComparison.Ordinal))
        {
            _logger.LogWarning(
                "MEDIA_BUCKET name was sanitized (remove BOM/quotes/non-DNS chars). RawLen={RawLen} Sanitized={Bucket}",
                raw.Length,
                _configuredBucket);
        }

        if (_configuredBucket.Length < raw.Length)
        {
            _logger.LogCritical(
                "MEDIA_BUCKET lost {Removed} character(s) during DNS sanitization (non a-z0-9.-). Sanitized={Bucket} Utf8Hex={Hex} — re-type MEDIA_BUCKET / MEDIA_BUCKET_NAME in Lambda (ASCII only, no smart quotes).",
                raw.Length - _configuredBucket.Length,
                _configuredBucket,
                Convert.ToHexString(Encoding.UTF8.GetBytes(raw)));
        }

        LogIfLikelyMediaBucketTypo(_configuredBucket, _logger);
        _logger.LogInformation("S3 media operations use configured bucket {Bucket}", _configuredBucket);
    }

    private string ActiveBucket
    {
        get
        {
            lock (_bucketGate)
                return _activeBucket;
        }
    }

    private void PinBucketIfNeeded(string winner)
    {
        if (string.IsNullOrEmpty(winner))
            return;
        lock (_bucketGate)
        {
            if (string.Equals(_activeBucket, winner, StringComparison.OrdinalIgnoreCase))
                return;
            _activeBucket = winner;
            if (!string.Equals(winner, _configuredBucket, StringComparison.OrdinalIgnoreCase))
            {
                _logger.LogCritical(
                    "S3 pinned media bucket to {Winner} (configured was {Configured}). Update Lambda MEDIA_BUCKET_NAME / CDK mediaBucketName so this auto-fix is not required.",
                    winner,
                    _configuredBucket);
            }
        }
    }

    private IEnumerable<string> DistinctBucketCandidates()
    {
        string active;
        lock (_bucketGate)
            active = _activeBucket;

        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var b in new[] { active, _configuredBucket }.Concat(HardcodedMediaBucketFallbacks))
        {
            if (string.IsNullOrWhiteSpace(b) || !seen.Add(b))
                continue;
            yield return b;
        }
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
            BucketName = ActiveBucket,
            Key = key,
            Verb = HttpVerb.PUT,
            Expires = DateTime.UtcNow.Add(expiresIn),
            ContentType = contentType
        };

        return _s3.GetPreSignedURL(request);
    }

    public string GetPublicUrl(string key)
    {
        return $"https://{ActiveBucket}.s3.amazonaws.com/{key}";
    }

    public string GetPresignedDownloadUrl(string key, TimeSpan expiresIn)
    {
        var request = new GetPreSignedUrlRequest
        {
            BucketName = ActiveBucket,
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

        foreach (var b in DistinctBucketCandidates())
        {
            var bucketPrefix = $"{b}.s3.";
            if (host.StartsWith(bucketPrefix, StringComparison.OrdinalIgnoreCase)
                && host.EndsWith(".amazonaws.com", StringComparison.OrdinalIgnoreCase))
            {
                var vhKey = Uri.UnescapeDataString(uri.AbsolutePath.TrimStart('/'));
                return string.IsNullOrEmpty(vhKey) ? null : vhKey;
            }
        }

        if (host.StartsWith("s3.", StringComparison.OrdinalIgnoreCase)
            && host.EndsWith(".amazonaws.com", StringComparison.OrdinalIgnoreCase))
        {
            var segments = uri.AbsolutePath.TrimStart('/').Split('/', StringSplitOptions.RemoveEmptyEntries);
            if (segments.Length >= 2)
            {
                foreach (var b in DistinctBucketCandidates())
                {
                    if (string.Equals(segments[0], b, StringComparison.OrdinalIgnoreCase))
                    {
                        var pathKey = Uri.UnescapeDataString(string.Join("/", segments.Skip(1)));
                        return string.IsNullOrEmpty(pathKey) ? null : pathKey;
                    }
                }
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

        AmazonS3Exception? last = null;
        foreach (var bucketName in DistinctBucketCandidates())
        {
            try
            {
                var req = new PutObjectRequest
                {
                    BucketName = bucketName,
                    Key = objectKey,
                    InputStream = ms,
                    ContentType = ct,
                };
                ms.Position = 0;
                await _s3.PutObjectAsync(req, cancellationToken).ConfigureAwait(false);
                PinBucketIfNeeded(bucketName);
                return;
            }
            catch (AmazonS3Exception ex) when (string.Equals(ex.ErrorCode, "NoSuchBucket", StringComparison.OrdinalIgnoreCase))
            {
                last = ex;
                ms.Position = 0;
            }
        }

        if (last != null)
            throw new InvalidOperationException($"S3 PutObject failed for all bucket candidates (last: {last.ErrorCode}).", last);
        throw new InvalidOperationException("S3 PutObject failed.");
    }

    public async Task<MediaObjectRead?> TryReadMediaObjectAsync(string key, CancellationToken cancellationToken = default)
    {
        var objectKey = NormalizeObjectKey(key);
        if (objectKey.Length == 0) return null;

        foreach (var bucketName in DistinctBucketCandidates())
        {
            try
            {
                var body = await ReadObjectBodyAsync(_s3, bucketName, objectKey, cancellationToken).ConfigureAwait(false);
                PinBucketIfNeeded(bucketName);
                return body;
            }
            catch (AmazonS3Exception ex) when (ex.StatusCode == HttpStatusCode.NotFound
                                              && string.Equals(ex.ErrorCode, "NoSuchKey", StringComparison.OrdinalIgnoreCase))
            {
                _logger.LogDebug(
                    "S3 GetObject NoSuchKey Bucket={Bucket} Key={Key}",
                    bucketName,
                    KeyLog(objectKey));
            }
            catch (AmazonS3Exception ex) when (ex.StatusCode == HttpStatusCode.NotFound
                                              && string.Equals(ex.ErrorCode, "NoSuchBucket", StringComparison.OrdinalIgnoreCase))
            {
                LogBucketDiagnostics(bucketName, objectKey, ex);
            }
            catch (AmazonS3Exception ex)
            {
                _logger.LogDebug(
                    ex,
                    "S3 GetObject candidate failed Bucket={Bucket} Key={Key} ErrorCode={ErrorCode} Status={Status}",
                    bucketName,
                    KeyLog(objectKey),
                    ex.ErrorCode,
                    ex.StatusCode);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "S3 GetObject unexpected error Bucket={Bucket} Key={Key}", bucketName, KeyLog(objectKey));
            }
        }

        return await TryReadWithEndpointFallbacksAsync(ActiveBucket, objectKey, cancellationToken).ConfigureAwait(false);
    }

    private async Task<MediaObjectRead?> TryReadWithEndpointFallbacksAsync(
        string bucketName,
        string objectKey,
        CancellationToken cancellationToken)
    {
        var located = await TryGetBucketLocationRegionNameAsync(bucketName, cancellationToken).ConfigureAwait(false);
        if (!string.IsNullOrEmpty(located))
        {
            try
            {
                using var regional = CreateRegionalS3Client(located);
                var retry = await ReadObjectBodyAsync(regional, bucketName, objectKey, cancellationToken)
                    .ConfigureAwait(false);
                _logger.LogInformation(
                    "S3 GetObject succeeded after GetBucketLocation retry Bucket={Bucket} region={Region}",
                    bucketName,
                    located);
                PinBucketIfNeeded(bucketName);
                return retry;
            }
            catch (Exception retryEx)
            {
                _logger.LogWarning(
                    retryEx,
                    "S3 GetObject retry after location failed Bucket={Bucket} region={Region}",
                    bucketName,
                    located);
            }
        }

        try
        {
            using var pathStyle = CreateUsEast1PathStyleClient();
            var alt = await ReadObjectBodyAsync(pathStyle, bucketName, objectKey, cancellationToken)
                .ConfigureAwait(false);
            _logger.LogInformation(
                "S3 GetObject succeeded via us-east-1 path-style fallback Bucket={Bucket}",
                bucketName);
            PinBucketIfNeeded(bucketName);
            return alt;
        }
        catch (Exception pathEx)
        {
            _logger.LogWarning(
                pathEx,
                "S3 GetObject path-style fallback failed Bucket={Bucket} Key={Key}",
                bucketName,
                KeyLog(objectKey));
        }

        try
        {
            using var legacy = CreateUsEast1LegacyVirtualHostedClient();
            var legacyBody = await ReadObjectBodyAsync(legacy, bucketName, objectKey, cancellationToken)
                .ConfigureAwait(false);
            _logger.LogInformation(
                "S3 GetObject succeeded via us-east-1 legacy global endpoint fallback Bucket={Bucket}",
                bucketName);
            PinBucketIfNeeded(bucketName);
            return legacyBody;
        }
        catch (Exception legacyEx)
        {
            _logger.LogWarning(
                legacyEx,
                "S3 GetObject legacy global endpoint fallback failed Bucket={Bucket} Key={Key}",
                bucketName,
                KeyLog(objectKey));
        }

        return null;
    }

    private void LogBucketDiagnostics(string bucketShown, string objectKey, AmazonS3Exception ex)
    {
        var prefix = new StringBuilder(Math.Min(12, bucketShown.Length) * 5);
        for (var i = 0; i < Math.Min(12, bucketShown.Length); i++)
        {
            if (i > 0) prefix.Append(',');
            prefix.AppendFormat("U+{0:X4}", (int)bucketShown[i]);
        }

        _logger.LogWarning(
            "S3 GetObject NoSuchBucket Bucket={Bucket} bucketLen={BucketLen} firstChars={Chars} utf8Hex={Utf8Hex} Key={Key} Message={Message}",
            bucketShown,
            bucketShown.Length,
            prefix.ToString(),
            Convert.ToHexString(Encoding.UTF8.GetBytes(bucketShown)),
            KeyLog(objectKey),
            ex.Message);
    }

    private static string? MapLocationConstraintToRegion(string? location)
    {
        if (string.IsNullOrEmpty(location)) return "us-east-1";
        var u = location.Trim().ToUpperInvariant();
        if (u is "EU") return "eu-west-1";
        if (u is "US" or "US-EAST-1") return "us-east-1";
        return location.Trim().ToLowerInvariant();
    }

    private async Task<string?> TryGetBucketLocationRegionNameAsync(string bucketName, CancellationToken cancellationToken)
    {
        try
        {
            using var probe = CreateUsEast1ProbeClient();
            var resp = await probe
                .GetBucketLocationAsync(new GetBucketLocationRequest { BucketName = bucketName }, cancellationToken)
                .ConfigureAwait(false);
            var region = MapLocationConstraintToRegion(resp.Location);
            _logger.LogInformation(
                "S3 GetBucketLocation Bucket={Bucket} rawConstraint={Raw} mappedRegion={Region}",
                bucketName,
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
                    bucketName,
                    s3e.ErrorCode,
                    s3e.StatusCode);
            }
            else
            {
                _logger.LogWarning(ex, "S3 GetBucketLocation failed Bucket={Bucket}", bucketName);
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
