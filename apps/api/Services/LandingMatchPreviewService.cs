using Amazon.DynamoDBv2;
using Amazon.DynamoDBv2.Model;
using GetTrainMate.Api.Models;

namespace GetTrainMate.Api.Services;

/// <summary>
/// Pre-signup match preview: scans complete profiles, filters by sport/level/schedule overlap.
/// Never returns distance or city. Demo/empty states per product rules.
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

        var completePool = await ScanCompleteProfilesAsync(cancellationToken).ConfigureAwait(false);

        if (completePool.Count == 0)
        {
            return new LandingMatchPreviewResponse { Kind = "empty", MatchCount = 0, Users = Array.Empty<LandingMatchPreviewUserDto>() };
        }

        var matches = completePool
            .Where(p => SportMatches(p, sportTag))
            .Where(p => LevelMatches(p, visitorLevel))
            .Where(p => ScheduleOverlaps(p, visitorWindow))
            .OrderByDescending(p => p.UpdatedAt)
            .Take(3)
            .ToList();

        if (matches.Count > 0)
        {
            var dtos = new List<LandingMatchPreviewUserDto>();
            foreach (var p in matches)
                dtos.Add(await MapToDtoAsync(p, cancellationToken).ConfigureAwait(false));

            return new LandingMatchPreviewResponse
            {
                Kind = "real",
                MatchCount = dtos.Count,
                Users = dtos,
            };
        }

        return new LandingMatchPreviewResponse
        {
            Kind = "demo",
            MatchCount = 1,
            ExampleLabel = "Example match based on your preferences",
            Users = new[] { BuildDemoUser() },
        };
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

    private Task<LandingMatchPreviewUserDto> MapToDtoAsync(UserProfile p, CancellationToken ct)
    {
        var key = p.PhotoKeys.FirstOrDefault() ?? p.PhotoKey;
        string? photoUrl = null;
        if (!string.IsNullOrEmpty(key))
        {
            try
            {
                photoUrl = _storage.GetPresignedDownloadUrl(key, TimeSpan.FromHours(1));
            }
            catch (Exception ex)
            {
                _logger.LogDebug(ex, "Presign preview photo for {UserId}", p.UserId);
            }
        }

        return Task.FromResult(new LandingMatchPreviewUserDto
        {
            Name = p.Name.Trim(),
            Age = ComputeAge(p.BirthDate),
            TrainingSummary = BuildTrainingSummary(p),
            GoalLine = BuildGoalLine(p),
            PhotoUrl = photoUrl,
        });
    }

    private static LandingMatchPreviewUserDto BuildDemoUser() => new()
    {
        Name = "Alex Drogba",
        Age = 29,
        TrainingSummary = "Gym / Cross-training",
        GoalLine = "Strength & conditioning",
        PhotoUrl = "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=400&h=400&fit=crop&crop=faces",
    };

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
