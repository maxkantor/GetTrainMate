using System.Globalization;
using Amazon.DynamoDBv2;
using Amazon.DynamoDBv2.Model;
using GetTrainMate.Api.Constants;
using GetTrainMate.Api.Models;

namespace GetTrainMate.Api.Services;

/// <summary>
/// Pre-signup match preview: scans complete profiles, filters by sport/level/schedule overlap.
/// Never returns an empty deck; pads with curated demo profiles. Approximate distance on cards is illustrative only.
/// </summary>
public class LandingMatchPreviewService : ILandingMatchPreviewService
{
    private const int ScanPageSize = 100;
    /// <summary>Cap how many complete profiles we load per request (cost / latency).</summary>
    private const int MaxCompleteProfilesToEvaluate = 400;

    private readonly IAmazonDynamoDB _ddb;
    private readonly IProfileService _profiles;
    private readonly IStorageService _storage;
    private readonly string _tableName;
    private readonly string _matchesTable;
    private readonly ILogger<LandingMatchPreviewService> _logger;

    public LandingMatchPreviewService(
        IAmazonDynamoDB dynamoDb,
        IProfileService profiles,
        IStorageService storage,
        IConfiguration configuration,
        ILogger<LandingMatchPreviewService> logger)
    {
        _ddb = dynamoDb;
        _profiles = profiles;
        _storage = storage;
        var prefix = configuration["DYNAMODB_TABLE_PREFIX"] ?? "gettrainmate-";
        _tableName = configuration["DYNAMODB_TABLE_PROFILES"] ?? $"{prefix}profiles";
        _matchesTable = configuration["DYNAMODB_TABLE_MATCHES"] ?? $"{prefix}matches";
        _logger = logger;
    }

    public async Task<LandingMatchPreviewResponse> GetPreviewAsync(
        LandingMatchPreviewRequest request,
        CancellationToken cancellationToken = default)
    {
        var sportTag = (request.SportTag ?? "").Trim();
        var levelLabel = (request.Level ?? "").Trim();
        var timePref = (request.TimePref ?? "").Trim();

        var visitorLevel = NormalizeLevelFromLanding(levelLabel)
            ?? throw new ArgumentException("Invalid level", nameof(request));

        var visitorWindow = VisitorWindow.FromLandingTimePref(timePref);
        var timeDisplay = HumanizeTimePref(timePref);
        var levelTitle = CultureInfo.InvariantCulture.TextInfo.ToTitleCase(levelLabel.ToLowerInvariant());

        var completePool = await ScanCompleteProfilesAsync(cancellationToken).ConfigureAwait(false);

        var filteredMatches = completePool.Count == 0
            ? new List<UserProfile>()
            : completePool
                .Where(p => SportMatches(p, sportTag))
                .Where(p => LevelMatches(p, visitorLevel))
                .Where(p => ScheduleOverlaps(p, visitorWindow))
                .OrderByDescending(p => p.UpdatedAt)
                .Take(6)
                .ToList();

        var deck = new List<LandingMatchPreviewUserDto>();
        foreach (var p in filteredMatches)
            deck.Add(await MapToDtoAsync(p, timeDisplay, cancellationToken).ConfigureAwait(false));

        var n = filteredMatches.Count;
        var targetSize = n == 0 ? 5 : Math.Min(6, Math.Max(4, n));

        var templates = CuratedDemoTemplates(sportTag, levelTitle, timeDisplay);
        var takenNames = deck.Select(u => u.Name).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var ti = 0;
        while (deck.Count < targetSize && ti < templates.Count * 4)
        {
            var cand = templates[ti++ % templates.Count];
            if (takenNames.Contains(cand.Name))
                continue;
            deck.Add(cand);
            takenNames.Add(cand.Name);
        }

        if (deck.Count > 6)
            deck = deck.Take(6).ToList();

        var kind = n > 0 ? "real" : "demo";
        string? exampleLabel = n == 0
            ? "Preview profiles — create a free account to unlock real matches nearby."
            : null;

        return new LandingMatchPreviewResponse
        {
            Kind = kind,
            MatchCount = deck.Count,
            Users = deck,
            ExampleLabel = exampleLabel,
        };
    }

    public async Task<LandingShowcaseResponse> GetShowcaseAsync(CancellationToken cancellationToken = default)
    {
        // "Complete" scan matches match-preview rules (schedule, level, etc.). CRM test users often omit
        // availability or isComplete — Admin still shows their S3 photos. Merge dummy-user-* rows that
        // have resolvable photos so the public landing hero matches CRM.
        var completePool = await ScanCompleteProfilesAsync(cancellationToken).ConfigureAwait(false);
        var dummySupplement = await ScanDummyTestUsersForShowcaseAsync(cancellationToken).ConfigureAwait(false);
        var completeIds = completePool.Select(p => p.UserId).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var pool = completePool
            .Concat(dummySupplement.Where(p => !completeIds.Contains(p.UserId)))
            .ToList();

        _logger.LogInformation(
            "landing-showcase scan: table={Table} complete={Complete} dummyAccepted={Dummy} merged={Merged}",
            _tableName,
            completePool.Count,
            dummySupplement.Count,
            pool.Count);

        var withPhotos = pool
            .Select(p => (Profile: p, Url: ResolvePrimaryPhotoUrl(p)))
            .Where(x => !string.IsNullOrEmpty(x.Url))
            .OrderByDescending(x => x.Profile.UpdatedAt)
            .ToList();

        if (withPhotos.Count == 0)
        {
            if (pool.Count == 0)
            {
                _logger.LogWarning(
                    "landing-showcase empty: mergedPool=0 (no Dynamo rows passed filters). completeScan={Complete} dummyScanRows={Dummy}. Check profiles table and dummy-user-* data.",
                    completePool.Count,
                    dummySupplement.Count);
            }
            else
            {
                _logger.LogWarning(
                    "landing-showcase empty: merged={Merged} but zero presigned photo URLs. See per-profile diagnostics.",
                    pool.Count);
                foreach (var p in pool.Take(8))
                {
                    _logger.LogWarning(
                        "landing-showcase unresolved photo UserId={UserId} Detail={Detail}",
                        p.UserId,
                        SummarizeShowcasePhotoFailure(p));
                }
            }

            return new LandingShowcaseResponse { Kind = "empty" };
        }

        // Prefer CRM test accounts (dummy-user-*) for hero + swipe demo — same directory as Admin → Test Users.
        var distinctProfiles = OrderCrmDummyProfilesFirst(withPhotos.Select(x => x.Profile).DistinctBy(p => p.UserId))
            .ToList();

        const int deckTarget = 6;
        var deck = new List<LandingShowcaseDeckCardDto>();
        for (var i = 0; i < deckTarget && distinctProfiles.Count > 0; i++)
        {
            var p = distinctProfiles[i % distinctProfiles.Count];
            deck.Add(MapToDeckCard(p));
        }

        var activity = await BuildShowcaseActivityAsync(distinctProfiles, cancellationToken)
            .ConfigureAwait(false);

        _logger.LogInformation(
            "landing-showcase live: withPhotos={WithPhotos} deck={Deck} activity={Activity} sampleUserIds={Sample}",
            withPhotos.Count,
            deck.Count,
            activity.Count,
            string.Join(',', distinctProfiles.Take(5).Select(p => p.UserId)));

        return new LandingShowcaseResponse
        {
            Kind = "live",
            PremiumMatchPreviewUsd = 10m,
            Activity = activity,
            Deck = deck,
        };
    }

    private static bool IsCrmTestUser(string? userId) =>
        !string.IsNullOrEmpty(userId) && userId.StartsWith("dummy-user-", StringComparison.OrdinalIgnoreCase);

    /// <summary>dummy-user-2 sorts before dummy-user-10 (numeric tail).</summary>
    private static int DummyUserSortKey(string? userId)
    {
        if (!IsCrmTestUser(userId) || userId == null)
            return int.MaxValue;
        var tail = userId["dummy-user-".Length..];
        return int.TryParse(tail, System.Globalization.NumberStyles.Integer, CultureInfo.InvariantCulture, out var n)
            ? n
            : int.MaxValue - 1;
    }

    private static IEnumerable<UserProfile> OrderCrmDummyProfilesFirst(IEnumerable<UserProfile> profiles) =>
        profiles
            .OrderByDescending(p => IsCrmTestUser(p.UserId))
            .ThenBy(p => DummyUserSortKey(p.UserId))
            .ThenByDescending(p => p.UpdatedAt);

    private async Task<IReadOnlyList<LandingShowcaseActivityDto>> BuildShowcaseActivityAsync(
        IReadOnlyList<UserProfile> profilePool,
        CancellationToken ct)
    {
        var rows = await ScanRecentMutualMatchesAsync(ct, maxRows: 60).ConfigureAwait(false);
        var orderedRows = rows
            .OrderByDescending(x => IsCrmTestUser(x.Item1) && IsCrmTestUser(x.Item2))
            .ThenByDescending(x => IsCrmTestUser(x.Item1) || IsCrmTestUser(x.Item2))
            .ThenByDescending(x => x.Item3)
            .ToList();
        var activity = new List<LandingShowcaseActivityDto>();

        foreach (var (u1, u2, _) in orderedRows)
        {
            if (activity.Count >= 2)
                break;
            var a = await _profiles.GetProfileAsync(u1).ConfigureAwait(false);
            var b = await _profiles.GetProfileAsync(u2).ConfigureAwait(false);
            if (a == null || b == null || string.IsNullOrWhiteSpace(a.Name) || string.IsNullOrWhiteSpace(b.Name))
                continue;
            var urlA = ResolvePrimaryPhotoUrl(a);
            var urlB = ResolvePrimaryPhotoUrl(b);
            if (string.IsNullOrEmpty(urlA) && string.IsNullOrEmpty(urlB))
                continue;
            activity.Add(new LandingShowcaseActivityDto
            {
                Line = $"{FirstName(a.Name)} matched with {FirstName(b.Name)}",
                AvatarUrl = urlA ?? urlB,
                SecondaryAvatarUrl = !string.IsNullOrEmpty(urlA) && !string.IsNullOrEmpty(urlB) ? urlB : null,
            });
        }

        if (profilePool.Count > 0)
        {
            while (activity.Count < 3)
            {
                var p = profilePool[activity.Count % profilePool.Count];
                var url = ResolvePrimaryPhotoUrl(p);
                if (string.IsNullOrEmpty(url))
                    break;
                var line = activity.Count switch
                {
                    0 => $"{FirstName(p.Name)} found a training partner",
                    1 => $"{FirstName(p.Name)} matched recently",
                    _ => "New training partners every week",
                };
                activity.Add(new LandingShowcaseActivityDto { Line = line, AvatarUrl = url });
                if (profilePool.Count == 1 && activity.Count >= 2)
                    break;
            }
        }

        return activity.Count > 0 ? activity : Array.Empty<LandingShowcaseActivityDto>();
    }

    private async Task<List<(string U1, string U2, DateTime Updated)>> ScanRecentMutualMatchesAsync(CancellationToken ct, int maxRows)
    {
        var parsed = new List<(string, string, DateTime)>();
        Dictionary<string, AttributeValue>? startKey = null;
        var pages = 0;
        const int pageLimit = 80;

        while (!ct.IsCancellationRequested && pages < 8 && parsed.Count < maxRows)
        {
            var req = new ScanRequest
            {
                TableName = _matchesTable,
                Limit = pageLimit,
                ExclusiveStartKey = startKey,
                FilterExpression = "isMatched = :m",
                ExpressionAttributeValues = new Dictionary<string, AttributeValue>
                {
                    [":m"] = new AttributeValue { BOOL = true },
                },
            };

            var resp = await _ddb.ScanAsync(req, ct).ConfigureAwait(false);
            pages++;

            foreach (var item in resp.Items)
            {
                if (!item.TryGetValue("userId1", out var id1) || string.IsNullOrWhiteSpace(id1.S))
                    continue;
                if (!item.TryGetValue("userId2", out var id2) || string.IsNullOrWhiteSpace(id2.S))
                    continue;
                var updated = DateTime.UtcNow.AddDays(-7);
                if (item.TryGetValue("updatedAt", out var uAt) && !string.IsNullOrWhiteSpace(uAt.S))
                {
                    if (DateTime.TryParse(uAt.S, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out var dt))
                        updated = dt.ToUniversalTime();
                }
                parsed.Add((id1.S!, id2.S!, updated));
            }

            if (resp.LastEvaluatedKey == null || resp.LastEvaluatedKey.Count == 0)
                break;
            startKey = resp.LastEvaluatedKey;
        }

        return parsed
            .OrderByDescending(x => x.Item3)
            .Take(maxRows)
            .ToList();
    }

    private static string FirstName(string fullName)
    {
        var t = fullName.Trim();
        var sp = t.IndexOf(' ');
        return sp > 0 ? t[..sp] : t;
    }

    private LandingShowcaseDeckCardDto MapToDeckCard(UserProfile p)
    {
        var tags = p.SportTags
            .Where(t => !string.IsNullOrWhiteSpace(t))
            .Select(t => t.Trim().ToUpperInvariant())
            .Distinct()
            .ToList();
        foreach (var g in p.Goals.Where(x => !string.IsNullOrWhiteSpace(x)))
        {
            if (tags.Count >= 3)
                break;
            var up = g.Trim().ToUpperInvariant();
            if (!tags.Contains(up))
                tags.Add(up);
        }
        while (tags.Count < 3)
            tags.Add(tags.Count > 0 ? tags[0] : "TRAINING");

        var hash = StringComparer.Ordinal.GetHashCode(p.UserId);
        var matchPct = 85 + (Math.Abs(hash) % 10);

        return new LandingShowcaseDeckCardDto
        {
            Name = p.Name.Trim(),
            Age = ComputeAge(p.BirthDate),
            PhotoUrl = ResolvePrimaryPhotoUrl(p),
            Tags = tags,
            MatchPct = matchPct,
        };
    }

    /// <summary>
    /// Landing / hero must show the same media as Admin → Test Users. Never prefer seed Unsplash over
    /// <c>profiles/{userId}/…</c> S3 keys. User id in the path is matched case-insensitively (CRM vs Dynamo).
    /// </summary>
    private string? ResolvePrimaryPhotoUrl(UserProfile p)
    {
        var userId = (p.UserId ?? string.Empty).Trim();
        var urls = (p.PhotoUrls ?? new List<string>())
            .Where(u => !string.IsNullOrWhiteSpace(u))
            .Select(u => u.Trim())
            .Distinct(StringComparer.Ordinal)
            .ToList();

        if (urls.Count == 0)
            return ResolveShowcasePhotoFromLegacyKeys(p);

        var ordered = urls
            .OrderBy(u => LandingShowcasePhotoRank(u, userId))
            .ToList();

        foreach (var url in ordered)
        {
            var signed = _storage.TryPresignCanonicalMediaUrl(url, TimeSpan.FromHours(1));
            if (!string.IsNullOrEmpty(signed))
                return signed;
        }

        foreach (var url in ordered)
        {
            if (!TryGetProfilePhotoStorageKey(url, userId, out var key))
                continue;
            try
            {
                return _storage.GetPresignedDownloadUrl(key, TimeSpan.FromHours(1));
            }
            catch (Exception ex)
            {
                _logger.LogDebug(ex, "Presign showcase by object key for {UserId}", userId);
            }
        }

        // Do not pass through Unsplash / random avatars — wrong person vs CRM
        foreach (var url in ordered)
        {
            if (IsStockOrPlaceholderImageUrl(url))
                continue;
            if (ShouldPassThroughUnmodifiedHttpsImageUrl(url))
                return url;
        }

        return ResolveShowcasePhotoFromLegacyKeys(p);
    }

    private string? ResolveShowcasePhotoFromLegacyKeys(UserProfile p)
    {
        var keyForCover = p.PhotoKeys is { Count: > 0 } ? p.PhotoKeys[0] : p.PhotoKey;
        if (string.IsNullOrEmpty(keyForCover))
            return null;
        try
        {
            return _storage.GetPresignedDownloadUrl(keyForCover, TimeSpan.FromHours(1));
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Presign showcase legacy key for {UserId}", p.UserId);
            return null;
        }
    }

    /// <summary>
    /// Explains why <see cref="ResolvePrimaryPhotoUrl"/> returned null — log only, no secrets (no query strings / sigs).
    /// </summary>
    private string SummarizeShowcasePhotoFailure(UserProfile p)
    {
        var userId = (p.UserId ?? string.Empty).Trim();
        var urls = (p.PhotoUrls ?? new List<string>())
            .Where(u => !string.IsNullOrWhiteSpace(u))
            .Select(u => u.Trim())
            .Distinct(StringComparer.Ordinal)
            .ToList();

        if (urls.Count == 0)
        {
            var leg = p.PhotoKeys is { Count: > 0 } ? p.PhotoKeys[0] : p.PhotoKey;
            if (string.IsNullOrEmpty(leg))
                return "no_photoUrls_no_legacy_photoKey";
            try
            {
                _ = _storage.GetPresignedDownloadUrl(leg, TimeSpan.FromHours(1));
                return "legacy_key_presign_ok_but_resolve_failed_elsewhere";
            }
            catch (Exception ex)
            {
                return $"legacy_presign_{ex.GetType().Name}";
            }
        }

        if (urls.All(IsStockOrPlaceholderImageUrl))
            return $"only_stock_or_placeholder_urls_count={urls.Count}";

        var ordered = urls.OrderBy(u => LandingShowcasePhotoRank(u, userId)).ToList();
        var first = ordered[0];
        if (!Uri.TryCreate(first, UriKind.Absolute, out var fu))
            return "invalid_first_photo_url";

        var canon = _storage.TryPresignCanonicalMediaUrl(first, TimeSpan.FromHours(1));
        var pathMatch = TryGetProfilePhotoStorageKey(first, userId, out var pathKey);
        var pathPresign = "no_path";
        if (pathMatch && !string.IsNullOrEmpty(pathKey))
        {
            try
            {
                _ = _storage.GetPresignedDownloadUrl(pathKey, TimeSpan.FromHours(1));
                pathPresign = "path_presign_ok";
            }
            catch (Exception ex)
            {
                pathPresign = ex.GetType().Name;
            }
        }

        return
            $"urlCount={urls.Count};firstHost={fu.IdnHost};vhPresignOk={canon != null};profilesPathMatch={pathMatch};pathTry={pathPresign}";
    }

    private static int LandingShowcasePhotoRank(string url, string userId)
    {
        if (string.IsNullOrEmpty(userId)) return 50;
        if (TryGetProfilePhotoStorageKey(url, userId, out _))
            return 0;
        if (IsStockOrPlaceholderImageUrl(url))
            return 100;
        return 25;
    }

    /// <summary>
    /// HTTPS URL under <c>profiles/{userId}/…</c>; user id segment compared case-insensitively.
    /// </summary>
    private static bool TryGetProfilePhotoStorageKey(string url, string expectedUserId, out string key)
    {
        key = string.Empty;
        if (string.IsNullOrEmpty(expectedUserId)) return false;
        if (!Uri.TryCreate(url, UriKind.Absolute, out var u)) return false;
        if (!string.Equals(u.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase)) return false;
        var path = u.AbsolutePath.TrimStart('/');
        if (!path.StartsWith("profiles/", StringComparison.OrdinalIgnoreCase)) return false;
        var afterProfiles = path.AsSpan("profiles/".Length);
        var slash = afterProfiles.IndexOf('/');
        if (slash <= 0) return false;
        var idSeg = afterProfiles[..slash].ToString();
        if (!idSeg.Equals(expectedUserId, StringComparison.OrdinalIgnoreCase)) return false;
        key = path;
        return true;
    }

    private static bool IsStockOrPlaceholderImageUrl(string url)
    {
        if (!Uri.TryCreate(url, UriKind.Absolute, out var u)) return false;
        var h = u.IdnHost;
        return h.Contains("unsplash.com", StringComparison.OrdinalIgnoreCase)
               || h.Contains("picsum.photos", StringComparison.OrdinalIgnoreCase)
               || h.Contains("randomuser.me", StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// Public HTTPS images (stock fallbacks, CloudFront, etc.). Excludes *.amazonaws.com because those
    /// typically need a presigned URL when the bucket is not public.
    /// </summary>
    private static bool ShouldPassThroughUnmodifiedHttpsImageUrl(string url)
    {
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri))
            return false;
        if (!string.Equals(uri.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase))
            return false;
        var host = uri.IdnHost;
        if (string.IsNullOrEmpty(host))
            return false;
        if (host.EndsWith(".amazonaws.com", StringComparison.OrdinalIgnoreCase))
            return false;
        return true;
    }

    /// <summary>
    /// Admin CRM test accounts (dummy-user-*) may be incomplete vs match-preview rules but still have S3 photos.
    /// Scan them by id prefix so landing showcase can show the same faces as Test Users.
    /// </summary>
    private async Task<List<UserProfile>> ScanDummyTestUsersForShowcaseAsync(CancellationToken ct)
    {
        const string prefix = "dummy-user-";
        const int maxProfiles = 60;
        const int maxPages = 25;
        var result = new List<UserProfile>();
        Dictionary<string, AttributeValue>? startKey = null;
        var itemsSeen = 0;
        var skippedNoProfileOrName = 0;
        var skippedResolveFailed = 0;

        for (var page = 0; !ct.IsCancellationRequested && page < maxPages && result.Count < maxProfiles; page++)
        {
            var req = new ScanRequest
            {
                TableName = _tableName,
                Limit = ScanPageSize,
                ExclusiveStartKey = startKey,
                FilterExpression = "begins_with(userId, :p)",
                ExpressionAttributeValues = new Dictionary<string, AttributeValue>
                {
                    [":p"] = new AttributeValue { S = prefix },
                },
            };

            var resp = await _ddb.ScanAsync(req, ct).ConfigureAwait(false);

            foreach (var item in resp.Items)
            {
                itemsSeen++;
                var p = _profiles.TryMapDynamoItemToProfile(item);
                if (p == null || string.IsNullOrWhiteSpace(p.Name))
                {
                    skippedNoProfileOrName++;
                    continue;
                }

                if (string.IsNullOrEmpty(ResolvePrimaryPhotoUrl(p)))
                {
                    skippedResolveFailed++;
                    if (skippedResolveFailed <= 5)
                    {
                        _logger.LogWarning(
                            "landing-showcase dummy scan: skipped UserId={UserId} Detail={Detail}",
                            p.UserId,
                            SummarizeShowcasePhotoFailure(p));
                    }

                    continue;
                }

                result.Add(p);
                if (result.Count >= maxProfiles)
                    break;
            }

            if (resp.LastEvaluatedKey == null || resp.LastEvaluatedKey.Count == 0)
                break;

            startKey = resp.LastEvaluatedKey;
        }

        _logger.LogInformation(
            "landing-showcase dummy scan: accepted={Accepted} dynamoItemsSeen={Seen} skippedMapOrName={SkipName} skippedResolve={SkipRes} pagesCap={MaxPages}",
            result.Count,
            itemsSeen,
            skippedNoProfileOrName,
            skippedResolveFailed,
            maxPages);

        return result;
    }

    private async Task<List<UserProfile>> ScanCompleteProfilesAsync(CancellationToken ct)
    {
        var result = new List<UserProfile>();
        Dictionary<string, AttributeValue>? startKey = null;

        while (!ct.IsCancellationRequested && result.Count < MaxCompleteProfilesToEvaluate)
        {
            var req = new ScanRequest
            {
                TableName = _tableName,
                Limit = ScanPageSize,
                ExclusiveStartKey = startKey,
                FilterExpression = "isComplete = :ic",
                ExpressionAttributeValues = new Dictionary<string, AttributeValue>
                {
                    [":ic"] = new AttributeValue { BOOL = true },
                },
            };

            var resp = await _ddb.ScanAsync(req, ct).ConfigureAwait(false);

            foreach (var item in resp.Items)
            {
                var p = _profiles.TryMapDynamoItemToProfile(item);
                if (p == null || !p.IsComplete || string.IsNullOrWhiteSpace(p.Name))
                    continue;
                if (!p.SportTags.Any() || string.IsNullOrWhiteSpace(p.Level))
                    continue;
                if (!p.AvailabilitySchedule.Any())
                    continue;
                result.Add(p);
                if (result.Count >= MaxCompleteProfilesToEvaluate)
                    break;
            }

            if (resp.LastEvaluatedKey == null || resp.LastEvaluatedKey.Count == 0)
                break;

            startKey = resp.LastEvaluatedKey;
        }

        return result;
    }

    private static bool SportMatches(UserProfile p, string sportTag) =>
        p.SportTags.Any(t => string.Equals(t.Trim(), sportTag.Trim(), StringComparison.OrdinalIgnoreCase));

    private static bool LevelMatches(UserProfile p, string visitorNormalizedLevel)
    {
        var pl = NormalizeLevelFromProfile(p.Level);
        return pl != null && string.Equals(pl, visitorNormalizedLevel, StringComparison.OrdinalIgnoreCase);
    }

    private static bool ScheduleOverlaps(UserProfile p, VisitorWindow visitor)
    {
        foreach (var slot in p.AvailabilitySchedule)
        {
            if (slot.Days == null || !slot.Days.Any())
                continue;
            if (!TryParseHm(slot.TimeStart, out var sStart) || !TryParseHm(slot.TimeEnd, out var sEnd))
                continue;
            if (sEnd <= sStart)
                continue;

            foreach (var day in slot.Days)
            {
                var d = CanonicalDay(day);
                if (d == null || !visitor.Days.Contains(d))
                    continue;
                if (IntervalsOverlapMinutes(sStart, sEnd, visitor.StartMin, visitor.EndMin))
                    return true;
            }
        }

        return false;
    }

    private Task<LandingMatchPreviewUserDto> MapToDtoAsync(UserProfile p, string visitorTimeDisplay, CancellationToken ct)
    {
        var miles = StableMilesFromKey(p.UserId);
        return Task.FromResult(new LandingMatchPreviewUserDto
        {
            Name = p.Name.Trim(),
            Age = ComputeAge(p.BirthDate),
            TrainingSummary = BuildTrainingSummary(p),
            GoalLine = BuildGoalLine(p),
            PhotoUrl = ResolvePrimaryPhotoUrl(p),
            LevelLabel = TitleCaseLevelFromProfile(p.Level),
            TimePrefLabel = visitorTimeDisplay,
            DistanceLabel = $"~{miles} mi",
        });
    }

    private static string TitleCaseLevelFromProfile(string? level)
    {
        var n = NormalizeLevelFromProfile(level);
        if (n == null)
            return "Intermediate";
        return CultureInfo.InvariantCulture.TextInfo.ToTitleCase(n);
    }

    private static string HumanizeTimePref(string timePref)
    {
        var s = timePref.Trim();
        if (s.Contains("morning", StringComparison.OrdinalIgnoreCase))
            return "Morning";
        if (s.Contains("mid", StringComparison.OrdinalIgnoreCase))
            return "Midday";
        if (s.Contains("evening", StringComparison.OrdinalIgnoreCase))
            return "Evening";
        if (string.IsNullOrEmpty(s))
            return "Evening";
        return CultureInfo.InvariantCulture.TextInfo.ToTitleCase(s.ToLowerInvariant());
    }

    private static int StableMilesFromKey(string key)
    {
        unchecked
        {
            var h = 0;
            foreach (var c in key)
                h = (h * 31 + c) & 0x7FFFFFFF;
            return 4 + (h % 14);
        }
    }

    /// <summary>Curated demo athletes (synthetic). Names/photos align with product examples; not real users.</summary>
    private static IReadOnlyList<LandingMatchPreviewUserDto> CuratedDemoTemplates(string sportTag, string levelTitle, string timeDisplay)
    {
        var sport = string.IsNullOrWhiteSpace(sportTag) ? "Gym" : sportTag.Trim();

        LandingMatchPreviewUserDto Row(string name, string userIdKey, string training, string goal, int age) =>
            new()
            {
                Name = name,
                Age = age,
                TrainingSummary = training,
                GoalLine = goal,
                PhotoUrl = DummyProfilePhotos.PrimaryPhotoByUserId[userIdKey],
                LevelLabel = levelTitle,
                TimePrefLabel = timeDisplay,
                DistanceLabel = $"~{StableMilesFromKey(name)} mi",
            };

        return new[]
        {
            Row("Alex Drogba", "dummy-user-7", $"{sport} · Soccer · Conditioning", "Stay match-fit year round", 29),
            Row("Sarah Runner", "dummy-user-1", "Running · Yoga · Hiking", "Complete a sub-4 hour marathon", 28),
            Row("Maria Chen", "dummy-user-2", $"{sport} · Strength · Mobility", "Build consistent gym habits", 27),
            Row("Jordan Blake", "dummy-user-5", $"{sport} · HIIT · Core", "Improve work capacity for events", 26),
            Row("Ken Okada", "dummy-user-6", "Swimming · Core · Recovery", "Open-water confidence", 31),
            Row("Priya Singh", "dummy-user-3", "Yoga · Pilates · Breathwork", "Move pain-free every week", 30),
            Row("Taylor Brooks", "dummy-user-4", $"{sport} · Endurance", "Train smarter, not longer", 25),
            Row("Sam Rivera", "dummy-user-8", "Tennis · Agility · Footwork", "Sharpen match play", 24),
        };
    }

    private static string BuildTrainingSummary(UserProfile p)
    {
        var tags = p.SportTags.Where(t => !string.IsNullOrWhiteSpace(t)).Take(2).ToList();
        return tags.Count == 0 ? "Training" : string.Join(" · ", tags);
    }

    private static string BuildGoalLine(UserProfile p)
    {
        var g = p.Goals.FirstOrDefault(x => !string.IsNullOrWhiteSpace(x));
        if (!string.IsNullOrEmpty(g))
            return g.Trim();
        return p.SportTags.FirstOrDefault() ?? "Training";
    }

    private static int? ComputeAge(DateTime? birthDate)
    {
        if (!birthDate.HasValue)
            return null;
        var today = DateTime.UtcNow.Date;
        var bd = birthDate.Value.Date;
        var age = today.Year - bd.Year;
        if (bd.Date > today.AddYears(-age))
            age--;
        return age < 0 || age > 120 ? null : age;
    }

    private static string? NormalizeLevelFromLanding(string label) => label.Trim().ToLowerInvariant() switch
    {
        "beginner" => "beginner",
        "intermediate" => "intermediate",
        "advanced" => "advanced",
        _ => null,
    };

    private static string? NormalizeLevelFromProfile(string? level)
    {
        if (string.IsNullOrWhiteSpace(level))
            return null;
        return level.Trim().ToLowerInvariant() switch
        {
            "beginner" => "beginner",
            "intermediate" => "intermediate",
            "advanced" => "advanced",
            "pro" => "advanced", // treat pro as advanced bucket for landing filter
            _ => null,
        };
    }

    private static bool TryParseHm(string? time, out int minutesFromMidnight)
    {
        minutesFromMidnight = 0;
        if (string.IsNullOrWhiteSpace(time))
            return false;
        var parts = time.Trim().Split(':', StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length < 2)
            return false;
        if (!int.TryParse(parts[0], out var h) || !int.TryParse(parts[1], out var m))
            return false;
        if (h is < 0 or > 23 || m is < 0 or > 59)
            return false;
        minutesFromMidnight = h * 60 + m;
        return true;
    }

    private static bool IntervalsOverlapMinutes(int aStart, int aEnd, int bStart, int bEnd) =>
        aStart < bEnd && bStart < aEnd;

    private static string? CanonicalDay(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
            return null;
        var s = raw.Trim();
        var head = s.Length >= 3 ? s[..3] : s;
        if (head.Equals("Mon", StringComparison.OrdinalIgnoreCase) || s.Equals("Monday", StringComparison.OrdinalIgnoreCase))
            return "Mon";
        if (head.Equals("Tue", StringComparison.OrdinalIgnoreCase) || s.Equals("Tuesday", StringComparison.OrdinalIgnoreCase))
            return "Tue";
        if (head.Equals("Wed", StringComparison.OrdinalIgnoreCase) || s.Equals("Wednesday", StringComparison.OrdinalIgnoreCase))
            return "Wed";
        if (head.Equals("Thu", StringComparison.OrdinalIgnoreCase) || s.Equals("Thursday", StringComparison.OrdinalIgnoreCase))
            return "Thu";
        if (head.Equals("Fri", StringComparison.OrdinalIgnoreCase) || s.Equals("Friday", StringComparison.OrdinalIgnoreCase))
            return "Fri";
        if (head.Equals("Sat", StringComparison.OrdinalIgnoreCase) || s.Equals("Saturday", StringComparison.OrdinalIgnoreCase))
            return "Sat";
        if (head.Equals("Sun", StringComparison.OrdinalIgnoreCase) || s.Equals("Sunday", StringComparison.OrdinalIgnoreCase))
            return "Sun";
        return null;
    }

    private sealed class VisitorWindow
    {
        public HashSet<string> Days { get; } = new(StringComparer.OrdinalIgnoreCase);
        public int StartMin { get; }
        public int EndMin { get; }

        private VisitorWindow(int startMin, int endMin, IEnumerable<string> days)
        {
            StartMin = startMin;
            EndMin = endMin;
            foreach (var d in days)
                Days.Add(d);
        }

        public static VisitorWindow FromLandingTimePref(string timePref)
        {
            // Aligned with apps/web/src/utils/landingPrefs.ts timePrefToAvailabilitySlot
            if (timePref.Contains("Morning", StringComparison.OrdinalIgnoreCase))
            {
                return new VisitorWindow(
                    5 * 60,
                    9 * 60,
                    new[] { "Mon", "Tue", "Wed", "Thu", "Fri" });
            }

            if (timePref.Contains("Mid", StringComparison.OrdinalIgnoreCase))
            {
                return new VisitorWindow(
                    12 * 60,
                    14 * 60,
                    new[] { "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun" });
            }

            if (timePref.Contains("Evening", StringComparison.OrdinalIgnoreCase))
            {
                return new VisitorWindow(
                    17 * 60,
                    21 * 60,
                    new[] { "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun" });
            }

            throw new ArgumentException("Unknown time preference.", nameof(timePref));
        }
    }
}
