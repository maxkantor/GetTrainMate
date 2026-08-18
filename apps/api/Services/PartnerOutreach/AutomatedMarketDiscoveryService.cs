using GetTrainMate.Api.Models;

namespace GetTrainMate.Api.Services.PartnerOutreach;

public sealed class AutomatedMarketDiscoveryService
{
    readonly IPartnerOutreachService _outreach;
    readonly OverpassFitnessDiscoveryProvider _overpass;
    readonly PublicBusinessContactVerifier _contactVerifier;
    readonly ILogger<AutomatedMarketDiscoveryService> _log;

    public AutomatedMarketDiscoveryService(
        IPartnerOutreachService outreach,
        OverpassFitnessDiscoveryProvider overpass,
        PublicBusinessContactVerifier contactVerifier,
        ILogger<AutomatedMarketDiscoveryService> log)
    {
        _outreach = outreach;
        _overpass = overpass;
        _contactVerifier = contactVerifier;
        _log = log;
    }

    public async Task<DiscoveryRunReport> RunAsync(
        bool prepareDrafts = true,
        int maxPerMarket = 35,
        CancellationToken ct = default)
    {
        var report = new DiscoveryRunReport { StartedAtUtc = DateTime.UtcNow };
        var campaigns = await _outreach.ListCampaignsAsync();
        var existing = await _outreach.ListProspectsAsync(null);
        var evidence = await BuildEvidenceAsync(campaigns, existing);
        report.MarketsEvaluated = MarketCampaignCatalog.Candidates.Count;

        var targets = MarketRanker.SelectDiscoveryTargets(
            MarketCampaignCatalog.Candidates,
            campaigns,
            evidence,
            MarketCampaignCatalog.MaxActiveMarkets).ToList();

        report.MarketsActivated = targets.Count(c =>
            campaigns.FirstOrDefault(x => x.CampaignId == c.CampaignId)?.Status == "active");

        foreach (var seed in targets)
        {
            ct.ThrowIfCancellationRequested();
            var marketReport = new DiscoveryMarketReport
            {
                CampaignId = seed.CampaignId,
                Country = seed.Country,
                Market = seed.Market,
                DisplayName = seed.DisplayName,
            };

            // Seed catalog (verified official websites; emails verified automatically)
            var orgs = new List<DiscoveredOrganization>();
            if (seed.Country == "us" && seed.Market == "atlanta")
            {
                foreach (var s in MarketCampaignCatalog.AtlantaTrainOrgWebsites)
                {
                    orgs.Add(new DiscoveredOrganization
                    {
                        OrganizationName = s.OrganizationName,
                        OrganizationType = s.OrganizationType,
                        Website = s.Website,
                        Country = seed.Country,
                        Market = seed.Market,
                        CampaignId = seed.CampaignId,
                        DisplayName = seed.DisplayName,
                        Timezone = seed.Timezone,
                        PrimaryLanguage = "en",
                        DiscoverySource = "seed_catalog",
                        PartnerCode = s.PartnerCode,
                    });
                }
            }

            var overpass = await _overpass.DiscoverAsync(seed, maxPerMarket, ct);
            orgs.AddRange(overpass);
            marketReport.OrganizationsDiscovered = orgs.Count;

            foreach (var org in orgs)
            {
                ct.ThrowIfCancellationRequested();
                if (IsDuplicate(existing, org))
                {
                    marketReport.SkippedDuplicate++;
                    continue;
                }

                var partnerCode = org.PartnerCode ?? GeneratePartnerCode(seed, org);
                var landing = "https://gettrainmate.com" + MarketCampaignCatalog.PartnerPath(seed.Country, seed.Market, partnerCode);
                var lang = org.PrimaryLanguage;
                if (!MarketCampaignCatalog.IsApprovedOutreachLanguage(lang))
                    lang = seed.Languages?.FirstOrDefault(l => MarketCampaignCatalog.IsApprovedOutreachLanguage(l)) ?? "en";

                var prospect = new PartnerProspect
                {
                    OrganizationName = org.OrganizationName,
                    OrganizationType = org.OrganizationType,
                    Website = org.Website,
                    Country = seed.Country,
                    City = seed.DisplayName,
                    Metro = seed.DisplayName,
                    Timezone = seed.Timezone,
                    PrimaryLanguage = org.PrimaryLanguage,
                    CampaignLanguage = lang,
                    Mode = "TRAIN",
                    CampaignId = seed.CampaignId,
                    Activity = ActivityForType(org.OrganizationType),
                    PartnerCode = partnerCode,
                    LandingUrl = landing,
                    DiscoverySource = org.DiscoverySource,
                    EmailSource = "public_listing",
                };

                VerifiedPublicContact? verified = null;
                if (Uri.TryCreate(org.Website, UriKind.Absolute, out var siteUri))
                    verified = await _contactVerifier.TryVerifyAsync(siteUri, ct);

                if (verified != null)
                {
                    prospect.Email = verified.Email;
                    prospect.SourceUrl = verified.SourceUrl;
                    prospect.SourceVerifiedOn = verified.VerifiedOnUtc.ToString("yyyy-MM-dd");
                    prospect.EmailVerifiedOn = verified.VerifiedOnUtc.ToString("yyyy-MM-dd");
                    prospect.OfficialDomain = verified.Email.Split('@')[1];
                    prospect.EmailVerificationStatus = "verified_public";
                    prospect.Status = "prospect";
                    prospect.FitScore = ScoreProspect(org, hasEmail: true);
                    marketReport.VerifiedPublicContacts++;
                    report.VerifiedPublicContacts++;
                }
                else
                {
                    prospect.Email = "";
                    prospect.SourceUrl = org.Website;
                    prospect.EmailVerificationStatus = "no_verified_public_email";
                    prospect.Status = "no_verified_public_email";
                    prospect.FitScore = ScoreProspect(org, hasEmail: false);
                    marketReport.ContactsUnavailable++;
                    report.ContactsUnavailable++;
                }

                try
                {
                    var saved = await _outreach.CreateProspectAsync(prospect, "automated_discovery");
                    existing.Add(saved);
                    marketReport.ProspectsCreated++;
                    report.OrganizationsDiscovered++;
                    report.InviteCodesGenerated++;

                    if (saved.Status == "prospect" && prepareDrafts)
                    {
                        if (!MarketCampaignCatalog.IsApprovedOutreachLanguage(saved.CampaignLanguage))
                        {
                            await _outreach.UpdateProspectAsync(saved.ProspectId, new PartnerProspect
                            {
                                Status = "qualified_language_unavailable",
                                Notes = "Qualified prospect — language template unavailable",
                            });
                            marketReport.LanguageTemplateUnavailable++;
                            report.LanguageTemplateUnavailable++;
                        }
                        else
                        {
                            try
                            {
                                await _outreach.CreateDraftAndQueuePreviewAsync(saved.ProspectId, seed.CampaignId);
                                marketReport.DraftsGenerated++;
                                report.DraftsGenerated++;
                                report.ApprovalReadyRecipients++;
                            }
                            catch (Exception ex)
                            {
                                _log.LogDebug(ex, "Draft not queued for {Org}", org.OrganizationName);
                            }
                        }
                    }

                    if (saved.Status is "prospect" or "draft")
                    {
                        marketReport.QualifiedOrganizations++;
                        report.QualifiedOrganizations++;
                    }
                }
                catch (Exception ex)
                {
                    _log.LogWarning(ex, "Prospect create failed for {Org}", org.OrganizationName);
                    marketReport.Errors++;
                }
            }

            report.Markets.Add(marketReport);
        }

        report.CompletedAtUtc = DateTime.UtcNow;
        return report;
    }

    static async Task<List<MarketRanker.MarketEvidenceRow>> BuildEvidenceAsync(
        List<PartnerCampaign> campaigns,
        List<PartnerProspect> prospects)
    {
        var rows = new List<MarketRanker.MarketEvidenceRow>();
        foreach (var seed in MarketCampaignCatalog.Candidates)
        {
            var metro = seed.DisplayName;
            var qualified = prospects.Count(p =>
                string.Equals(p.CampaignId, seed.CampaignId, StringComparison.OrdinalIgnoreCase)
                && p.Status is "prospect" or "draft" or "approved");
            rows.Add(new MarketRanker.MarketEvidenceRow
            {
                CampaignId = seed.CampaignId,
                Country = seed.Country,
                Market = seed.Market,
                DisplayName = seed.DisplayName,
                QualifiedOrganizations = qualified,
                LanguageSupported = seed.Languages.Any(MarketCampaignCatalog.IsApprovedOutreachLanguage),
                FounderAdvantage = seed.Market == "atlanta",
            });
        }
        await Task.CompletedTask;
        return rows;
    }

    static bool IsDuplicate(List<PartnerProspect> existing, DiscoveredOrganization org)
    {
        return existing.Any(p =>
            string.Equals(p.Website, org.Website, StringComparison.OrdinalIgnoreCase)
            || string.Equals(p.OrganizationName, org.OrganizationName, StringComparison.OrdinalIgnoreCase)
            || (!string.IsNullOrWhiteSpace(org.PartnerCode)
                && string.Equals(p.PartnerCode, org.PartnerCode, StringComparison.OrdinalIgnoreCase)));
    }

    static string GeneratePartnerCode(MarketCampaignSeed seed, DiscoveredOrganization org)
    {
        var slug = MarketCampaignCatalog.Slug(org.OrganizationName);
        if (slug.Length > 32) slug = slug[..32].Trim('-');
        return $"{seed.Country}-{seed.Market}-{slug}".Trim('-');
    }

    static int ScoreProspect(DiscoveredOrganization org, bool hasEmail)
    {
        var score = 10;
        if (hasEmail) score += 50;
        if (org.DiscoverySource == "seed_catalog") score += 15;
        if (org.OrganizationType is "run_club" or "gym") score += 5;
        return score;
    }

    static string ActivityForType(string orgType) => orgType switch
    {
        "run_club" => "running",
        "pickleball" => "pickleball",
        "cycling" => "cycling",
        "crossfit_hyrox" => "training",
        "personal_trainer" => "training",
        _ => "training",
    };
}

public sealed class DiscoveryRunReport
{
    public DateTime StartedAtUtc { get; set; }
    public DateTime CompletedAtUtc { get; set; }
    public int MarketsEvaluated { get; set; }
    public int MarketsActivated { get; set; }
    public int OrganizationsDiscovered { get; set; }
    public int QualifiedOrganizations { get; set; }
    public int VerifiedPublicContacts { get; set; }
    public int ContactsUnavailable { get; set; }
    public int InviteCodesGenerated { get; set; }
    public int DraftsGenerated { get; set; }
    public int ApprovalReadyRecipients { get; set; }
    public int LanguageTemplateUnavailable { get; set; }
    public List<DiscoveryMarketReport> Markets { get; set; } = new();
}

public sealed class DiscoveryMarketReport
{
    public string CampaignId { get; set; } = "";
    public string Country { get; set; } = "";
    public string Market { get; set; } = "";
    public string DisplayName { get; set; } = "";
    public int OrganizationsDiscovered { get; set; }
    public int ProspectsCreated { get; set; }
    public int QualifiedOrganizations { get; set; }
    public int VerifiedPublicContacts { get; set; }
    public int ContactsUnavailable { get; set; }
    public int DraftsGenerated { get; set; }
    public int SkippedDuplicate { get; set; }
    public int LanguageTemplateUnavailable { get; set; }
    public int Errors { get; set; }
}
