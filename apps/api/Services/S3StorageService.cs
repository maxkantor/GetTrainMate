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
        _bucket = configuration["MEDIA_BUCKET"] ?? Environment.GetEnvironmentVariable("MEDIA_BUCKET") ?? string.Empty;
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
}
