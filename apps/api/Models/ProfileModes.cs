using System.Linq;

namespace GetTrainMate.Api.Models;

/// <summary>TRAIN / VIBE / DATE — intent modes for discovery and matching.</summary>
public static class ProfileModes
{
    public static readonly HashSet<string> Valid = new(StringComparer.OrdinalIgnoreCase) { "TRAIN", "VIBE", "DATE" };

    public static string Normalize(string? m)
    {
        if (string.IsNullOrWhiteSpace(m)) return "TRAIN";
        var u = m.Trim().ToUpperInvariant();
        return Valid.Contains(u) ? u : "TRAIN";
    }

    public static List<string> GetNormalizedModes(UserProfile p)
    {
        var list = new List<string>();
        if (p.Modes.Count > 0)
        {
            foreach (var m in p.Modes)
                list.Add(Normalize(m));
        }
        else if (!string.IsNullOrEmpty(p.Mode))
            list.Add(Normalize(p.Mode));
        else
            list.Add("TRAIN");
        return list.Distinct().ToList();
    }

    /// <summary>Both users want at least one of the same modes.</summary>
    public static bool HasIntentOverlap(UserProfile a, UserProfile b) =>
        GetNormalizedModes(a).Intersect(GetNormalizedModes(b)).Any();

    /// <summary>Single-mode profiles with the same intent, or identical sorted multi-mode sets.</summary>
    public static bool IsExactIntentAlignment(UserProfile a, UserProfile b)
    {
        var am = GetNormalizedModes(a);
        var bm = GetNormalizedModes(b);
        if (am.Count == 1 && bm.Count == 1 && am[0] == bm[0])
            return true;
        if (am.Count == bm.Count && am.OrderBy(x => x).SequenceEqual(bm.OrderBy(x => x)))
            return true;
        return false;
    }
}
