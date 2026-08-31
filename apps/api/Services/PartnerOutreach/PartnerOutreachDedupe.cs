using GetTrainMate.Api.Models;

namespace GetTrainMate.Api.Services.PartnerOutreach;

/// <summary>Shared prospect/queue matching for discovery, create, and admin cleanup.</summary>
public static class PartnerOutreachDedupe
{
    public static string NormalizeWebsite(string? url)
    {
        if (string.IsNullOrWhiteSpace(url)) return "";
        var trimmed = url.Trim();
        if (!Uri.TryCreate(trimmed, UriKind.Absolute, out var uri))
            return trimmed.ToLowerInvariant();
        var host = uri.Host.ToLowerInvariant();
        if (host.StartsWith("www.", StringComparison.Ordinal))
            host = host[4..];
        var path = uri.AbsolutePath.TrimEnd('/');
        if (path == "/") path = "";
        return host + path;
    }

    public static string NormalizeEmail(string? email) =>
        string.IsNullOrWhiteSpace(email) ? "" : email.Trim().ToLowerInvariant();

    public static string NormalizeOrgName(string? name) =>
        string.IsNullOrWhiteSpace(name) ? "" : name.Trim().ToLowerInvariant();

    public static string ProspectKey(PartnerProspect p)
    {
        var email = NormalizeEmail(p.Email);
        if (email.Contains('@'))
            return $"email:{email}|{NormalizeCampaign(p.CampaignId)}";
        var site = NormalizeWebsite(p.Website);
        if (!string.IsNullOrWhiteSpace(site))
            return $"site:{site}|{NormalizeCampaign(p.CampaignId)}";
        var code = (p.PartnerCode ?? "").Trim().ToLowerInvariant();
        if (!string.IsNullOrWhiteSpace(code))
            return $"code:{code}|{NormalizeCampaign(p.CampaignId)}";
        return $"org:{NormalizeOrgName(p.OrganizationName)}|{NormalizeCampaign(p.CampaignId)}";
    }

    public static string ProspectKey(string? email, string? website, string? partnerCode, string? orgName, string? campaignId)
    {
        var normalizedEmail = NormalizeEmail(email);
        if (normalizedEmail.Contains('@'))
            return $"email:{normalizedEmail}|{NormalizeCampaign(campaignId)}";
        var site = NormalizeWebsite(website);
        if (!string.IsNullOrWhiteSpace(site))
            return $"site:{site}|{NormalizeCampaign(campaignId)}";
        var code = (partnerCode ?? "").Trim().ToLowerInvariant();
        if (!string.IsNullOrWhiteSpace(code))
            return $"code:{code}|{NormalizeCampaign(campaignId)}";
        return $"org:{NormalizeOrgName(orgName)}|{NormalizeCampaign(campaignId)}";
    }

    public static string QueueKey(PartnerQueueItem q) =>
        $"email:{NormalizeEmail(q.Recipient)}|{NormalizeCampaign(q.CampaignId)}";

    public static bool MatchesProspect(PartnerProspect existing, PartnerProspect candidate) =>
        ProspectKey(existing) == ProspectKey(candidate);

    public static bool MatchesDiscoveredOrg(PartnerProspect existing, DiscoveredOrganization org, string campaignId)
    {
        var key = ProspectKey(
            existing.Email,
            existing.Website,
            existing.PartnerCode,
            existing.OrganizationName,
            existing.CampaignId ?? campaignId);
        var orgKey = ProspectKey(
            null,
            org.Website,
            org.PartnerCode,
            org.OrganizationName,
            campaignId);
        if (key == orgKey) return true;

        if (!string.IsNullOrWhiteSpace(org.PartnerCode)
            && string.Equals(existing.PartnerCode, org.PartnerCode, StringComparison.OrdinalIgnoreCase))
            return true;
        if (!string.IsNullOrWhiteSpace(org.Website)
            && NormalizeWebsite(existing.Website) == NormalizeWebsite(org.Website))
            return true;
        return string.Equals(existing.OrganizationName, org.OrganizationName, StringComparison.OrdinalIgnoreCase);
    }

    public static int ProspectRank(string? status) => (status ?? "").ToLowerInvariant() switch
    {
        "approved" => 60,
        "queued" => 50,
        "sent" => 45,
        "replied" => 40,
        "draft" => 30,
        "prospect" => 20,
        "discovered" => 10,
        _ => 0,
    };

    public static int QueueRank(string? status) => (status ?? "").ToLowerInvariant() switch
    {
        "approved" => 60,
        "queued" => 50,
        "sent" => 45,
        "replied" => 40,
        "draft" => 30,
        _ => 0,
    };

    public static PartnerProspect PickBestProspect(IEnumerable<PartnerProspect> group) =>
        group
            .OrderByDescending(p => ProspectRank(p.Status))
            .ThenByDescending(p => !string.IsNullOrWhiteSpace(p.Email))
            .ThenByDescending(p => p.CreatedAt)
            .First();

    public static PartnerQueueItem PickBestQueueItem(IEnumerable<PartnerQueueItem> group) =>
        group
            .OrderByDescending(q => QueueRank(q.Status))
            .ThenByDescending(q => q.CreatedAt)
            .First();

    static string NormalizeCampaign(string? campaignId) =>
        string.IsNullOrWhiteSpace(campaignId) ? "" : campaignId.Trim().ToLowerInvariant();
}
