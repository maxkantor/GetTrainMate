namespace GetTrainMate.Api.Constants;

/// <summary>
/// Stable cover photos for seeded dummy users (<c>dummy-user-1</c> … <c>dummy-user-8</c>).
/// Keeps Discover / Skipped / Sent lists distinct; must match <c>apps/web/src/utils/profilePhotos.ts</c> <c>DUMMY_USER_PRIMARY_PHOTO</c>.
/// </summary>
public static class DummyProfilePhotos
{
    public static readonly IReadOnlyDictionary<string, string> PrimaryPhotoByUserId =
        new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["dummy-user-1"] = "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=600&q=80",
            ["dummy-user-2"] = "https://images.unsplash.com/photo-1568602471122-7832951cc4c5?w=600&q=80",
            ["dummy-user-3"] = "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=600&q=80",
            ["dummy-user-4"] = "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600&q=80",
            ["dummy-user-5"] = "https://images.unsplash.com/photo-1622163642998-27549003c62e?w=600&q=80",
            ["dummy-user-6"] = "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=600&q=80",
            ["dummy-user-7"] = "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=600&q=80",
            ["dummy-user-8"] = "https://images.unsplash.com/photo-1530549387789-4c101f663662?w=600&q=80",
        };

    public static List<string> GetPhotoUrls(string userId) =>
        PrimaryPhotoByUserId.TryGetValue(userId, out var url)
            ? new List<string> { url }
            : new List<string>();
}
