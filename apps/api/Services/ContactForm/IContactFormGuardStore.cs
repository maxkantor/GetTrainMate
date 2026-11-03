namespace GetTrainMate.Api.Services.ContactForm;

public interface IContactFormGuardStore
{
    /// <summary>
    /// Atomically increment a rate-limit bucket. Returns false when over limit.
    /// </summary>
    Task<bool> TryIncrementRateAsync(string bucketKey, int limit, TimeSpan ttl, CancellationToken cancellationToken);

    /// <summary>
    /// Claim a short-lived content fingerprint. Returns false if already claimed (duplicate).
    /// </summary>
    Task<bool> TryClaimDedupeAsync(string fingerprint, TimeSpan ttl, CancellationToken cancellationToken);

    /// <summary>
    /// Claim a CAPTCHA / bot token for one-time use. Returns false on replay.
    /// </summary>
    Task<bool> TryClaimTokenAsync(string tokenHash, TimeSpan ttl, CancellationToken cancellationToken);
}
