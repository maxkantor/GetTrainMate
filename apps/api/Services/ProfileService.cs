using Amazon.DynamoDBv2;
using Amazon.DynamoDBv2.DocumentModel;
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

    public async Task<UserProfile> CreateProfileAsync(UserProfile profile)
    {
        try
        {
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
            if (!string.IsNullOrWhiteSpace(request.Mode)) existingProfile.Mode = request.Mode.Trim();
            if (request.Latitude != null) existingProfile.Latitude = request.Latitude;
            if (request.Longitude != null) existingProfile.Longitude = request.Longitude;
            if (request.PhotoKey != null) existingProfile.PhotoKey = request.PhotoKey.Trim();
            if (request.PreferredDistanceMiles != null) existingProfile.PreferredDistanceMiles = request.PreferredDistanceMiles;

            existingProfile.UpdatedAt = DateTime.UtcNow;
            existingProfile.IsComplete = IsProfileComplete(existingProfile);

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

    public async Task<bool> DeleteProfileAsync(string userId)
    {
        try
        {
            var table = Table.LoadTable(_dynamoDb, _tableName);
            await table.DeleteItemAsync(userId);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting profile for user {UserId}", userId);
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
        if (profile.PreferredDistanceMiles.HasValue) doc["preferredDistanceMiles"] = profile.PreferredDistanceMiles.Value;
        if (profile.PhotoUrls.Any()) doc["photoUrls"] = new DynamoDBList(profile.PhotoUrls.Select(u => new Primitive(u)));

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
            City = document.ContainsKey("city") ? document["city"] : null,
            State = document.ContainsKey("state") ? document["state"] : null,
            Country = document.ContainsKey("country") ? document["country"] : "US",
            Bio = document.ContainsKey("bio") ? document["bio"] : null,
            BirthDate = document.ContainsKey("birthDate") && DateTime.TryParse(document["birthDate"].AsString(), out var bd) ? bd : null,
            Gender = document.ContainsKey("gender") ? document["gender"] : null,
            SportTags = document.ContainsKey("sportTags") ? document["sportTags"].AsListOfString() : new List<string>(),
            Level = document.ContainsKey("level") ? document["level"] : null,
            Goals = document.ContainsKey("goals") ?
                (document["goals"] is DynamoDBList goalsList ? goalsList.AsListOfString() :
                 document["goals"].AsString() is string goalsStr && !string.IsNullOrEmpty(goalsStr) ? new List<string> { goalsStr } :
                 new List<string>()) : new List<string>(),
            Mode = mode,
            Latitude = document.ContainsKey("latitude") ? (double?)document["latitude"].AsDouble() : null,
            Longitude = document.ContainsKey("longitude") ? (double?)document["longitude"].AsDouble() : null,
            PhotoKey = document.ContainsKey("photoKey") ? document["photoKey"] : null,
            PreferredDistanceMiles = document.ContainsKey("preferredDistanceMiles") ? (double?)document["preferredDistanceMiles"].AsDouble() : null,
            PhotoUrls = document.ContainsKey("photoUrls") ? document["photoUrls"].AsListOfString() : new List<string>(),
            IsComplete = isComplete,
            CreatedAt = createdAt,
            UpdatedAt = updatedAt
        };

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
