using Microsoft.Extensions.Hosting;

namespace GetTrainMate.Api.Services;

/// <summary>
/// Cold-start: resolve the real media bucket name in this AWS account (ListBuckets + GetBucketLocation probe)
/// when configured names return NoSuchBucket — fixes presigned landing URLs before first GetObject.
/// </summary>
public sealed class MediaBucketBootstrapHostedService : IHostedService
{
    private readonly IStorageService _storage;

    public MediaBucketBootstrapHostedService(IStorageService storage)
    {
        _storage = storage;
    }

    public Task StartAsync(CancellationToken cancellationToken)
    {
        if (_storage is S3StorageService s3)
            return s3.ProbeAndPinMediaBucketAsync(cancellationToken);
        return Task.CompletedTask;
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
