using Amazon.DynamoDBv2;
using Amazon.DynamoDBv2.DocumentModel;
using Amazon.DynamoDBv2.Model;
using GetTrainMate.Api.Models;
using System.Globalization;
using System.Linq;
using System.Text.Json;

namespace GetTrainMate.Api.Services;

public class MatchService : IMatchService
{
    private readonly IAmazonDynamoDB _dynamoDb;
    private readonly IProfileService _profileService;
    private readonly IStorageService _storageService;
    private readonly ICreditsService _creditsService;
    private readonly string _matchesTable;
    private readonly string _profilesTable;
    private readonly string _discoverPassesTable;
    private readonly ILogger<MatchService> _logger;

    // Scoring weights for compatibility
    private const int SportsMatchWeight = 30;
    private const int ScheduleMatchWeight = 25;
    private const int LevelMatchWeight = 20;
    private const int DistanceWeight = 15;
    private const int ModeMatchWeight = 10;
    private const string AdminControlsPartitionKey = "__discover_controls__";
    private const string AdminControlsSortKey = "admin";
    private const string AdminProfileStatusPartitionKey = "__discover_profile_status__";
    /// <summary>Sent / Skipped review lists: most recent N only (UI + payload size).</summary>
    private const int RelationshipListLimit = 30;

    public MatchService(
        IAmazonDynamoDB dynamoDb,
        IProfileService profileService,
        IStorageService storageService,
        ICreditsService creditsService,
        IConfiguration configuration,
        ILogger<MatchService> logger)
    {
        _dynamoDb = dynamoDb;
        _profileService = profileService;
        _storageService = storageService;
        _creditsService = creditsService;
        var prefix = configuration["DYNAMODB_TABLE_PREFIX"] ?? "gettrainmate-";
        _matchesTable = configuration["DYNAMODB_TABLE_MATCHES"] ?? $"{prefix}matches";
        _profilesTable = configuration["DYNAMODB_TABLE_PROFILES"] ?? $"{prefix}profiles";
        _discoverPassesTable = configuration["DYNAMODB_TABLE_DISCOVER_PASSES"] ?? $"{prefix}discover-passes";
        _logger = logger;
    }

    /// <summary>
    /// Seeds demo profiles so Discover is not empty. These are fake users (e.g. "Alex Hyrox")
    /// for development and first-time experience. Order in the feed depends on DB/scan.
    /// </summary>
    public async Task<int> SeedDemoProfilesAsync()
    {
        // Only 3 seed profiles with real photos so real user-created profiles (Max, Alex, Sasha, etc.) dominate the feed
        var dummyUsers = new[]
        {
            new { UserId = "dummy-user-1", Name = "Sarah Runner", City = "San Francisco", Bio = "Marathon runner looking for training partners. Love long runs on weekends!", SportTags = new[] { "Running", "Yoga", "Hiking" }, Level = "intermediate", Goals = new[] { "Complete a sub-4 hour marathon" }, AvailabilitySchedule = new[] { new AvailabilitySlot { Days = new List<string> { "Mon", "Wed", "Fri" }, TimeStart = "18:00", TimeEnd = "20:00" } }, Mode = "TRAIN", PhotoUrl = "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=600&q=80" },
            new { UserId = "dummy-user-2", Name = "Mike Cyclist", City = "San Francisco", Bio = "Cycling enthusiast. Looking for weekend ride buddies.", SportTags = new[] { "Cycling", "Gym", "CrossFit" }, Level = "advanced", Goals = new[] { "Complete a century ride" }, AvailabilitySchedule = new[] { new AvailabilitySlot { Days = new List<string> { "Sat", "Sun" }, TimeStart = "08:00", TimeEnd = "12:00" } }, Mode = "VIBE", PhotoUrl = "https://images.unsplash.com/photo-1568602471122-7832951cc4c5?w=600&q=80" },
            new { UserId = "dummy-user-3", Name = "Emma Yoga", City = "San Francisco", Bio = "Yoga instructor and fitness enthusiast. Love morning yoga sessions!", SportTags = new[] { "Yoga", "Pilates", "Meditation" }, Level = "pro", Goals = new[] { "Build a yoga community" }, AvailabilitySchedule = new[] { new AvailabilitySlot { Days = new List<string> { "Mon", "Wed", "Fri" }, TimeStart = "06:00", TimeEnd = "08:00" } }, Mode = "VIBE", PhotoUrl = "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=600&q=80" },
        };

        var created = 0;
        foreach (var user in dummyUsers)
        {
            try
            {
                var existing = await _profileService.GetProfileAsync(user.UserId);
                if (existing != null) continue;

                var profile = new UserProfile
                {
                    UserId = user.UserId,
                    Email = $"{user.UserId}@test.com",
                    Name = user.Name,
                    City = user.City,
                    Bio = user.Bio,
                    SportTags = user.SportTags.ToList(),
                    Level = user.Level,
                    Goals = user.Goals.ToList(),
                    AvailabilitySchedule = user.AvailabilitySchedule.ToList(),
                    Mode = user.Mode,
                    Modes = new List<string> { user.Mode },
                    PhotoUrls = !string.IsNullOrEmpty(user.PhotoUrl) ? new List<string> { user.PhotoUrl } : new List<string>(),
                    IsComplete = true,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow,
                };
                await _profileService.CreateProfileAsync(profile);
                created++;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Seed demo: could not create {UserId}", user.UserId);
            }
        }
        if (created > 0)
            _logger.LogInformation("Seeded {Count} demo profiles for discovery", created);
        return created;
    }

    public async Task<CompatibilityInfo?> GetCompatibilityAsync(string userId, string targetUserId)
    {
        if (string.IsNullOrEmpty(targetUserId)) return null;
        var userProfile = await _profileService.GetProfileAsync(userId);
        var targetProfile = await _profileService.GetProfileAsync(targetUserId);
        if (userProfile == null || targetProfile == null) return null;
        var score = CalculateCompatibilityScore(userProfile, targetProfile);
        var commonSports = GetCommonSports(userProfile.SportTags, targetProfile.SportTags);
        return new CompatibilityInfo
        {
            CompatibilityScore = score,
            CommonSports = commonSports,
            Level = targetProfile.Level,
            City = targetProfile.City,
            Mode = targetProfile.Mode,
            Modes = ProfileModes.GetNormalizedModes(targetProfile)
        };
    }

    public async Task<List<MatchFeedItem>> GetDiscoveryFeedAsync(string userId, int limit = 20, bool ignoreSkippedForAdmin = false)
    {
        try
        {
            var userProfile = await _profileService.GetProfileAsync(userId);
            // Return other profiles even when current user has no profile (e.g. new account, eventual consistency)

            var table = Table.LoadTable(_dynamoDb, _profilesTable);
            var scanFilter = new ScanFilter();
            
            // Get all profiles (in production, use GSI for better performance)
            var search = table.Scan(scanFilter);
            var allProfiles = new List<Document>();
            
            do
            {
                var batch = await search.GetNextSetAsync();
                allProfiles.AddRange(batch);
            } while (!search.IsDone);

            var feedItems = new List<MatchFeedItem>();
            var passedTargetIds = await GetPassedTargetUserIdsAsync(userId);
            var excludedLikedOrMatched = await GetUserIdsExcludedFromDiscoverByMatchesAsync(userId);
            var adminProfileStatusMap = await GetAdminProfileStatusMapAsync();

            var recycleSkipped = userProfile?.DiscoverCanRecycleSkippedProfiles == true;
            var replayQueue = userProfile?.DiscoverCanReplayDiscoverQueue == true;
            var showSkippedAgain = ignoreSkippedForAdmin || recycleSkipped || replayQueue;

            foreach (var doc in allProfiles)
            {
                if (!doc.ContainsKey("userId"))
                {
                    _logger.LogDebug("Discovery feed: skipping profile document without userId");
                    continue;
                }
                var profileUserId = doc["userId"].AsString();
                if (string.IsNullOrEmpty(profileUserId))
                    continue;
                
                // Skip only self so Discover shows all other profiles (Max sees Alex, Sasha, etc.)
                if (profileUserId == userId)
                    continue;

                if (excludedLikedOrMatched.Contains(profileUserId))
                    continue;

                var wasPassed = passedTargetIds.Contains(profileUserId);
                if (wasPassed && !showSkippedAgain)
                    continue;

                var seenBefore = wasPassed && showSkippedAgain;

                if (adminProfileStatusMap.TryGetValue(profileUserId, out var profileStatus))
                {
                    if (string.Equals(profileStatus, "hidden", StringComparison.OrdinalIgnoreCase))
                        continue;
                    if (!ignoreSkippedForAdmin && string.Equals(profileStatus, "skipped", StringComparison.OrdinalIgnoreCase))
                        continue;
                }

                UserProfile targetProfile;
                try
                {
                    targetProfile = DocumentToProfile(doc);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Discovery feed: skipping profile document for userId {UserId}", profileUserId);
                    continue;
                }

                if (userProfile != null && !ProfileModes.HasIntentOverlap(userProfile, targetProfile))
                    continue;

                var compatibilityScore = userProfile != null
                    ? CalculateCompatibilityScore(userProfile, targetProfile)
                    : 50;

                var distanceKm = userProfile != null
                    ? CalculateDistance(userProfile.Latitude, userProfile.Longitude, targetProfile.Latitude, targetProfile.Longitude)
                    : double.MaxValue;
                var intentTier = userProfile != null && ProfileModes.IsExactIntentAlignment(userProfile, targetProfile)
                    ? "exact"
                    : "overlap";
                var (previewReasons, lockedReasons) = userProfile != null
                    ? BuildMatchInsightReasons(userProfile, targetProfile, distanceKm)
                    : (new List<string>(), new List<string> { "🔒 Strength compatibility", "🔒 Training rhythm", "🔒 Personality fit" });

                var photoUrls = targetProfile.PhotoUrls ?? new List<string>();
                if (photoUrls.Count == 0)
                {
                    var keyForCover = targetProfile.PhotoKeys != null && targetProfile.PhotoKeys.Count > 0
                        ? targetProfile.PhotoKeys[0]
                        : targetProfile.PhotoKey;
                    if (!string.IsNullOrEmpty(keyForCover))
                    {
                        try
                        {
                            var signedUrl = _storageService.GetPresignedDownloadUrl(keyForCover, TimeSpan.FromHours(1));
                            photoUrls = new List<string> { signedUrl };
                        }
                        catch (Exception ex)
                        {
                            _logger.LogWarning(ex, "Could not generate photo URL for user {UserId}", targetProfile.UserId);
                        }
                    }
                }

                feedItems.Add(new MatchFeedItem
                {
                    UserId = targetProfile.UserId,
                    Name = targetProfile.Name ?? "User",
                    City = targetProfile.City,
                    Bio = targetProfile.Bio,
                    SportTags = targetProfile.SportTags,
                    Level = targetProfile.Level,
                    PhotoUrls = photoUrls,
                    CompatibilityScore = compatibilityScore,
                    CommonSports = userProfile != null ? GetCommonSports(userProfile.SportTags, targetProfile.SportTags) : new List<string>(),
                    Mode = targetProfile.Mode,
                    Modes = ProfileModes.GetNormalizedModes(targetProfile),
                    IntentMatchTier = intentTier,
                    MatchPreviewReasons = previewReasons,
                    LockedInsightReasons = lockedReasons,
                    SeenBefore = seenBefore
                });
            }

            return feedItems
                .OrderByDescending(x => x.IntentMatchTier == "exact" ? 1 : 0)
                .ThenByDescending(x => x.CompatibilityScore)
                .Take(limit)
                .ToList();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting discovery feed for user {UserId}", userId);
            throw;
        }
    }

    /// <summary>
    /// Records a one-sided like on the match row. <see cref="Match.IsMatched"/> is true only when both
    /// <see cref="Match.User1Liked"/> and <see cref="Match.User2Liked"/> are true (mutual interest).
    /// </summary>
    public async Task<MatchResponse> LikeUserAsync(string userId, string targetUserId)
    {
        await _creditsService.ChargeLikeForDiscoverAsync(userId, targetUserId);

        try
        {
            var existingMatch = await GetMatchAsync(userId, targetUserId);
            var userProfile = await _profileService.GetProfileAsync(userId);
            var targetProfile = await _profileService.GetProfileAsync(targetUserId);

            if (userProfile == null || targetProfile == null)
                throw new Exception("User or target profile not found");

            var match = existingMatch ?? new Match
            {
                UserId1 = userId,
                UserId2 = targetUserId,
                CompatibilityScore = CalculateCompatibilityScore(userProfile, targetProfile),
                CommonSports = GetCommonSports(userProfile.SportTags, targetProfile.SportTags),
                CommonSchedule = GetCommonScheduleSlots(userProfile.AvailabilitySchedule, targetProfile.AvailabilitySchedule)
            };

            // Set the liker's side (who is liking: userId)
            if (match.UserId1 == userId)
                match.User1Liked = true;
            else
                match.User2Liked = true;
            match.UpdatedAt = DateTime.UtcNow;
            match.IsMatched = match.User1Liked && match.User2Liked;

            await SaveMatchAsync(match);

            return new MatchResponse
            {
                MatchId = match.MatchId,
                CompatibilityScore = match.CompatibilityScore,
                IsMatched = match.IsMatched
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error liking user {TargetUserId}", targetUserId);
            throw;
        }
    }

    public async Task<MatchResponse> PassUserAsync(string userId, string targetUserId)
    {
        try
        {
            if (!string.IsNullOrEmpty(targetUserId))
                await RecordDiscoverPassAsync(userId, targetUserId);

            var existingMatch = await GetMatchAsync(userId, targetUserId);
            
            if (existingMatch != null)
            {
                var table = Table.LoadTable(_dynamoDb, _matchesTable);
                await table.DeleteItemAsync(existingMatch.MatchId);
            }

            return new MatchResponse
            {
                MatchId = "",
                CompatibilityScore = 0,
                IsMatched = false
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error passing user {TargetUserId}", targetUserId);
            throw;
        }
    }

    private async Task RecordDiscoverPassAsync(string userId, string targetUserId)
    {
        try
        {
            var table = Table.LoadTable(_dynamoDb, _discoverPassesTable);
            var doc = new Document
            {
                ["userId"] = userId,
                ["targetUserId"] = targetUserId,
                ["createdAt"] = DateTime.UtcNow.ToString("O", CultureInfo.InvariantCulture),
                ["updatedAt"] = DateTime.UtcNow.ToString("O", CultureInfo.InvariantCulture),
                ["isSkipped"] = true,
                ["skippedAt"] = DateTime.UtcNow.ToString("O", CultureInfo.InvariantCulture),
                ["skippedByUserId"] = userId,
                ["restored"] = false,
                ["status"] = "skipped"
            };
            await table.PutItemAsync(doc);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to record discover pass for {TargetUserId}", targetUserId);
            throw;
        }
    }

    private async Task<HashSet<string>> GetPassedTargetUserIdsAsync(string userId)
    {
        var result = new HashSet<string>(StringComparer.Ordinal);
        Dictionary<string, AttributeValue>? startKey = null;
        do
        {
            var query = new QueryRequest
            {
                TableName = _discoverPassesTable,
                KeyConditionExpression = "userId = :u",
                ExpressionAttributeValues = new Dictionary<string, AttributeValue>
                {
                    { ":u", new AttributeValue { S = userId } }
                },
                ExclusiveStartKey = startKey
            };
            var response = await _dynamoDb.QueryAsync(query);
            foreach (var item in response.Items)
            {
                if (!item.TryGetValue("targetUserId", out var tid) || tid.S == null)
                    continue;
                var isSkipped = !item.TryGetValue("isSkipped", out var skippedVal) || skippedVal.BOOL;
                var restored = item.TryGetValue("restored", out var restoredVal) && restoredVal.BOOL;
                var status = item.TryGetValue("status", out var statusVal) ? statusVal.S : "skipped";
                if (isSkipped && !restored && !string.Equals(status, "active", StringComparison.OrdinalIgnoreCase))
                    result.Add(tid.S);
            }
            startKey = response.LastEvaluatedKey is { Count: > 0 } ? response.LastEvaluatedKey : null;
        } while (startKey != null);

        return result;
    }

    public async Task<bool> UndoPassAsync(string userId, string targetUserId)
    {
        var viewer = await _profileService.GetProfileAsync(userId);
        if (viewer != null && !viewer.DiscoverCanRewindLastSkip)
            return false;

        var table = Table.LoadTable(_dynamoDb, _discoverPassesTable);
        var document = await table.GetItemAsync(userId, targetUserId);
        if (document == null) return false;

        document["restored"] = true;
        document["isSkipped"] = false;
        document["status"] = "active";
        document["restoredAt"] = DateTime.UtcNow.ToString("O", CultureInfo.InvariantCulture);
        document["updatedAt"] = DateTime.UtcNow.ToString("O", CultureInfo.InvariantCulture);
        await table.PutItemAsync(document);
        return true;
    }

    public async Task<DiscoverSkipRecord?> GetLastSkippedProfileAsync(string userId)
    {
        Dictionary<string, AttributeValue>? startKey = null;
        DiscoverSkipRecord? latestRecord = null;
        do
        {
            var query = new QueryRequest
            {
                TableName = _discoverPassesTable,
                KeyConditionExpression = "userId = :u",
                ExpressionAttributeValues = new Dictionary<string, AttributeValue>
                {
                    [":u"] = new AttributeValue { S = userId }
                },
                ExclusiveStartKey = startKey
            };
            var response = await _dynamoDb.QueryAsync(query);
            foreach (var item in response.Items)
            {
                if (!item.TryGetValue("targetUserId", out var tid) || string.IsNullOrWhiteSpace(tid.S))
                    continue;
                var isSkipped = !item.TryGetValue("isSkipped", out var skippedVal) || skippedVal.BOOL;
                var restored = item.TryGetValue("restored", out var restoredVal) && restoredVal.BOOL;
                var status = item.TryGetValue("status", out var statusVal) ? statusVal.S : "skipped";
                if (!isSkipped || restored || string.Equals(status, "active", StringComparison.OrdinalIgnoreCase))
                    continue;

                var skippedAt = DateTime.UtcNow;
                if (item.TryGetValue("skippedAt", out var skippedAtVal) && DateTime.TryParse(skippedAtVal.S, out var parsedSkippedAt))
                    skippedAt = parsedSkippedAt;
                else if (item.TryGetValue("createdAt", out var createdAtVal) && DateTime.TryParse(createdAtVal.S, out var parsedCreatedAt))
                    skippedAt = parsedCreatedAt;

                if (latestRecord == null || skippedAt > latestRecord.SkippedAt)
                {
                    latestRecord = new DiscoverSkipRecord
                    {
                        TargetUserId = tid.S!,
                        SkippedAt = skippedAt,
                        SkippedByUserId = item.TryGetValue("skippedByUserId", out var skippedByVal) && !string.IsNullOrWhiteSpace(skippedByVal.S)
                            ? skippedByVal.S!
                            : userId,
                        IsSkipped = isSkipped,
                        Restored = restored
                    };
                }
            }
            startKey = response.LastEvaluatedKey is { Count: > 0 } ? response.LastEvaluatedKey : null;
        } while (startKey != null);

        return latestRecord;
    }

    private async Task<Dictionary<string, string>> GetAdminProfileStatusMapAsync()
    {
        var map = new Dictionary<string, string>(StringComparer.Ordinal);
        Dictionary<string, AttributeValue>? startKey = null;
        do
        {
            var query = new QueryRequest
            {
                TableName = _discoverPassesTable,
                KeyConditionExpression = "userId = :u",
                ExpressionAttributeValues = new Dictionary<string, AttributeValue>
                {
                    [":u"] = new AttributeValue { S = AdminProfileStatusPartitionKey }
                },
                ExclusiveStartKey = startKey
            };
            var response = await _dynamoDb.QueryAsync(query);
            foreach (var item in response.Items)
            {
                if (!item.TryGetValue("targetUserId", out var tid) || string.IsNullOrWhiteSpace(tid.S))
                    continue;
                var value = item.TryGetValue("status", out var statusVal) && !string.IsNullOrWhiteSpace(statusVal.S)
                    ? statusVal.S!
                    : "active";
                map[tid.S!] = value;
            }
            startKey = response.LastEvaluatedKey is { Count: > 0 } ? response.LastEvaluatedKey : null;
        } while (startKey != null);
        return map;
    }

    public async Task<AdminDiscoverControls> GetAdminDiscoverControlsAsync()
    {
        var table = Table.LoadTable(_dynamoDb, _discoverPassesTable);
        var doc = await table.GetItemAsync(AdminControlsPartitionKey, AdminControlsSortKey);
        return new AdminDiscoverControls
        {
            IgnoreSkippedProfilesInDiscoverForAdmin =
                doc != null &&
                doc.ContainsKey("ignoreSkippedProfilesInDiscoverForAdmin") &&
                doc["ignoreSkippedProfilesInDiscoverForAdmin"].AsBoolean()
        };
    }

    public async Task<AdminDiscoverControls> SetAdminDiscoverControlsAsync(bool ignoreSkippedProfilesInDiscoverForAdmin)
    {
        var table = Table.LoadTable(_dynamoDb, _discoverPassesTable);
        var doc = new Document
        {
            ["userId"] = AdminControlsPartitionKey,
            ["targetUserId"] = AdminControlsSortKey,
            ["ignoreSkippedProfilesInDiscoverForAdmin"] = ignoreSkippedProfilesInDiscoverForAdmin,
            ["updatedAt"] = DateTime.UtcNow.ToString("O", CultureInfo.InvariantCulture),
            ["status"] = "controls"
        };
        await table.PutItemAsync(doc);
        return new AdminDiscoverControls
        {
            IgnoreSkippedProfilesInDiscoverForAdmin = ignoreSkippedProfilesInDiscoverForAdmin
        };
    }

    public async Task<List<AdminDiscoverProfileRow>> ListAdminDiscoverProfilesAsync(string filter = "all", int limit = 200)
    {
        var table = Table.LoadTable(_dynamoDb, _profilesTable);
        var search = table.Scan(new ScanFilter());
        var docs = new List<Document>();
        do
        {
            docs.AddRange(await search.GetNextSetAsync());
        } while (!search.IsDone);

        var matchedProfileIds = await GetMatchedProfileIdsAsync();
        var statusMap = await GetAdminProfileStatusMetadataMapAsync();

        var rows = docs
            .Where(d => d.ContainsKey("userId"))
            .Select(d =>
            {
                var userId = d["userId"].AsString();
                var explicitStatus = statusMap.TryGetValue(userId, out var m) ? m.Status : null;
                var status = explicitStatus
                    ?? (matchedProfileIds.Contains(userId) ? "matched" : "active");
                return new AdminDiscoverProfileRow
                {
                    UserId = userId,
                    Name = d.ContainsKey("name") ? d["name"].AsString() : userId,
                    Status = status,
                    LastSkippedAt = statusMap.TryGetValue(userId, out var sm) ? sm.LastSkippedAt : null,
                    LastSkippedByUserId = statusMap.TryGetValue(userId, out var sm2) ? sm2.LastSkippedByUserId : null
                };
            })
            .ToList();

        if (!string.Equals(filter, "all", StringComparison.OrdinalIgnoreCase))
            rows = rows.Where(r => string.Equals(r.Status, filter, StringComparison.OrdinalIgnoreCase)).ToList();

        return rows
            .OrderByDescending(r => r.LastSkippedAt ?? DateTime.MinValue)
            .ThenBy(r => r.Name)
            .Take(Math.Clamp(limit, 1, 500))
            .ToList();
    }

    public async Task<bool> AdminSetProfileDiscoverStatusAsync(string profileUserId, string status, string adminUserId)
    {
        var normalized = status.Trim().ToLowerInvariant();
        if (normalized is not ("active" or "skipped" or "hidden" or "matched"))
            return false;

        var table = Table.LoadTable(_dynamoDb, _discoverPassesTable);
        var doc = new Document
        {
            ["userId"] = AdminProfileStatusPartitionKey,
            ["targetUserId"] = profileUserId,
            ["status"] = normalized,
            ["updatedAt"] = DateTime.UtcNow.ToString("O", CultureInfo.InvariantCulture),
            ["updatedByUserId"] = adminUserId
        };
        if (normalized == "skipped")
        {
            doc["skippedAt"] = DateTime.UtcNow.ToString("O", CultureInfo.InvariantCulture);
            doc["skippedByUserId"] = adminUserId;
            doc["isSkipped"] = true;
        }
        if (normalized == "active")
        {
            doc["isSkipped"] = false;
            doc["restored"] = true;
        }
        await table.PutItemAsync(doc);
        return true;
    }

    public async Task<bool> AdminResetProfileInteractionStateAsync(string profileUserId)
    {
        var scan = await _dynamoDb.ScanAsync(new ScanRequest
        {
            TableName = _discoverPassesTable,
            FilterExpression = "targetUserId = :t and userId <> :controls and userId <> :statusPk",
            ExpressionAttributeValues = new Dictionary<string, AttributeValue>
            {
                [":t"] = new AttributeValue { S = profileUserId },
                [":controls"] = new AttributeValue { S = AdminControlsPartitionKey },
                [":statusPk"] = new AttributeValue { S = AdminProfileStatusPartitionKey }
            }
        });

        foreach (var item in scan.Items)
        {
            if (!item.TryGetValue("userId", out var uid) || uid.S == null) continue;
            if (!item.TryGetValue("targetUserId", out var tid) || tid.S == null) continue;
            await _dynamoDb.DeleteItemAsync(new DeleteItemRequest
            {
                TableName = _discoverPassesTable,
                Key = new Dictionary<string, AttributeValue>
                {
                    ["userId"] = new AttributeValue { S = uid.S },
                    ["targetUserId"] = new AttributeValue { S = tid.S }
                }
            });
        }

        return true;
    }

    private async Task<HashSet<string>> GetMatchedProfileIdsAsync()
    {
        var table = Table.LoadTable(_dynamoDb, _matchesTable);
        var scan = table.Scan(new ScanFilter());
        var ids = new HashSet<string>(StringComparer.Ordinal);
        do
        {
            var batch = await scan.GetNextSetAsync();
            foreach (var doc in batch)
            {
                if (!doc.ContainsKey("isMatched") || !doc["isMatched"].AsBoolean()) continue;
                if (doc.ContainsKey("userId1")) ids.Add(doc["userId1"].AsString());
                if (doc.ContainsKey("userId2")) ids.Add(doc["userId2"].AsString());
            }
        } while (!scan.IsDone);
        return ids;
    }

    private async Task<Dictionary<string, (string Status, DateTime? LastSkippedAt, string? LastSkippedByUserId)>> GetAdminProfileStatusMetadataMapAsync()
    {
        var map = new Dictionary<string, (string, DateTime?, string?)>(StringComparer.Ordinal);
        Dictionary<string, AttributeValue>? startKey = null;
        do
        {
            var query = new QueryRequest
            {
                TableName = _discoverPassesTable,
                KeyConditionExpression = "userId = :u",
                ExpressionAttributeValues = new Dictionary<string, AttributeValue>
                {
                    [":u"] = new AttributeValue { S = AdminProfileStatusPartitionKey }
                },
                ExclusiveStartKey = startKey
            };
            var response = await _dynamoDb.QueryAsync(query);
            foreach (var item in response.Items)
            {
                if (!item.TryGetValue("targetUserId", out var tid) || string.IsNullOrWhiteSpace(tid.S))
                    continue;
                var key = tid.S!;
                var status = item.TryGetValue("status", out var statusVal) && !string.IsNullOrWhiteSpace(statusVal.S)
                    ? statusVal.S!
                    : "active";
                DateTime? skippedAt = null;
                if (item.TryGetValue("skippedAt", out var skippedVal) && DateTime.TryParse(skippedVal.S, out var dt))
                    skippedAt = dt;
                var skippedBy = item.TryGetValue("skippedByUserId", out var skippedByVal) ? skippedByVal.S : null;
                map[key] = (status, skippedAt, skippedBy);
            }
            startKey = response.LastEvaluatedKey is { Count: > 0 } ? response.LastEvaluatedKey : null;
        } while (startKey != null);
        return map;
    }

    /// <summary>
    /// Mutual matches only: both sides liked (<see cref="Match.IsMatched"/>).
    /// Scans the full table then filters in memory so we never depend on incorrect ScanFilter attribute casing
    /// (Dynamo stores <c>isMatched</c>, not <c>IsMatched</c> — a bad filter previously returned zero rows).
    /// </summary>
    public async Task<List<Match>> GetUserMatchesAsync(string userId)
    {
        try
        {
            var table = Table.LoadTable(_dynamoDb, _matchesTable);
            var search = table.Scan(new ScanFilter());
            var matches = new List<Match>();

            do
            {
                var batch = await search.GetNextSetAsync();
                foreach (var doc in batch)
                {
                    var match = DocumentToMatch(doc);
                    if (!match.IsMatched) continue;
                    if (match.UserId1 == userId || match.UserId2 == userId)
                        matches.Add(match);
                }
            } while (!search.IsDone);

            return matches;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting matches for user {UserId}", userId);
            throw;
        }
    }

    public async Task<Match?> GetMatchAsync(string userId1, string userId2)
    {
        try
        {
            var table = Table.LoadTable(_dynamoDb, _matchesTable);
            var scanFilter = new ScanFilter();
            
            var search = table.Scan(scanFilter);
            
            do
            {
                var batch = await search.GetNextSetAsync();
                foreach (var doc in batch)
                {
                    var u1 = doc["userId1"].AsString();
                    var u2 = doc["userId2"].AsString();
                    
                    if ((u1 == userId1 && u2 == userId2) || (u1 == userId2 && u2 == userId1))
                    {
                        return DocumentToMatch(doc);
                    }
                }
            } while (!search.IsDone);

            return null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting match between {UserId1} and {UserId2}", userId1, userId2);
            return null;
        }
    }

    public async Task<Match?> GetMatchByIdAsync(string matchId)
    {
        if (string.IsNullOrEmpty(matchId)) return null;
        try
        {
            var table = Table.LoadTable(_dynamoDb, _matchesTable);
            var keyDoc = new Document { ["matchId"] = matchId };
            var doc = await table.GetItemAsync(keyDoc);
            return doc != null ? DocumentToMatch(doc) : null;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Error getting match by id {MatchId}", matchId);
            return null;
        }
    }

    /// <summary>All match rows where the user is a participant (single table scan; reuse for sent + discover exclusions).</summary>
    private async Task<List<Match>> ListMatchesInvolvingUserAsync(string userId)
    {
        var table = Table.LoadTable(_dynamoDb, _matchesTable);
        var search = table.Scan(new ScanFilter());
        var list = new List<Match>();
        do
        {
            foreach (var doc in await search.GetNextSetAsync())
            {
                var m = DocumentToMatch(doc);
                if (m.UserId1 == userId || m.UserId2 == userId)
                    list.Add(m);
            }
        } while (!search.IsDone);

        return list;
    }

    public async Task<List<SentRequestItem>> ListSentRequestsAsync(string userId)
    {
        var matches = await ListMatchesInvolvingUserAsync(userId);
        var list = new List<SentRequestItem>();
        foreach (var m in matches.OrderByDescending(x => x.UpdatedAt))
        {
            var iAm1 = m.UserId1 == userId;
            var iLiked = iAm1 ? m.User1Liked : m.User2Liked;
            if (!iLiked) continue;
            var otherId = iAm1 ? m.UserId2 : m.UserId1;
            if (string.Equals(otherId, userId, StringComparison.Ordinal))
                continue;
            var tp = await _profileService.GetProfileAsync(otherId);
            var name = tp?.Name ?? "User";
            var photos = ResolvePhotoUrlsForProfile(tp);
            list.Add(new SentRequestItem
            {
                UserId = otherId,
                Name = name,
                City = tp?.City,
                PhotoUrls = photos,
                Status = m.IsMatched ? "Matched" : "Pending",
                MatchId = m.MatchId,
                CompatibilityScore = m.CompatibilityScore,
                UpdatedAt = m.UpdatedAt
            });
        }

        return list.Take(RelationshipListLimit).ToList();
    }

    public async Task<List<SkippedProfileItem>> ListSkippedProfilesAsync(string userId)
    {
        var rows = new List<(string TargetId, DateTime SkippedAt)>();
        Dictionary<string, AttributeValue>? startKey = null;
        do
        {
            var query = new QueryRequest
            {
                TableName = _discoverPassesTable,
                KeyConditionExpression = "userId = :u",
                ExpressionAttributeValues = new Dictionary<string, AttributeValue>
                {
                    [":u"] = new AttributeValue { S = userId }
                },
                ExclusiveStartKey = startKey
            };
            var response = await _dynamoDb.QueryAsync(query);
            foreach (var item in response.Items)
            {
                if (!item.TryGetValue("targetUserId", out var tid) || string.IsNullOrWhiteSpace(tid.S))
                    continue;
                var isSkipped = !item.TryGetValue("isSkipped", out var skippedVal) || skippedVal.BOOL;
                var restored = item.TryGetValue("restored", out var restoredVal) && restoredVal.BOOL;
                var status = item.TryGetValue("status", out var statusVal) ? statusVal.S : "skipped";
                if (!isSkipped || restored || string.Equals(status, "active", StringComparison.OrdinalIgnoreCase))
                    continue;

                var skippedAt = DateTime.UtcNow;
                if (item.TryGetValue("skippedAt", out var skippedAtVal) && DateTime.TryParse(skippedAtVal.S, out var parsedSkippedAt))
                    skippedAt = parsedSkippedAt;
                else if (item.TryGetValue("createdAt", out var createdAtVal) && DateTime.TryParse(createdAtVal.S, out var parsedCreatedAt))
                    skippedAt = parsedCreatedAt;

                rows.Add((tid.S!, skippedAt));
            }
            startKey = response.LastEvaluatedKey is { Count: > 0 } ? response.LastEvaluatedKey : null;
        } while (startKey != null);

        var list = new List<SkippedProfileItem>();
        foreach (var (targetId, skippedAt) in rows.OrderByDescending(x => x.SkippedAt))
        {
            if (string.Equals(targetId, userId, StringComparison.Ordinal))
                continue;
            var tp = await _profileService.GetProfileAsync(targetId);
            if (tp == null) continue;
            list.Add(new SkippedProfileItem
            {
                UserId = targetId,
                Name = tp.Name ?? "User",
                City = tp.City,
                PhotoUrls = ResolvePhotoUrlsForProfile(tp),
                SkippedAt = skippedAt
            });
        }
        return list.Take(RelationshipListLimit).ToList();
    }

    private async Task<HashSet<string>> GetUserIdsExcludedFromDiscoverByMatchesAsync(string userId)
    {
        var excluded = new HashSet<string>(StringComparer.Ordinal);
        foreach (var m in await ListMatchesInvolvingUserAsync(userId))
        {
            var other = m.UserId1 == userId ? m.UserId2 : m.UserId1;
            if (m.IsMatched)
            {
                excluded.Add(other);
                continue;
            }
            var iLiked = m.UserId1 == userId ? m.User1Liked : m.User2Liked;
            if (iLiked) excluded.Add(other);
        }
        return excluded;
    }

    private List<string> ResolvePhotoUrlsForProfile(UserProfile? targetProfile)
    {
        if (targetProfile == null) return new List<string>();
        var photoUrls = targetProfile.PhotoUrls ?? new List<string>();
        if (photoUrls.Count > 0) return photoUrls;
        var keyForCover = targetProfile.PhotoKeys != null && targetProfile.PhotoKeys.Count > 0
            ? targetProfile.PhotoKeys[0]
            : targetProfile.PhotoKey;
        if (string.IsNullOrEmpty(keyForCover)) return photoUrls;
        try
        {
            var signedUrl = _storageService.GetPresignedDownloadUrl(keyForCover, TimeSpan.FromHours(1));
            return new List<string> { signedUrl };
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Could not presign photo for user {UserId}", targetProfile.UserId);
            return photoUrls;
        }
    }

    private int CalculateCompatibilityScore(UserProfile user1, UserProfile user2)
    {
        int score = 0;

        // Sports match (30 points max)
        var commonSports = GetCommonSports(user1.SportTags, user2.SportTags).Count;
        var totalSports = new HashSet<string>(user1.SportTags.Concat(user2.SportTags)).Count;
        score += (int)(commonSports > 0 ? (commonSports / (double)totalSports) * SportsMatchWeight : 0);

        // Schedule match (25 points max)
        var commonSchedule = GetCommonScheduleSlots(user1.AvailabilitySchedule, user2.AvailabilitySchedule).Count;
        score += Math.Min(commonSchedule * 2, ScheduleMatchWeight); // 2 points per common slot, max 25

        // Level compatibility (20 points max)
        if (user1.Level == user2.Level)
            score += LevelMatchWeight;
        else if (LevelsCompatible(user1.Level, user2.Level))
            score += LevelMatchWeight - 5;

        // Distance penalty (15 points max)
        var distance = CalculateDistance(user1.Latitude, user1.Longitude, user2.Latitude, user2.Longitude);
        if (distance < 5) score += DistanceWeight;
        else if (distance < 15) score += DistanceWeight - 5;
        else if (distance < 30) score += DistanceWeight - 10;

        score += GetIntentModePoints(user1, user2);

        return Math.Min(score, 100);
    }

    private int GetIntentModePoints(UserProfile user1, UserProfile user2)
    {
        if (!ProfileModes.HasIntentOverlap(user1, user2))
            return 0;
        if (ProfileModes.IsExactIntentAlignment(user1, user2))
            return ModeMatchWeight;
        return Math.Max(0, ModeMatchWeight - 4);
    }

    private (List<string> Preview, List<string> Locked) BuildMatchInsightReasons(
        UserProfile viewer, UserProfile target, double distanceKm)
    {
        var preview = new List<string>();
        if (ProfileModes.HasIntentOverlap(viewer, target))
        {
            if (ProfileModes.IsExactIntentAlignment(viewer, target))
                preview.Add("✔ Same intent");
            else
                preview.Add("✔ Shared intent");
        }

        if (!string.IsNullOrEmpty(viewer.Level) && !string.IsNullOrEmpty(target.Level))
        {
            if (string.Equals(viewer.Level, target.Level, StringComparison.OrdinalIgnoreCase))
                preview.Add("✔ Same intensity");
            else if (LevelsCompatible(viewer.Level, target.Level))
                preview.Add("✔ Similar level");
        }

        if (distanceKm < 400)
        {
            if (distanceKm < 15)
                preview.Add("✔ Close by");
            else
                preview.Add("✔ Location match");
        }

        var commonGoals = viewer.Goals.Intersect(target.Goals, StringComparer.OrdinalIgnoreCase).ToList();
        if (commonGoals.Count > 0)
            preview.Add("✔ Similar goals");

        var locked = new List<string>
        {
            "🔒 Strength compatibility",
            "🔒 Training rhythm",
            "🔒 Personality fit"
        };

        return (preview.Take(3).ToList(), locked);
    }

    private List<string> GetCommonSports(List<string> sports1, List<string> sports2)
    {
        return sports1.Intersect(sports2, StringComparer.OrdinalIgnoreCase).ToList();
    }

    private List<string> GetCommonSchedule(List<string> schedule1, List<string> schedule2)
    {
        return schedule1.Intersect(schedule2, StringComparer.OrdinalIgnoreCase).ToList();
    }

    private List<string> GetCommonScheduleSlots(List<AvailabilitySlot> schedule1, List<AvailabilitySlot> schedule2)
    {
        // Compare availability slots by days and time windows
        var common = new List<string>();
        foreach (var slot1 in schedule1)
        {
            foreach (var slot2 in schedule2)
            {
                // Check if days overlap
                var commonDays = slot1.Days.Intersect(slot2.Days, StringComparer.OrdinalIgnoreCase).ToList();
                if (commonDays.Any())
                {
                    // Check if time windows overlap
                    if (TimeWindowsOverlap(slot1.TimeStart, slot1.TimeEnd, slot2.TimeStart, slot2.TimeEnd))
                    {
                        common.Add($"{string.Join(",", commonDays)}: {slot1.TimeStart}-{slot1.TimeEnd}");
                    }
                }
            }
        }
        return common;
    }

    private bool TimeWindowsOverlap(string start1, string end1, string start2, string end2)
    {
        // Simple time overlap check (24-hour format "HH:mm")
        try
        {
            var time1Start = TimeSpan.Parse(start1);
            var time1End = TimeSpan.Parse(end1);
            var time2Start = TimeSpan.Parse(start2);
            var time2End = TimeSpan.Parse(end2);

            // Handle wrap-around (e.g., 21:00 to 00:00)
            if (time1End < time1Start) time1End = time1End.Add(TimeSpan.FromDays(1));
            if (time2End < time2Start) time2End = time2End.Add(TimeSpan.FromDays(1));

            return time1Start < time2End && time2Start < time1End;
        }
        catch
        {
            return false;
        }
    }

    private static bool LevelsCompatible(string? level1, string? level2)
    {
        if (string.IsNullOrEmpty(level1) || string.IsNullOrEmpty(level2))
            return true;

        var levels = new[] { "beginner", "intermediate", "advanced", "pro" };
        var idx1 = Array.IndexOf(levels, level1.ToLower());
        var idx2 = Array.IndexOf(levels, level2.ToLower());

        return Math.Abs(idx1 - idx2) <= 1;
    }

    private double CalculateDistance(double? lat1, double? lon1, double? lat2, double? lon2)
    {
        if (!lat1.HasValue || !lon1.HasValue || !lat2.HasValue || !lon2.HasValue)
            return double.MaxValue;

        const double R = 6371; // Earth radius in km
        var dLat = ToRad(lat2.Value - lat1.Value);
        var dLon = ToRad(lon2.Value - lon1.Value);
        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                Math.Cos(ToRad(lat1.Value)) * Math.Cos(ToRad(lat2.Value)) *
                Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
        var c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
        return R * c;
    }

    private double ToRad(double deg) => deg * (Math.PI / 180);

    private async Task SaveMatchAsync(Match match)
    {
        var table = Table.LoadTable(_dynamoDb, _matchesTable);
        var doc = MatchToDocument(match);
        await table.PutItemAsync(doc);
    }

    private Document MatchToDocument(Match match)
    {
        var doc = new Document
        {
            ["matchId"] = match.MatchId,
            ["userId1"] = match.UserId1,
            ["userId2"] = match.UserId2,
            ["compatibilityScore"] = match.CompatibilityScore,
            ["user1Liked"] = match.User1Liked,
            ["user2Liked"] = match.User2Liked,
            ["isMatched"] = match.IsMatched,
            ["distance"] = match.Distance,
            ["createdAt"] = match.CreatedAt.ToString("O"),
            ["updatedAt"] = match.UpdatedAt.ToString("O")
        };

        if (match.CommonSports.Any())
            doc["commonSports"] = new DynamoDBList(match.CommonSports.Select(s => new Primitive(s)));
        if (match.CommonSchedule.Any())
            doc["commonSchedule"] = new DynamoDBList(match.CommonSchedule.Select(s => new Primitive(s)));

        return doc;
    }

    private Match DocumentToMatch(Document doc)
    {
        return new Match
        {
            MatchId = doc["matchId"],
            UserId1 = doc["userId1"],
            UserId2 = doc["userId2"],
            CompatibilityScore = (int)doc["compatibilityScore"].AsInt(),
            User1Liked = doc["user1Liked"].AsBoolean(),
            User2Liked = doc["user2Liked"].AsBoolean(),
            IsMatched = doc["isMatched"].AsBoolean(),
            Distance = doc.ContainsKey("distance") ? doc["distance"].AsDouble() : 0,
            CommonSports = doc.ContainsKey("commonSports") ? doc["commonSports"].AsListOfString() : new List<string>(),
            CommonSchedule = doc.ContainsKey("commonSchedule") ? doc["commonSchedule"].AsListOfString() : new List<string>(),
            CreatedAt = DateTime.Parse(doc["createdAt"]),
            UpdatedAt = DateTime.Parse(doc["updatedAt"])
        };
    }

    private UserProfile DocumentToProfile(Document document)
    {
        var userId = document.ContainsKey("userId") ? document["userId"].AsString() : string.Empty;
        var email = document.ContainsKey("email") ? document["email"].AsString() : string.Empty;
        var name = document.ContainsKey("name") ? document["name"].AsString() : string.Empty;
        var mode = document.ContainsKey("mode") ? document["mode"].AsString() : "TRAIN";
        var isComplete = document.ContainsKey("isComplete") ? document["isComplete"].AsBoolean() : false;
        var createdAt = document.ContainsKey("createdAt") && DateTime.TryParse(document["createdAt"].AsString(), out var ca) ? ca : DateTime.UtcNow;
        var updatedAt = document.ContainsKey("updatedAt") && DateTime.TryParse(document["updatedAt"].AsString(), out var ua) ? ua : DateTime.UtcNow;

        var photoKey = document.ContainsKey("photoKey") ? document["photoKey"].AsString() : null;
        var photoKeys = document.ContainsKey("photoKeys") ? document["photoKeys"].AsListOfString() : new List<string>();
        if (photoKeys.Count == 0 && !string.IsNullOrEmpty(photoKey))
            photoKeys = new List<string> { photoKey };

        var modes = document.ContainsKey("modes") && document["modes"] is DynamoDBList modesList
            ? modesList.AsListOfString().Select(ProfileModes.Normalize).Distinct().ToList()
            : new List<string>();

        var profile = new UserProfile
        {
            UserId = userId,
            Email = email,
            Name = name,
            City = document.ContainsKey("city") ? document["city"].AsString() : null,
            Bio = document.ContainsKey("bio") ? document["bio"].AsString() : null,
            SportTags = document.ContainsKey("sportTags") ? document["sportTags"].AsListOfString() : new List<string>(),
            Level = document.ContainsKey("level") ? document["level"].AsString() : null,
            PhotoKey = photoKey,
            PhotoKeys = photoKeys,
            Goals = document.ContainsKey("goals") ?
                (document["goals"] is DynamoDBList goalsList ? goalsList.AsListOfString() :
                 document["goals"].AsString() is string goalsStr && !string.IsNullOrEmpty(goalsStr) ? new List<string> { goalsStr } :
                 new List<string>()) : new List<string>(),
            AvailabilitySchedule = new List<AvailabilitySlot>(),
            Mode = mode,
            Modes = modes,
            WorkoutStyle = document.ContainsKey("workoutStyle") ? document["workoutStyle"].AsString() : null,
            PersonalityTag = document.ContainsKey("personalityTag") ? document["personalityTag"].AsString() : null,
            Latitude = document.ContainsKey("latitude") ? (double?)document["latitude"].AsDouble() : null,
            Longitude = document.ContainsKey("longitude") ? (double?)document["longitude"].AsDouble() : null,
            PhotoUrls = document.ContainsKey("photoUrls") ? document["photoUrls"].AsListOfString() : new List<string>(),
            IsComplete = isComplete,
            CreatedAt = createdAt,
            UpdatedAt = updatedAt
        };

        if (document.ContainsKey("availabilitySchedule"))
        {
            try
            {
                var availabilityEntry = document["availabilitySchedule"];
                if (availabilityEntry is Primitive primitive && primitive.Type == DynamoDBEntryType.String)
                {
                    var availabilityStr = primitive.AsString();
                    if (!string.IsNullOrEmpty(availabilityStr) && availabilityStr.StartsWith("["))
                        profile.AvailabilitySchedule = JsonSerializer.Deserialize<List<AvailabilitySlot>>(availabilityStr) ?? new List<AvailabilitySlot>();
                }
            }
            catch
            {
                profile.AvailabilitySchedule = new List<AvailabilitySlot>();
            }
        }

        if (profile.Modes.Count == 0)
            profile.Modes = new List<string> { ProfileModes.Normalize(profile.Mode) };
        else
            profile.Mode = profile.Modes[0];

        return profile;
    }
}
