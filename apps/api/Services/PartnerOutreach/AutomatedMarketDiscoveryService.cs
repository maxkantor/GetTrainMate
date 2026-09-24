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

    public Task<DiscoveryRunReport> RunAsync(
        bool prepareDrafts = true,
        int maxPerMarket = 35,
        bool seedsOnly = false,
        string? onlyCampaignId = null,
        string? onlyPartnerCode = null,
        CancellationToken ct = default)
        => RunInternalAsync(
            prepareDrafts,
            maxPerMarket,
            seedsOnly,
            onlyCampaignId,
            onlyPartnerCode,
            maxProspects: null,
            maxResearchAttempts: null,
            maxDrafts: null,
            ct);

    /// <summary>
    /// Lambda-safe limited discovery: stops when prospect/research/draft caps are hit.
    /// Each prospect is persisted as found via CreateProspectAsync.
    /// </summary>
    public Task<DiscoveryRunReport> RunLimitedAsync(
        int maxProspects,
        int maxResearchAttempts,
        int maxDrafts,
        string? onlyCampaignId = null,
        bool seedsOnly = false,
        bool prepareDrafts = true,
        CancellationToken ct = default)
        => RunInternalAsync(
            prepareDrafts,
            maxPerMarket: Math.Max(maxProspects, 5),
            seedsOnly,
            onlyCampaignId,
            onlyPartnerCode: null,
            maxProspects,
            maxResearchAttempts,
            maxDrafts,
            ct);

    async Task<DiscoveryRunReport> RunInternalAsync(
        bool prepareDrafts,
        int maxPerMarket,
        bool seedsOnly,
        string? onlyCampaignId,
        string? onlyPartnerCode,
        int? maxProspects,
        int? maxResearchAttempts,
        int? maxDrafts,
        CancellationToken ct)
    {
        var report = new DiscoveryRunReport { StartedAtUtc = DateTime.UtcNow, SeedsOnly = seedsOnly };
        var campaigns = await _outreach.ListCampaignsAsync();
        var existing = await _outreach.ListProspectsAsync(null);
        var evidence = await BuildEvidenceAsync(campaigns, existing);
        report.MarketsEvaluated = MarketCampaignCatalog.Candidates.Count;

        var targets = MarketRanker.SelectDiscoveryTargets(
            MarketCampaignCatalog.Candidates,
            campaigns,
            evidence,
            MarketCampaignCatalog.MaxActiveMarkets).ToList();

        if (!string.IsNullOrWhiteSpace(onlyCampaignId))
        {
            targets = targets
                .Where(t => string.Equals(t.CampaignId, onlyCampaignId.Trim(), StringComparison.OrdinalIgnoreCase))
                .ToList();
        }

        report.MarketsActivated = targets.Count(c =>
            campaigns.FirstOrDefault(x => x.CampaignId == c.CampaignId)?.Status == "active");

        var contactPathLimit = seedsOnly ? 2 : (int?)null;
        var researchAttempts = 0;
        var prospectsCreated = 0;
        var draftsCreated = 0;
        var hitLimit = false;

        foreach (var seed in targets)
        {
            if (hitLimit) break;
            ct.ThrowIfCancellationRequested();
            var marketReport = new DiscoveryMarketReport
            {
                CampaignId = seed.CampaignId,
                Country = seed.Country,
                Market = seed.Market,
                DisplayName = seed.DisplayName,
            };

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

            var overpass = seedsOnly
                ? Array.Empty<DiscoveredOrganization>()
                : await _overpass.DiscoverAsync(seed, maxPerMarket, ct);
            orgs.AddRange(overpass);
            if (!string.IsNullOrWhiteSpace(onlyPartnerCode))
            {
                orgs = orgs
                    .Where(o => string.Equals(o.PartnerCode, onlyPartnerCode.Trim(), StringComparison.OrdinalIgnoreCase))
                    .ToList();
            }
            marketReport.OrganizationsDiscovered = orgs.Count;

            foreach (var org in orgs)
            {
                if (maxProspects.HasValue && prospectsCreated >= maxProspects.Value)
                {
                    hitLimit = true;
                    report.StoppedReason = "max_prospects";
                    break;
                }
                if (maxResearchAttempts.HasValue && researchAttempts >= maxResearchAttempts.Value)
                {
                    hitLimit = true;
                    report.StoppedReason = "max_research_attempts";
                    break;
                }
                if (maxDrafts.HasValue && draftsCreated >= maxDrafts.Value && prepareDrafts)
                {
                    // Still allow creating prospects without drafts once draft cap is hit
                }

                ct.ThrowIfCancellationRequested();
                if (existing.Any(p => PartnerOutreachDedupe.MatchesDiscoveredOrg(p, org, seed.CampaignId)))
                {
                    marketReport.SkippedDuplicate++;
                    continue;
                }

                var partnerCode = org.PartnerCode ?? GeneratePartnerCode(seed, org);
                var landing = "https://gettrainmate.com" + MarketCampaignCatalog.PartnerPath(seed.Country, seed.Market, partnerCode);
                var lang = org.PrimaryLanguage;
                if (!MarketCampaignCatalog.IsApprovedOutreachLanguage(lang))
                    lang = seed.Languages?.FirstOrDefault(l => MarketCampaignCatalog.IsApprovedOutreachLanguage(l)) ?? "en";

                researchAttempts++;
                report.ResearchAttempts = researchAttempts;

                VerifiedPublicContact? verified = null;
                if (Uri.TryCreate(org.Website, UriKind.Absolute, out var siteUri))
                    verified = await _contactVerifier.TryVerifyAsync(siteUri, ct, contactPathLimit);

                var hasEmail = verified != null;
                var scored = ScoreProspect(org, hasEmail);

                var modes = PartnerAudience.RelevantModesFor(org.OrganizationType, org.OrganizationName);
                var prospect = new PartnerProspect
                {
                    OrganizationName = org.OrganizationName,
                    OrganizationType = org.OrganizationType,
                    ProspectCategory = org.OrganizationType,
                    ProspectType = "organization",
                    Website = org.Website,
                    Country = seed.Country,
                    Region = seed.Country == "us" ? seed.Market : seed.Country,
                    City = seed.DisplayName,
                    Metro = seed.DisplayName,
                    Timezone = seed.Timezone,
                    PrimaryLanguage = org.PrimaryLanguage,
                    CampaignLanguage = lang,
                    Mode = PartnerAudience.PrimaryModeFor(modes),
                    RelevantModes = modes.ToList(),
                    CampaignId = seed.CampaignId,
                    Activity = ActivityForType(org.OrganizationType),
                    PartnerCode = partnerCode,
                    LandingUrl = landing,
                    DiscoverySource = org.DiscoverySource,
                    DiscoverySourceUrl = org.Website,
                    EmailSource = "public_listing",
                    FirstDiscoveredAt = DateTime.UtcNow,
                    LastEvaluatedAt = DateTime.UtcNow,
                    DiscoveryCount = 1,
                    AcquisitionScore = scored.AcquisitionScore,
                    AudienceFitScore = scored.AudienceFitScore,
                    MarketRelevanceScore = scored.MarketRelevanceScore,
                    CommunityFitScore = scored.CommunityFitScore,
                    ContactQualityScore = scored.ContactQualityScore,
                    HistoricalCategoryScore = scored.HistoricalCategoryScore,
                    ScoreExplanation = scored.ScoreExplanation,
                    FitScore = scored.AcquisitionScore,
                    CrmLifecycle = PartnerCrmLifecycle.New,
                    ContactState = PartnerCrmLifecycle.ContactUnknown,
                };

                if (verified != null)
                {
                    prospect.Email = verified.Email;
                    prospect.EmailNormalized = verified.Email.Trim().ToLowerInvariant();
                    prospect.EmailSource = "public_listing";
                    prospect.EmailSourceUrl = verified.SourceUrl;
                    prospect.EmailDiscoveryMethod = verified.SourceType ?? "website_page";
                    prospect.EmailValidationStatus = "verified_public";
                    prospect.EmailDiscoveredAt = DateTime.UtcNow;
                    prospect.SourceUrl = verified.SourceUrl;
                    prospect.ContactSourceUrl = verified.SourceUrl;
                    prospect.ContactSourceType = verified.SourceType ?? "website_page";
                    if (!string.IsNullOrWhiteSpace(verified.ContactName))
                        prospect.ContactName = verified.ContactName;
                    prospect.SourceVerifiedOn = verified.VerifiedOnUtc.ToString("yyyy-MM-dd");
                    prospect.EmailVerifiedOn = verified.VerifiedOnUtc.ToString("yyyy-MM-dd");
                    prospect.OfficialDomain = verified.Email.Split('@')[1];
                    prospect.EmailVerificationStatus = "verified_public";
                    prospect.ContactDiscoveryStatus = ContactDiscoveryRules.DiscoveryEmailFound;
                    prospect.Status = "prospect";
                    prospect.CrmLifecycle = PartnerCrmLifecycle.Qualified;
                    prospect.ContactState = PartnerCrmLifecycle.ContactFound;
                    prospect.ContactabilityState = PartnerCrmLifecycle.ContactFound;
                    prospect.ContactabilityScore = scored.ContactQualityScore;
                    prospect.QualificationScore = scored.AcquisitionScore;
                    prospect.QualificationReasons = scored.ScoreExplanation;
                    if (PartnerAudience.IsQualified(scored.AcquisitionScore, PartnerOutreachRules.DefaultMinAcquisitionScore))
                        prospect.QualifiedAt = DateTime.UtcNow;
                    marketReport.VerifiedPublicContacts++;
                    report.VerifiedPublicContacts++;
                }
                else
                {
                    prospect.Email = "";
                    prospect.SourceUrl = org.Website;
                    prospect.EmailVerificationStatus = "no_verified_public_email";
                    prospect.EmailValidationStatus = "NO_PUBLIC_EMAIL_FOUND";
                    prospect.EmailDiscoveryMethod = "website_probe";
                    prospect.ContactDiscoveryStatus = ContactDiscoveryRules.DiscoveryNoPublicContact;
                    prospect.Status = "no_verified_public_email";
                    prospect.CrmLifecycle = PartnerCrmLifecycle.New;
                    prospect.ContactState = PartnerCrmLifecycle.ContactNeeded;
                    prospect.ContactabilityState = PartnerCrmLifecycle.ContactNeeded;
                    prospect.ContactabilityScore = 0;
                    prospect.NextResearchAt = DateTime.UtcNow.AddDays(7);
                    marketReport.ContactsUnavailable++;
                    report.ContactsUnavailable++;
                }

                prospect.ProspectKind = PartnerCrmLifecycle.NormalizeProspectKind(org.OrganizationType);
                prospect.ResearchAttempts = 1;
                prospect.LastResearchAt = DateTime.UtcNow;

                try
                {
                    var saved = await _outreach.CreateProspectAsync(prospect, "automated_discovery");
                    existing.Add(saved);
                    prospectsCreated++;
                    marketReport.ProspectsCreated++;
                    report.OrganizationsDiscovered++;
                    report.InviteCodesGenerated++;

                    var canDraft = prepareDrafts
                        && saved.Status == "prospect"
                        && (!maxDrafts.HasValue || draftsCreated < maxDrafts.Value);

                    if (canDraft)
                    {
                        if (!MarketCampaignCatalog.IsApprovedOutreachLanguage(saved.CampaignLanguage))
                        {
                            await _outreach.UpdateProspectAsync(saved.ProspectId, new PartnerProspect
                            {
                                Status = "qualified_language_unavailable",
                                Notes = "Qualified prospect — language template unavailable",
                                CrmLifecycle = PartnerCrmLifecycle.Qualified,
                            });
                            marketReport.LanguageTemplateUnavailable++;
                            report.LanguageTemplateUnavailable++;
                        }
                        else
                        {
                            try
                            {
                                await _outreach.CreateDraftAndQueuePreviewAsync(saved.ProspectId, seed.CampaignId);
                                draftsCreated++;
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
        report.HitLimit = hitLimit;
        return report;
    }

    static async Task<List<MarketRanker.MarketEvidenceRow>> BuildEvidenceAsync(
        List<PartnerCampaign> campaigns,
        List<PartnerProspect> prospects)
    {
        var rows = new List<MarketRanker.MarketEvidenceRow>();
        foreach (var seed in MarketCampaignCatalog.Candidates)
        {
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

    static string GeneratePartnerCode(MarketCampaignSeed seed, DiscoveredOrganization org)
    {
        var slug = MarketCampaignCatalog.Slug(org.OrganizationName);
        if (slug.Length > 32) slug = slug[..32].Trim('-');
        return $"{seed.Country}-{seed.Market}-{slug}".Trim('-');
    }

    /// <summary>
    /// Customer-acquisition likelihood 0–100 from audience + market + community + historical only.
    /// Contact quality is scored separately (ContactQualityScore / ContactabilityScore) and never
    /// mixed into AcquisitionScore. Prefers pickleball/clubs/creators/community over generic gyms.
    /// </summary>
    public static AcquisitionScoreResult ScoreProspect(DiscoveredOrganization org, bool hasEmail)
    {
        var type = (org.OrganizationType ?? "").Trim().ToLowerInvariant();
        var name = (org.OrganizationName ?? "").ToLowerInvariant();
        var source = (org.DiscoverySource ?? "").Trim().ToLowerInvariant();

        // Audience fit (0–30)
        var audience = type switch
        {
            "pickleball" => 30,
            "run_club" => 28,
            "cycling" => 26,
            "crossfit_hyrox" or "rec_sports" or "soccer" or "volleyball" or "tennis" or "swimming" => 24,
            "personal_trainer" => 22,
            "creator" or "influencer" or "community" => 27,
            "gym" => 16,
            _ => 14
        };
        if (name.Contains("pickleball") || name.Contains("pickle")) audience = Math.Max(audience, 30);
        if (name.Contains("club") || name.Contains("crew") || name.Contains("community")) audience = Math.Min(30, audience + 2);
        if (name.Contains("planet fitness") || name.Contains("la fitness") || name.Contains("24 hour"))
            audience = Math.Min(audience, 12);

        // Market relevance (0–25)
        var market = 12;
        if (source == "seed_catalog") market = 25;
        else if (source.Contains("overpass") || source.Contains("osm")) market = 15;
        if (string.Equals(org.Market, "atlanta", StringComparison.OrdinalIgnoreCase)) market = Math.Min(25, market + 3);

        // Community fit (0–25)
        var community = type switch
        {
            "run_club" or "pickleball" or "cycling" or "rec_sports" => 25,
            "creator" or "influencer" or "community" => 24,
            "crossfit_hyrox" or "soccer" or "volleyball" or "tennis" or "swimming" => 22,
            "personal_trainer" => 16,
            "gym" => 12,
            _ => 13
        };
        if (name.Contains("community") || name.Contains("collective") || name.Contains("social"))
            community = Math.Min(25, community + 2);

        // Historical category (0–20)
        var historical = type switch
        {
            "pickleball" => 20,
            "run_club" => 18,
            "cycling" or "rec_sports" => 15,
            "crossfit_hyrox" => 14,
            "creator" or "community" => 16,
            "personal_trainer" => 11,
            "gym" => 7,
            _ => 6
        };

        // Contactability is separate — never folded into AcquisitionScore
        var contact = hasEmail ? 90 : 0;
        if (hasEmail && source == "seed_catalog") contact = 95;

        var acquisition = Math.Clamp(audience + market + community + historical, 0, 100);

        var explanation =
            $"audience={audience}/30 ({type}), market={market}/25 ({source}), " +
            $"community={community}/25, category={historical}/20 → acquisition={acquisition}/100; " +
            $"contactability={contact}/100 (email={hasEmail})";

        return new AcquisitionScoreResult
        {
            AcquisitionScore = acquisition,
            AudienceFitScore = audience,
            MarketRelevanceScore = market,
            CommunityFitScore = community,
            ContactQualityScore = contact,
            HistoricalCategoryScore = historical,
            ScoreExplanation = explanation,
        };
    }

    public static string NormalizeProspectKind(string? organizationType) =>
        PartnerCrmLifecycle.NormalizeProspectKind(organizationType);

    static string ActivityForType(string orgType) => orgType switch
    {
        "run_club" => "running",
        "pickleball" => "pickleball",
        "cycling" => "cycling",
        "crossfit_hyrox" => "training",
        "personal_trainer" => "training",
        "soccer" or "volleyball" or "tennis" or "swimming" or "rec_sports" => "sports",
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
    public int ResearchAttempts { get; set; }
    public bool SeedsOnly { get; set; }
    public bool HitLimit { get; set; }
    public string? StoppedReason { get; set; }
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
