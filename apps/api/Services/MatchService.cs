using Amazon.DynamoDBv2;
using Amazon.DynamoDBv2.DocumentModel;
using Amazon.DynamoDBv2.Model;
using GetTrainMate.Api.Models;
using System.Globalization;

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
            Mode = targetProfile.Mode
        };
    }

    public async Task<List<MatchFeedItem>> GetDiscoveryFeedAsync(string userId, int limit = 20)
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

                if (passedTargetIds.Contains(profileUserId))
                    continue;

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

                var compatibilityScore = userProfile != null
                    ? CalculateCompatibilityScore(userProfile, targetProfile)
                    : 50;

                var photoUrls = targetProfile.PhotoUrls ?? new List<string>();
                if (photoUrls.Count == 0 && !string.IsNullOrEmpty(targetProfile.PhotoKey))
                {
                    try
                    {
                        var signedUrl = _storageService.GetPresignedDownloadUrl(targetProfile.PhotoKey, TimeSpan.FromHours(1));
                        photoUrls = new List<string> { signedUrl };
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Could not generate photo URL for user {UserId}", targetProfile.UserId);
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
                    Mode = targetProfile.Mode
                });
            }

            // Sort by compatibility score descending
            return feedItems
                .OrderByDescending(x => x.CompatibilityScore)
                .Take(limit)
                .ToList();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting discovery feed for user {UserId}", userId);
            throw;
        }
    }

    public async Task<MatchResponse> LikeUserAsync(string userId, string targetUserId)
    {
        // Like costs 1 credit; fail fast if insufficient
        await _creditsService.SpendCreditsAsync(userId, 1, CreditLedgerReason.Like, targetUserId);

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
                ["createdAt"] = DateTime.UtcNow.ToString("O", CultureInfo.InvariantCulture)
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
                ProjectionExpression = "targetUserId",
                ExclusiveStartKey = startKey
            };
            var response = await _dynamoDb.QueryAsync(query);
            foreach (var item in response.Items)
            {
                if (item.TryGetValue("targetUserId", out var tid) && tid.S != null)
                    result.Add(tid.S);
            }
            startKey = response.LastEvaluatedKey is { Count: > 0 } ? response.LastEvaluatedKey : null;
        } while (startKey != null);

        return result;
    }

    public async Task<List<Match>> GetUserMatchesAsync(string userId)
    {
        try
        {
            var table = Table.LoadTable(_dynamoDb, _matchesTable);
            var scanFilter = new ScanFilter();
            scanFilter.AddCondition("IsMatched", ScanOperator.Equal, true);
            
            var search = table.Scan(scanFilter);
            var matches = new List<Match>();
            
            do
            {
                var batch = await search.GetNextSetAsync();
                foreach (var doc in batch)
                {
                    var match = DocumentToMatch(doc);
                    if (match.UserId1 == userId || match.UserId2 == userId)
                    {
                        matches.Add(match);
                    }
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

        // Mode match (10 points max)
        if (user1.Mode == user2.Mode)
            score += ModeMatchWeight;

        return Math.Min(score, 100);
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

    private bool LevelsCompatible(string? level1, string? level2)
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

        return new UserProfile
        {
            UserId = userId,
            Email = email,
            Name = name,
            City = document.ContainsKey("city") ? document["city"].AsString() : null,
            Bio = document.ContainsKey("bio") ? document["bio"].AsString() : null,
            SportTags = document.ContainsKey("sportTags") ? document["sportTags"].AsListOfString() : new List<string>(),
            Level = document.ContainsKey("level") ? document["level"].AsString() : null,
            PhotoKey = photoKey,
            Goals = document.ContainsKey("goals") ?
                (document["goals"] is DynamoDBList goalsList ? goalsList.AsListOfString() :
                 document["goals"].AsString() is string goalsStr && !string.IsNullOrEmpty(goalsStr) ? new List<string> { goalsStr } :
                 new List<string>()) : new List<string>(),
            AvailabilitySchedule = new List<AvailabilitySlot>(),
            Mode = mode,
            Latitude = document.ContainsKey("latitude") ? (double?)document["latitude"].AsDouble() : null,
            Longitude = document.ContainsKey("longitude") ? (double?)document["longitude"].AsDouble() : null,
            PhotoUrls = document.ContainsKey("photoUrls") ? document["photoUrls"].AsListOfString() : new List<string>(),
            IsComplete = isComplete,
            CreatedAt = createdAt,
            UpdatedAt = updatedAt
        };
    }
}
