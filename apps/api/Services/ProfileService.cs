using Amazon.DynamoDBv2;
using Amazon.DynamoDBv2.DocumentModel;
using Amazon.DynamoDBv2.Model;
using GetTrainMate.Api.Models;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace GetTrainMate.Api.Services;

public class ProfileService : IProfileService
{
    private readonly IAmazonDynamoDB _dynamoDb;
    private readonly string _tableName;
    private readonly ILogger<ProfileService> _logger;

    public ProfileService(
        IAmazonDynamoDB dynamoDb,
        IConfiguration configuration,
        ILogger<ProfileService> logger)
    {
        _dynamoDb = dynamoDb;
        var prefix = configuration["DYNAMODB_TABLE_PREFIX"] ?? "gettrainmate-";
        _tableName = configuration["DYNAMODB_TABLE_PROFILES"] ?? $"{prefix}profiles";
        _logger = logger;
    }

    public UserProfile? TryMapDynamoItemToProfile(Dictionary<string, AttributeValue>? item)
    {
        if (item == null || item.Count == 0)
            return null;
        try
        {
            var doc = Document.FromAttributeMap(item);
            if (DynamoProfileDocumentFlags.IsAccountClosed(doc))
                return null;
            return DocumentToProfile(doc);
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Failed to map Dynamo item to profile");
            return null;
        }
    }

    public async Task<UserProfile?> GetProfileAsync(string userId)
    {
        try
        {
            _logger.LogDebug("Loading profile from table {TableName} for user {UserId}", _tableName, userId);
            var table = Table.LoadTable(_dynamoDb, _tableName);
            var document = await table.GetItemAsync(userId);

            if (document == null)
            {
                _logger.LogDebug("No profile found for user {UserId}", userId);
                return null;
            }

            if (DynamoProfileDocumentFlags.IsAccountClosed(document))
            {
                _logger.LogDebug("Account closed tombstone for user {UserId}", userId);
                return null;
            }

            _logger.LogDebug("Profile found for user {UserId}, deserializing", userId);
            return DocumentToProfile(document);
        }
        catch (Amazon.DynamoDBv2.AmazonDynamoDBException dbEx)
        {
            _logger.LogError(dbEx, "DynamoDB error getting profile for user {UserId}. Table: {TableName}, Error: {Error}", 
                userId, _tableName, dbEx.Message);
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting profile for user {UserId}. Table: {TableName}, Error: {Error}", 
                userId, _tableName, ex.Message);
            throw;
        }
    }

    public async Task<UserProfile?> GetProfileForAdminAsync(string userId)
    {
        if (string.IsNullOrWhiteSpace(userId)) return null;
        try
        {
            var table = Table.LoadTable(_dynamoDb, _tableName);
            var document = await table.GetItemAsync(userId);
            if (document == null || document.Count == 0)
                return null;
            return DocumentToProfile(document);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "GetProfileForAdminAsync failed for {UserId}", userId);
            return null;
        }
    }

    public async Task<UserProfile> CreateProfileAsync(UserProfile profile)
    {
        try
        {
            EnsureModesArraySynced(profile);
            var table = Table.LoadTable(_dynamoDb, _tableName);
            var document = ProfileToDocument(profile);

            await table.PutItemAsync(document);
            return profile;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating profile for user {UserId}", profile.UserId);
            throw;
        }
    }

    public async Task<UserProfile?> SetProfileEmailIfEmptyAsync(string userId, string email)
    {
        if (string.IsNullOrWhiteSpace(userId) || string.IsNullOrWhiteSpace(email))
            return null;
        var profile = await GetProfileAsync(userId);
        if (profile == null)
            return null;
        if (!string.IsNullOrWhiteSpace(profile.Email))
            return profile;
        profile.Email = email.Trim();
        profile.UpdatedAt = DateTime.UtcNow;
        EnsureModesArraySynced(profile);
        var table = Table.LoadTable(_dynamoDb, _tableName);
        await table.PutItemAsync(ProfileToDocument(profile));
        return profile;
    }

    public async Task<UserProfile> UpdateProfileAsync(string userId, UpdateProfileRequest request)
    {
        try
        {
            var existingProfile = await GetProfileAsync(userId);
            
            if (existingProfile == null)
            {
                // Create new profile if doesn't exist
                existingProfile = new UserProfile
                {
                    UserId = userId,
                    Email = string.Empty, // Will be set by controller from Cognito
                    CreatedAt = DateTime.UtcNow
                };
            }

            // Update fields (use empty lists/defaults to avoid null refs)
            if (request.Name != null) existingProfile.Name = request.Name.Trim();
            if (request.City != null) existingProfile.City = request.City.Trim();
            if (request.State != null) existingProfile.State = request.State.Trim();
            if (request.Country != null) existingProfile.Country = request.Country.Trim();
            if (request.Bio != null) existingProfile.Bio = request.Bio.Trim();
            if (request.BirthDate != null) existingProfile.BirthDate = request.BirthDate;
            if (request.Gender != null) existingProfile.Gender = request.Gender.Trim();
            if (request.SportTags != null) existingProfile.SportTags = request.SportTags;
            if (request.Level != null) existingProfile.Level = request.Level.Trim();
            if (request.Goals != null) existingProfile.Goals = request.Goals;
            if (request.AvailabilitySchedule != null)
            {
                // Normalize slots: ensure Days/TimeStart/TimeEnd are non-null
                existingProfile.AvailabilitySchedule = request.AvailabilitySchedule
                    .Select(s => new AvailabilitySlot
                    {
                        Days = s.Days ?? new List<string>(),
                        TimeStart = s.TimeStart ?? string.Empty,
                        TimeEnd = s.TimeEnd ?? string.Empty
                    })
                    .ToList();
            }
            if (request.Modes != null && request.Modes.Count > 0)
            {
                existingProfile.Modes = request.Modes
                    .Select(m => ProfileModes.Normalize(m))
                    .Distinct()
                    .ToList();
                if (existingProfile.Modes.Count == 0)
                    existingProfile.Modes = new List<string> { "TRAIN" };
                existingProfile.Mode = existingProfile.Modes[0];
            }
            else if (!string.IsNullOrWhiteSpace(request.Mode))
            {
                existingProfile.Mode = request.Mode.Trim();
                existingProfile.Modes = new List<string> { ProfileModes.Normalize(existingProfile.Mode) };
            }
            if (request.WorkoutStyle != null) existingProfile.WorkoutStyle = string.IsNullOrWhiteSpace(request.WorkoutStyle) ? null : request.WorkoutStyle.Trim();
            if (request.PersonalityTag != null) existingProfile.PersonalityTag = string.IsNullOrWhiteSpace(request.PersonalityTag) ? null : request.PersonalityTag.Trim();
            if (request.Latitude != null) existingProfile.Latitude = request.Latitude;
            if (request.Longitude != null) existingProfile.Longitude = request.Longitude;
            if (request.PhotoKeys != null)
            {
                existingProfile.PhotoKeys = request.PhotoKeys
                    .Where(k => !string.IsNullOrWhiteSpace(k))
                    .Select(k => k.Trim())
                    .Distinct()
                    .ToList();
                existingProfile.PhotoKey = existingProfile.PhotoKeys.FirstOrDefault();
            }
            else if (request.PhotoKey != null)
            {
                existingProfile.PhotoKey = request.PhotoKey.Trim();
                if (!existingProfile.PhotoKeys.Any())
                    existingProfile.PhotoKeys = new List<string> { existingProfile.PhotoKey };
                else
                    existingProfile.PhotoKeys[0] = existingProfile.PhotoKey;
            }
            if (request.PreferredDistanceMiles != null) existingProfile.PreferredDistanceMiles = request.PreferredDistanceMiles;
            if (request.ChatNotificationsEnabled.HasValue)
                existingProfile.ChatNotificationsEnabled = request.ChatNotificationsEnabled.Value;
            if (!string.IsNullOrWhiteSpace(request.ChatNotificationFrequency))
                existingProfile.ChatNotificationFrequency = request.ChatNotificationFrequency.Trim();

            if (request.EventsWaitlistEnabled.HasValue)
            {
                var prevWaitlist = existingProfile.EventsWaitlistEnabled;
                existingProfile.EventsWaitlistEnabled = request.EventsWaitlistEnabled.Value;
                if (existingProfile.EventsWaitlistEnabled && (!prevWaitlist || !existingProfile.EventsJoinedWaitlistAt.HasValue))
                    existingProfile.EventsJoinedWaitlistAt = DateTime.UtcNow;
            }

            if (request.EventsCityInterest != null)
                existingProfile.EventsCityInterest = string.IsNullOrWhiteSpace(request.EventsCityInterest)
                    ? null
                    : request.EventsCityInterest.Trim();

            if (request.EventsInterestTypes != null)
            {
                existingProfile.EventsInterestTypes = request.EventsInterestTypes
                    .Where(s => !string.IsNullOrWhiteSpace(s))
                    .Select(s => s.Trim())
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToList();
            }

            if (request.EventsCitySuggestion != null)
            {
                var s = request.EventsCitySuggestion.Trim();
                if (string.IsNullOrEmpty(s))
                {
                    existingProfile.EventsCitySuggestion = null;
                    existingProfile.EventsCitySuggestionAt = null;
                }
                else
                {
                    existingProfile.EventsCitySuggestion = s;
                    existingProfile.EventsCitySuggestionAt = DateTime.UtcNow;
                }
            }

            existingProfile.UpdatedAt = DateTime.UtcNow;
            existingProfile.IsComplete = IsProfileComplete(existingProfile);
            EnsureModesArraySynced(existingProfile);

            var table = Table.LoadTable(_dynamoDb, _tableName);
            var document = ProfileToDocument(existingProfile);
            await table.PutItemAsync(document);

            return existingProfile;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating profile for user {UserId}", userId);
            throw;
        }
    }

    /// <summary>
    /// Keeps <see cref="UserProfile.Mode"/> (legacy) and <see cref="UserProfile.Modes"/> in sync.
    /// Old Dynamo rows may only have <c>mode</c>; clients always receive a non-empty modes array.
    /// </summary>
    private static void EnsureModesArraySynced(UserProfile p)
    {
        if (p.Modes.Count > 0)
        {
            p.Modes = p.Modes.Select(ProfileModes.Normalize).Distinct().ToList();
            p.Mode = p.Modes[0];
            return;
        }

        if (!string.IsNullOrWhiteSpace(p.Mode))
        {
            var one = ProfileModes.Normalize(p.Mode);
            p.Mode = one;
            p.Modes = new List<string> { one };
            return;
        }

        p.Mode = "TRAIN";
        p.Modes = new List<string> { "TRAIN" };
    }

    public async Task<UserProfile?> PatchDiscoverLifecycleAsync(string userId, DiscoverLifecycleFlagsPatch patch)
    {
        var table = Table.LoadTable(_dynamoDb, _tableName);
        var raw = await table.GetItemAsync(userId);
        if (raw == null || raw.Count == 0) return null;

        var preserveClosed = DynamoProfileDocumentFlags.IsAccountClosed(raw);
        var existing = await GetProfileForAdminAsync(userId);
        if (existing == null) return null;

        if (patch.CanReviewSkippedProfiles.HasValue)
            existing.DiscoverCanReviewSkippedProfiles = patch.CanReviewSkippedProfiles.Value;
        if (patch.CanReviewLikedProfiles.HasValue)
            existing.DiscoverCanReviewLikedProfiles = patch.CanReviewLikedProfiles.Value;
        if (patch.CanReplayDiscoverQueue.HasValue)
            existing.DiscoverCanReplayDiscoverQueue = patch.CanReplayDiscoverQueue.Value;
        if (patch.CanRewindLastSkip.HasValue)
            existing.DiscoverCanRewindLastSkip = patch.CanRewindLastSkip.Value;
        if (patch.CanRecycleSkippedProfiles.HasValue)
            existing.DiscoverCanRecycleSkippedProfiles = patch.CanRecycleSkippedProfiles.Value;
        existing.UpdatedAt = DateTime.UtcNow;
        EnsureModesArraySynced(existing);
        var doc = ProfileToDocument(existing);
        if (preserveClosed)
        {
            doc["accountClosed"] = true;
            if (raw.ContainsKey("accountClosedAt"))
                doc["accountClosedAt"] = raw["accountClosedAt"];
        }
        await table.PutItemAsync(doc);
        return existing;
    }

    public async Task<bool> DeleteProfileAsync(string userId)
    {
        try
        {
            var table = Table.LoadTable(_dynamoDb, _tableName);
            var doc = await table.GetItemAsync(userId);
            if (DynamoProfileDocumentFlags.IsAccountClosed(doc))
                return true;

            if (doc == null || doc.Count == 0)
            {
                await table.PutItemAsync(new Document
                {
                    ["userId"] = userId,
                    ["accountClosed"] = true,
                    ["accountClosedAt"] = DateTime.UtcNow.ToString("O"),
                });
                return true;
            }

            doc["accountClosed"] = true;
            doc["accountClosedAt"] = DateTime.UtcNow.ToString("O");
            if (!doc.ContainsKey("userId") || string.IsNullOrWhiteSpace(doc["userId"].AsString()))
                doc["userId"] = userId;
            await table.PutItemAsync(doc);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error soft-deleting profile for user {UserId}", userId);
            return false;
        }
    }

    public async Task<bool> IsAccountClosedAsync(string userId)
    {
        if (string.IsNullOrWhiteSpace(userId)) return false;
        try
        {
            var table = Table.LoadTable(_dynamoDb, _tableName);
            var document = await table.GetItemAsync(userId);
            return DynamoProfileDocumentFlags.IsAccountClosed(document);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "IsAccountClosedAsync failed for {UserId}", userId);
            return false;
        }
    }

    public async Task<UserProfile> AddPhotoUrlAsync(string userId, string url)
    {
        try
        {
            var profile = await GetProfileAsync(userId) ?? new UserProfile
            {
                UserId = userId,
                Email = string.Empty,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            if (!profile.PhotoUrls.Contains(url))
            {
                profile.PhotoUrls.Add(url);
            }

            profile.UpdatedAt = DateTime.UtcNow;
            EnsureModesArraySynced(profile);
            var table = Table.LoadTable(_dynamoDb, _tableName);
            var document = ProfileToDocument(profile);
            await table.PutItemAsync(document);
            return profile;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error adding photo for user {UserId}", userId);
            throw;
        }
    }

    private Document ProfileToDocument(UserProfile profile)
    {
        var doc = new Document
        {
            ["userId"] = profile.UserId,
            ["email"] = profile.Email,
            ["name"] = profile.Name,
            ["mode"] = profile.Mode,
            ["isComplete"] = profile.IsComplete,
            ["createdAt"] = profile.CreatedAt.ToString("O"),
            ["updatedAt"] = profile.UpdatedAt.ToString("O")
        };
        if (profile.Modes.Count > 0)
            doc["modes"] = new DynamoDBList(profile.Modes.Select(m => new Primitive(ProfileModes.Normalize(m))));
        if (!string.IsNullOrEmpty(profile.WorkoutStyle)) doc["workoutStyle"] = profile.WorkoutStyle;
        if (!string.IsNullOrEmpty(profile.PersonalityTag)) doc["personalityTag"] = profile.PersonalityTag;

        if (!string.IsNullOrEmpty(profile.City)) doc["city"] = profile.City;
        if (!string.IsNullOrEmpty(profile.State)) doc["state"] = profile.State;
        if (!string.IsNullOrEmpty(profile.Country)) doc["country"] = profile.Country;
        if (!string.IsNullOrEmpty(profile.Bio)) doc["bio"] = profile.Bio;
        if (profile.BirthDate.HasValue) doc["birthDate"] = profile.BirthDate.Value.ToString("yyyy-MM-dd");
        if (!string.IsNullOrEmpty(profile.Gender)) doc["gender"] = profile.Gender;
        if (profile.SportTags.Any()) doc["sportTags"] = new DynamoDBList(profile.SportTags.Select(t => new Primitive(t)));
        if (!string.IsNullOrEmpty(profile.Level)) doc["level"] = profile.Level;
        if (profile.Goals.Any()) doc["goals"] = new DynamoDBList(profile.Goals.Select(g => new Primitive(g)));
        if (profile.AvailabilitySchedule.Any())
        {
            // Serialize AvailabilitySchedule as JSON array
            var availabilityJson = JsonSerializer.Serialize(profile.AvailabilitySchedule);
            doc["availabilitySchedule"] = availabilityJson;
        }
        if (profile.Latitude.HasValue) doc["latitude"] = profile.Latitude.Value;
        if (profile.Longitude.HasValue) doc["longitude"] = profile.Longitude.Value;
        if (!string.IsNullOrEmpty(profile.PhotoKey)) doc["photoKey"] = profile.PhotoKey;
        if (profile.PhotoKeys.Any()) doc["photoKeys"] = new DynamoDBList(profile.PhotoKeys.Select(k => new Primitive(k)));
        if (profile.PreferredDistanceMiles.HasValue) doc["preferredDistanceMiles"] = profile.PreferredDistanceMiles.Value;
        if (profile.PhotoUrls.Any()) doc["photoUrls"] = new DynamoDBList(profile.PhotoUrls.Select(u => new Primitive(u)));
        doc["chatNotificationsEnabled"] = profile.ChatNotificationsEnabled;
        if (!string.IsNullOrEmpty(profile.ChatNotificationFrequency))
            doc["chatNotificationFrequency"] = profile.ChatNotificationFrequency;

        doc["discoverCanReviewSkippedProfiles"] = profile.DiscoverCanReviewSkippedProfiles;
        doc["discoverCanReviewLikedProfiles"] = profile.DiscoverCanReviewLikedProfiles;
        doc["discoverCanReplayDiscoverQueue"] = profile.DiscoverCanReplayDiscoverQueue;
        doc["discoverCanRewindLastSkip"] = profile.DiscoverCanRewindLastSkip;
        doc["discoverCanRecycleSkippedProfiles"] = profile.DiscoverCanRecycleSkippedProfiles;

        doc["eventsWaitlistEnabled"] = profile.EventsWaitlistEnabled;
        if (!string.IsNullOrEmpty(profile.EventsCityInterest)) doc["eventsCityInterest"] = profile.EventsCityInterest;
        if (profile.EventsInterestTypes.Count > 0)
            doc["eventsInterestTypes"] = new DynamoDBList(profile.EventsInterestTypes.Select(t => new Primitive(t)));
        if (profile.EventsJoinedWaitlistAt.HasValue)
            doc["eventsJoinedWaitlistAt"] = profile.EventsJoinedWaitlistAt.Value.ToString("O");
        if (profile.EventsNotifiedAt.HasValue)
            doc["eventsNotifiedAt"] = profile.EventsNotifiedAt.Value.ToString("O");
        if (!string.IsNullOrEmpty(profile.EventsCitySuggestion)) doc["eventsCitySuggestion"] = profile.EventsCitySuggestion;
        if (profile.EventsCitySuggestionAt.HasValue)
            doc["eventsCitySuggestionAt"] = profile.EventsCitySuggestionAt.Value.ToString("O");

        return doc;
    }

    private UserProfile DocumentToProfile(Document document)
    {
        // Defensive: old records may lack "mode", "isComplete", "createdAt", "updatedAt"
        var userId = document.ContainsKey("userId") ? document["userId"].AsString() : string.Empty;
        var email = document.ContainsKey("email") ? document["email"].AsString() : string.Empty;
        var name = document.ContainsKey("name") ? document["name"].AsString() : string.Empty;
        var mode = document.ContainsKey("mode") ? document["mode"].AsString() : "TRAIN";
        var isComplete = document.ContainsKey("isComplete") ? document["isComplete"].AsBoolean() : false;
        var createdAt = document.ContainsKey("createdAt") && DateTime.TryParse(document["createdAt"].AsString(), out var ca) ? ca : DateTime.UtcNow;
        var updatedAt = document.ContainsKey("updatedAt") && DateTime.TryParse(document["updatedAt"].AsString(), out var ua) ? ua : DateTime.UtcNow;

        var profile = new UserProfile
        {
            UserId = userId,
            Email = email,
            Name = name,
            City = document.ContainsKey("city") ? document["city"].AsString() : null,
            State = document.ContainsKey("state") ? document["state"].AsString() : null,
            Country = document.ContainsKey("country") ? document["country"].AsString() : "US",
            Bio = document.ContainsKey("bio") ? document["bio"].AsString() : null,
            BirthDate = document.ContainsKey("birthDate") && DateTime.TryParse(document["birthDate"].AsString(), out var bd) ? bd : null,
            Gender = document.ContainsKey("gender") ? document["gender"].AsString() : null,
            SportTags = document.ContainsKey("sportTags") ? document["sportTags"].AsListOfString() : new List<string>(),
            Level = document.ContainsKey("level") ? document["level"].AsString() : null,
            Goals = document.ContainsKey("goals") ?
                (document["goals"] is DynamoDBList goalsList ? goalsList.AsListOfString() :
                 document["goals"].AsString() is string goalsStr && !string.IsNullOrEmpty(goalsStr) ? new List<string> { goalsStr } :
                 new List<string>()) : new List<string>(),
            Mode = mode,
            Modes = document.ContainsKey("modes") && document["modes"] is DynamoDBList modesList
                ? modesList.AsListOfString().Select(ProfileModes.Normalize).Distinct().ToList()
                : new List<string>(),
            WorkoutStyle = document.ContainsKey("workoutStyle") ? document["workoutStyle"].AsString() : null,
            PersonalityTag = document.ContainsKey("personalityTag") ? document["personalityTag"].AsString() : null,
            Latitude = document.ContainsKey("latitude") ? (double?)document["latitude"].AsDouble() : null,
            Longitude = document.ContainsKey("longitude") ? (double?)document["longitude"].AsDouble() : null,
            PhotoKey = document.ContainsKey("photoKey") ? document["photoKey"].AsString() : null,
            PhotoKeys = document.ContainsKey("photoKeys") ? document["photoKeys"].AsListOfString() : new List<string>(),
            PreferredDistanceMiles = document.ContainsKey("preferredDistanceMiles") ? (double?)document["preferredDistanceMiles"].AsDouble() : null,
            PhotoUrls = document.ContainsKey("photoUrls") ? document["photoUrls"].AsListOfString() : new List<string>(),
            IsComplete = isComplete,
            CreatedAt = createdAt,
            UpdatedAt = updatedAt,
            ChatNotificationsEnabled = document.ContainsKey("chatNotificationsEnabled")
                ? document["chatNotificationsEnabled"].AsBoolean()
                : true,
            ChatNotificationFrequency = document.ContainsKey("chatNotificationFrequency")
                ? (document["chatNotificationFrequency"].AsString() ?? "smart")
                : "smart",
            DiscoverCanReviewSkippedProfiles = !document.ContainsKey("discoverCanReviewSkippedProfiles") || document["discoverCanReviewSkippedProfiles"].AsBoolean(),
            DiscoverCanReviewLikedProfiles = !document.ContainsKey("discoverCanReviewLikedProfiles") || document["discoverCanReviewLikedProfiles"].AsBoolean(),
            DiscoverCanReplayDiscoverQueue = document.ContainsKey("discoverCanReplayDiscoverQueue") && document["discoverCanReplayDiscoverQueue"].AsBoolean(),
            DiscoverCanRewindLastSkip = !document.ContainsKey("discoverCanRewindLastSkip") || document["discoverCanRewindLastSkip"].AsBoolean(),
            DiscoverCanRecycleSkippedProfiles = document.ContainsKey("discoverCanRecycleSkippedProfiles") && document["discoverCanRecycleSkippedProfiles"].AsBoolean(),
            EventsWaitlistEnabled = document.ContainsKey("eventsWaitlistEnabled") && document["eventsWaitlistEnabled"].AsBoolean(),
            EventsCityInterest = document.ContainsKey("eventsCityInterest") ? document["eventsCityInterest"].AsString() : null,
            EventsInterestTypes = document.ContainsKey("eventsInterestTypes") && document["eventsInterestTypes"] is DynamoDBList etl
                ? etl.AsListOfString()
                : new List<string>(),
            EventsJoinedWaitlistAt = document.ContainsKey("eventsJoinedWaitlistAt") &&
                DateTime.TryParse(document["eventsJoinedWaitlistAt"].AsString(), out var ej)
                ? ej
                : null,
            EventsNotifiedAt = document.ContainsKey("eventsNotifiedAt") &&
                DateTime.TryParse(document["eventsNotifiedAt"].AsString(), out var en)
                ? en
                : null,
            EventsCitySuggestion = document.ContainsKey("eventsCitySuggestion") ? document["eventsCitySuggestion"].AsString() : null,
            EventsCitySuggestionAt = document.ContainsKey("eventsCitySuggestionAt") &&
                DateTime.TryParse(document["eventsCitySuggestionAt"].AsString(), out var esa)
                ? esa
                : null,
        };

        // Legacy single `mode` → always surface as `modes` array for API/clients (never silently drop multi-intent).
        EnsureModesArraySynced(profile);

        // Handle AvailabilitySchedule - support both old (List<string>) and new (List<AvailabilitySlot>) formats
        if (document.ContainsKey("availabilitySchedule"))
        {
            try
            {
                var availabilityEntry = document["availabilitySchedule"];
                
                // Check if it's a string (JSON serialized)
                if (availabilityEntry is Primitive primitive && primitive.Type == DynamoDBEntryType.String)
                {
                    var availabilityStr = primitive.AsString();
                    if (!string.IsNullOrEmpty(availabilityStr) && availabilityStr.StartsWith("["))
                    {
                        profile.AvailabilitySchedule = JsonSerializer.Deserialize<List<AvailabilitySlot>>(availabilityStr) ?? new List<AvailabilitySlot>();
                    }
                    else
                    {
                        profile.AvailabilitySchedule = new List<AvailabilitySlot>();
                    }
                }
                // Check if it's a DynamoDBList (old format - List<string>)
                else if (availabilityEntry is DynamoDBList)
                {
                    // Old format - convert to empty list (can't convert old format automatically)
                    profile.AvailabilitySchedule = new List<AvailabilitySlot>();
                }
                else
                {
                    profile.AvailabilitySchedule = new List<AvailabilitySlot>();
                }
            }
            catch
            {
                profile.AvailabilitySchedule = new List<AvailabilitySlot>();
            }
        }
        else
        {
            profile.AvailabilitySchedule = new List<AvailabilitySlot>();
        }

        if (!profile.PhotoKeys.Any() && !string.IsNullOrEmpty(profile.PhotoKey))
            profile.PhotoKeys = new List<string> { profile.PhotoKey };

        if (profile.Modes.Count == 0)
            profile.Modes = new List<string> { ProfileModes.Normalize(profile.Mode) };
        else
            profile.Mode = profile.Modes[0];

        return profile;
    }

    private bool IsProfileComplete(UserProfile profile)
    {
        // Required fields for profile completion:
        // 1. Display name (Name)
        // 2. Bio (20-500 characters)
        // 3. At least one training type (SportTags)
        // 4. Skill level
        // 5. At least one availability slot
        
        if (string.IsNullOrWhiteSpace(profile.Name))
            return false;
        
        if (string.IsNullOrWhiteSpace(profile.Bio) || profile.Bio.Length < 20 || profile.Bio.Length > 500)
            return false;
        
        if (!profile.SportTags.Any())
            return false;
        
        if (string.IsNullOrWhiteSpace(profile.Level))
            return false;
        
        if (!profile.AvailabilitySchedule.Any())
            return false;
        
        // Validate availability slots have required fields
        foreach (var slot in profile.AvailabilitySchedule)
        {
            if (!slot.Days.Any() || string.IsNullOrWhiteSpace(slot.TimeStart) || string.IsNullOrWhiteSpace(slot.TimeEnd))
                return false;
        }
        
        return true;
    }
}
