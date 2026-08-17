using System.Text.RegularExpressions;

namespace GetTrainMate.Api.Services.PartnerOutreach;

/// <summary>Normalize free-text city into a coarse metro label (no coordinates).</summary>
public static class MetroLabelNormalizer
{
    public static string Normalize(string? city)
    {
        if (string.IsNullOrWhiteSpace(city)) return "";
        var s = city.Trim().ToLowerInvariant();
        s = Regex.Replace(s, @"[^a-z0-9\s]", " ");
        s = Regex.Replace(s, @"\s+", " ").Trim();
        if (s is "atl" or "atlanta"
            || s.StartsWith("atlanta ", StringComparison.Ordinal)
            || s.Contains("atlanta ga", StringComparison.Ordinal)
            || s.Contains("atlanta georgia", StringComparison.Ordinal))
            return "Atlanta";
        if (s is "miami" || s.StartsWith("miami ", StringComparison.Ordinal)
            || s.Contains("fort lauderdale", StringComparison.Ordinal)
            || s.Contains("ft lauderdale", StringComparison.Ordinal))
            return "Miami / Fort Lauderdale";
        if (s is "tampa" || s.StartsWith("tampa ", StringComparison.Ordinal)) return "Tampa";
        if (s is "nyc" or "new york" or "new york city"
            || s.StartsWith("new york ", StringComparison.Ordinal))
            return "New York";
        if (s is "london" || s.StartsWith("london ", StringComparison.Ordinal)
            || s.Contains("london uk", StringComparison.Ordinal)
            || s.Contains("london england", StringComparison.Ordinal))
            return "London";
        if (s is "toronto" || s.StartsWith("toronto ", StringComparison.Ordinal)
            || s.Contains("toronto on", StringComparison.Ordinal)
            || s.Contains("toronto ontario", StringComparison.Ordinal))
            return "Toronto";
        if (s is "dallas" || s.StartsWith("dallas ", StringComparison.Ordinal)) return "Dallas";
        if (s is "chicago" || s.StartsWith("chicago ", StringComparison.Ordinal)) return "Chicago";
        var parts = s.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length == 0) return "";
        return string.Join(' ', parts.Take(3).Select(p => char.ToUpperInvariant(p[0]) + p[1..]));
    }
}
