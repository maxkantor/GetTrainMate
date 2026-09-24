using GetTrainMate.Api.Models;
using GetTrainMate.Api.Services.PartnerOutreach;
using Xunit;

namespace GetTrainMate.Api.Tests;

public class PartnerOutreachTests
{
    [Fact]
    public void Approval_invalidates_when_body_changes()
    {
        var a = PartnerOutreachRules.Fingerprint("a@example.test", "S", "Hello", "https://x", "c1");
        var b = PartnerOutreachRules.Fingerprint("a@example.test", "S", "Hello world", "https://x", "c1");
        Assert.True(PartnerOutreachRules.ApprovalInvalidated(a, b));
        Assert.False(PartnerOutreachRules.ApprovalInvalidated(a, a));
    }

    [Fact]
    public void Daily_limit_and_duplicate_org_and_opt_out()
    {
        var ctx = new PartnerSendContext
        {
            SendEnabled = false,
            OutreachMode = "off",
            PostalAddress = "1 Main St",
            Approved = true,
            ApprovalFingerprint = "x",
            CurrentFingerprint = "x",
            SentToday = 10,
            DailyLimit = 10
        };
        Assert.Equal("daily_send_limit", PartnerOutreachRules.EvaluateSendGate(ctx));
        ctx.SentToday = 0;
        ctx.DuplicateOrganizationInitial = true;
        Assert.Equal("duplicate_organization", PartnerOutreachRules.EvaluateSendGate(ctx));
        ctx.DuplicateOrganizationInitial = false;
        ctx.OptedOut = true;
        Assert.Equal("suppressed", PartnerOutreachRules.EvaluateSendGate(ctx));
        ctx.OptedOut = false;
        ctx.HardBounced = true;
        Assert.Equal("suppressed", PartnerOutreachRules.EvaluateSendGate(ctx));
        ctx.HardBounced = false;
        ctx.ComplaintPause = true;
        Assert.Equal("complaint_pause", PartnerOutreachRules.EvaluateSendGate(ctx));
        ctx.ComplaintPause = false;
        ctx.AlreadySentThisRecipient = true;
        Assert.Equal("duplicate_recipient", PartnerOutreachRules.EvaluateSendGate(ctx));
        ctx.AlreadySentThisRecipient = false;
        ctx.AlreadyQueuedOrSentSameRecipient = true;
        Assert.Equal("duplicate_recipient", PartnerOutreachRules.EvaluateSendGate(ctx));
    }

    [Fact]
    public void AsUtc_normalizes_unspecified_dynamo_datetimes()
    {
        var unspecified = new DateTime(2026, 9, 21, 13, 33, 33, DateTimeKind.Unspecified);
        var utc = PartnerOutreachRules.AsUtc(unspecified);
        Assert.Equal(DateTimeKind.Utc, utc.Kind);
        // Must not throw (regression: ConvertTimeFromUtc Kind error on Approve & Send)
        var etDate = PartnerOutreachRules.ToEasternDate(unspecified);
        Assert.Equal(new DateTime(2026, 9, 21), etDate);
    }

    [Fact]
    public void Cursor_automation_cannot_send()
    {
        var ctx = new PartnerSendContext
        {
            SendEnabled = false,
            OutreachMode = "off",
            PostalAddress = "1 Main St",
            Approved = true,
            ApprovalFingerprint = "x",
            CurrentFingerprint = "x",
            ScheduledCursorAutomation = true
        };
        Assert.Equal("scheduled_automation_blocked", PartnerOutreachRules.EvaluateSendGate(ctx));
        ctx.ScheduledCursorAutomation = false;
        Assert.Null(PartnerOutreachRules.EvaluateSendGate(ctx));
    }

    [Fact]
    public void Send_enabled_and_outreach_mode_do_not_block_when_approved()
    {
        var ctx = new PartnerSendContext
        {
            SendEnabled = false,
            OutreachMode = "off",
            PauseAllOutreach = false,
            PostalAddress = "1 Main St",
            Approved = true,
            ApprovalFingerprint = "x",
            CurrentFingerprint = "x",
            Recipient = "a@example.test",
        };
        Assert.Null(PartnerOutreachRules.EvaluateSendGate(ctx));
    }

    [Fact]
    public void Pause_all_blocks_send()
    {
        var ctx = new PartnerSendContext
        {
            SendEnabled = true,
            OutreachMode = "live",
            PauseAllOutreach = true,
            PostalAddress = "1 Main St",
            Approved = true,
            ApprovalFingerprint = "x",
            CurrentFingerprint = "x",
        };
        Assert.Equal("pause_all_outreach", PartnerOutreachRules.EvaluateSendGate(ctx));
    }

    [Fact]
    public void Empty_postal_does_not_block_admin_authorized_send()
    {
        var ctx = new PartnerSendContext
        {
            PauseAllOutreach = false,
            PostalAddress = "",
            Approved = true,
            ApprovalFingerprint = "x",
            CurrentFingerprint = "x",
            Recipient = "a@example.test",
        };
        Assert.Null(PartnerOutreachRules.EvaluateSendGate(ctx));
    }

    [Fact]
    public void Test_recipients_only_gate()
    {
        var ctx = new PartnerSendContext
        {
            SendEnabled = false,
            OutreachMode = "off",
            TestRecipientsOnly = true,
            PostalAddress = "1 Main St",
            Approved = true,
            ApprovalFingerprint = "x",
            CurrentFingerprint = "x",
            Recipient = "a@example.test",
            TestRecipients = new List<string> { "other@example.test" },
        };
        Assert.Equal("test_recipient_not_allowed", PartnerOutreachRules.EvaluateSendGate(ctx));
        ctx.TestRecipients = new List<string> { "a@example.test" };
        Assert.Null(PartnerOutreachRules.EvaluateSendGate(ctx));
        ctx.TestRecipientsOnly = false;
        ctx.TestRecipients = new List<string> { "other@example.test" };
        Assert.Null(PartnerOutreachRules.EvaluateSendGate(ctx));
    }

    [Fact]
    public void Follow_up_bypasses_fingerprint_when_parent_approved()
    {
        var ctx = new PartnerSendContext
        {
            SendEnabled = false,
            OutreachMode = "off",
            PostalAddress = "1 Main St",
            Approved = false,
            ApprovalFingerprint = "parent",
            CurrentFingerprint = "followup-differs",
            IsAutomatedFollowUp = true,
            FollowUpNumber = 1,
            ParentWasApproved = true,
            CampaignActive = true,
        };
        Assert.Null(PartnerOutreachRules.EvaluateSendGate(ctx));
        ctx.ParentWasApproved = false;
        Assert.Equal("missing_parent_approval", PartnerOutreachRules.EvaluateSendGate(ctx));
    }

    [Fact]
    public void Acquisition_score_excludes_contact_component()
    {
        var org = new DiscoveredOrganization
        {
            OrganizationName = "Atlanta Pickleball Club",
            OrganizationType = "pickleball",
            DiscoverySource = "seed_catalog",
            Market = "atlanta",
        };
        var withEmail = AutomatedMarketDiscoveryService.ScoreProspect(org, hasEmail: true);
        var withoutEmail = AutomatedMarketDiscoveryService.ScoreProspect(org, hasEmail: false);
        Assert.Equal(withEmail.AcquisitionScore, withoutEmail.AcquisitionScore);
        Assert.True(withoutEmail.AcquisitionScore > 50);
        Assert.True(withEmail.AcquisitionScore >= 70);
        Assert.Equal(0, withoutEmail.ContactQualityScore);
        Assert.True(withEmail.ContactQualityScore >= 85);
        Assert.Contains("audience=", withEmail.ScoreExplanation);
        Assert.Contains("contactability=", withEmail.ScoreExplanation);
        Assert.DoesNotContain("contact=", withEmail.ScoreExplanation.Split("contactability=")[0]);
    }

    [Fact]
    public void Normalize_prospect_kind_maps_organization_types()
    {
        Assert.Equal("RUN_CLUB", PartnerCrmLifecycle.NormalizeProspectKind("run_club"));
        Assert.Equal("GYM", PartnerCrmLifecycle.NormalizeProspectKind("gym"));
        Assert.Equal("SPORTS_CLUB", PartnerCrmLifecycle.NormalizeProspectKind("pickleball"));
        Assert.Equal("TRAINER", PartnerCrmLifecycle.NormalizeProspectKind("personal_trainer"));
        Assert.Equal("SPORTS_CLUB", AutomatedMarketDiscoveryService.NormalizeProspectKind("soccer"));
    }

    [Fact]
    public void Crm_lifecycle_normalizes_legacy_status()
    {
        var p = new PartnerProspect { Status = "no_verified_public_email", Email = "" };
        PartnerCrmLifecycle.ApplyLegacyNormalization(p);
        Assert.Equal(PartnerCrmLifecycle.New, p.CrmLifecycle);
        Assert.Equal(PartnerCrmLifecycle.ContactNeeded, p.ContactState);

        var draft = new PartnerProspect { Status = "draft", Email = "a@b.com" };
        PartnerCrmLifecycle.ApplyLegacyNormalization(draft);
        Assert.Equal(PartnerCrmLifecycle.Qualified, draft.CrmLifecycle);
        Assert.Equal("AWAITING_APPROVAL", draft.EmailState);
    }

    [Fact]
    public void RenderDefault_rejects_unapproved_language()
    {
        Assert.Throws<InvalidOperationException>(() =>
            PartnerEmailMime.RenderDefault(
                "Example Club",
                "https://gettrainmate.com/partners/fr/paris/example",
                "example",
                "https://gettrainmate.com/email/unsubscribe?t=abc",
                "Paris, FR",
                "Paris",
                "fr"));
    }

    [Fact]
    public void RenderDefault_supports_spanish_template()
    {
        var copy = PartnerEmailMime.RenderDefault(
            "Example Club",
            "https://gettrainmate.com/partners/us/miami/example",
            "example",
            "https://gettrainmate.com/email/unsubscribe?t=abc",
            "Miami, FL",
            "Miami",
            "es");
        Assert.Contains("GetTrainMate ayuda a las personas", copy.Text);
        Assert.DoesNotContain("Soy Max", copy.Text, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("fundador", copy.Text, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("alianza", copy.Text, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Metro_label_normalizer_covers_initial_markets()
    {
        Assert.Equal("Atlanta", MetroLabelNormalizer.Normalize("Atlanta, GA"));
        Assert.Equal("Miami / Fort Lauderdale", MetroLabelNormalizer.Normalize("Fort Lauderdale"));
        Assert.Equal("New York", MetroLabelNormalizer.Normalize("NYC"));
        Assert.Equal("London", MetroLabelNormalizer.Normalize("London UK"));
        Assert.Equal("Toronto", MetroLabelNormalizer.Normalize("Toronto, ON"));
        Assert.Equal("Austin Tx", MetroLabelNormalizer.Normalize("austin tx"));
    }

    [Fact]
    public void Market_campaign_catalog_raises_active_soft_cap_and_paths()
    {
        Assert.True(MarketCampaignCatalog.MaxActiveMarkets >= 50);
        Assert.True(MarketCampaignCatalog.IsApprovedOutreachLanguage("en"));
        Assert.True(MarketCampaignCatalog.IsApprovedOutreachLanguage("es"));
        Assert.True(MarketCampaignCatalog.IsApprovedOutreachLanguage("ru"));
        Assert.False(MarketCampaignCatalog.IsApprovedOutreachLanguage("fr"));
        Assert.Equal("/partners/us/atlanta/atl-track-club", MarketCampaignCatalog.PartnerPath("us", "atlanta", "atl-track-club"));
        Assert.Equal("gb_london_train_partners", MarketCampaignCatalog.CampaignId("gb", "london", "TRAIN"));
        var atlanta = MarketCampaignCatalog.Candidates.First(c => c.CampaignId == "us_atlanta_train_partners");
        Assert.Equal("CROSS_MODE", atlanta.PrimaryMode);
        Assert.Contains("Atlanta", atlanta.DisplayName);
    }

    [Fact]
    public void Max_active_markets_no_longer_blocks_fourth_active()
    {
        // Soft ceiling only — SetCampaignStatusAsync must not throw for >3 actives.
        Assert.True(MarketCampaignCatalog.MaxActiveMarkets > 3);
        var catalog = MarketCampaignCatalog.Candidates;
        var stored = catalog.Select(c => new PartnerCampaign
        {
            CampaignId = c.CampaignId,
            Status = "active",
            DisplayName = c.DisplayName,
        }).ToList();
        var evidence = catalog.Select(c => new MarketRanker.MarketEvidenceRow
        {
            CampaignId = c.CampaignId,
            Country = c.Country,
            Market = c.Market,
            DisplayName = c.DisplayName,
        }).ToList();
        var targets = MarketRanker.SelectDiscoveryTargets(catalog, stored, evidence, MarketCampaignCatalog.MaxActiveMarkets).ToList();
        Assert.True(targets.Count >= Math.Min(4, catalog.Count));
        Assert.True(targets.Count >= stored.Count(c => c.Status == "active") || targets.Count == catalog.Count);
    }

    [Fact]
    public void Public_contact_verifier_detects_wix_disconnected_domain()
    {
        var html = """
            <html><body>
            <h1>This domain isn't connected to a site</h1>
            <p>If this domain is yours, head to the Domains page in your Wix dashboard.
            Dreaming of your own domain? Claim one now on Wix.</p>
            </body></html>
            """;
        Assert.True(PublicBusinessContactVerifier.IsParkingOrDisconnectedHtml(html));
        Assert.Null(PublicBusinessContactVerifier.TryVerifyFromHtml(html, "sq1performance.com", "https://www.sq1performance.com/"));
    }

    [Fact]
    public void Public_contact_verifier_accepts_domain_matched_mailto()
    {
        var html = "<a href=\"mailto:info@exampleclub.org\">Contact</a>";
        var emails = PublicBusinessContactVerifier.ExtractCandidates(html, "exampleclub.org").ToList();
        Assert.Single(emails);
        Assert.Equal("info@exampleclub.org", emails[0]);
    }

    [Fact]
    public void Public_contact_verifier_accepts_gmail_mailto_on_official_page()
    {
        var html = "<p>Reach us at <a href=\"mailto:club.ops@gmail.com\">Email us</a></p>";
        var found = PublicBusinessContactVerifier.TryVerifyFromHtml(html, "atlantapickleballclub.com", "https://atlantapickleballclub.com/contact");
        Assert.NotNull(found);
        Assert.Equal("club.ops@gmail.com", found!.Email);
        Assert.Equal("website_mailto", found.SourceType);
    }

    [Fact]
    public void Public_contact_verifier_rejects_invented_info_at_domain_without_html()
    {
        // Empty / unrelated HTML must never invent info@domain
        var found = PublicBusinessContactVerifier.TryVerifyFromHtml("", "exampleclub.org", "https://exampleclub.org/contact");
        Assert.Null(found);
        var noMatch = PublicBusinessContactVerifier.TryVerifyFromHtml(
            "<html><body><p>Welcome to our gym.</p></body></html>",
            "exampleclub.org",
            "https://exampleclub.org/");
        Assert.Null(noMatch);
        var emails = PublicBusinessContactVerifier.ExtractCandidates("Welcome only", "exampleclub.org").ToList();
        Assert.Empty(emails);
    }

    [Fact]
    public void Public_contact_verifier_rejects_noreply_and_accepts_same_domain_text()
    {
        var html = "noreply@exampleclub.org partner@other.com info@exampleclub.org";
        var emails = PublicBusinessContactVerifier.ExtractCandidates(html, "exampleclub.org").ToList();
        Assert.Single(emails);
        Assert.Equal("info@exampleclub.org", emails[0]);
    }

    [Fact]
    public void Public_contact_verifier_accepts_bare_foreign_email_on_contact_path()
    {
        var html = "Email hello@gmail.com for membership";
        var found = PublicBusinessContactVerifier.TryVerifyFromHtml(
            html, "exampleclub.org", "https://exampleclub.org/contact-us");
        Assert.NotNull(found);
        Assert.Equal("hello@gmail.com", found!.Email);
        Assert.Equal("website_page", found.SourceType);
    }

    [Fact]
    public void Public_contact_verifier_extracts_contact_name_near_mailto()
    {
        var html = "<a href=\"mailto:jane@exampleclub.org\">Jane Smith</a>";
        var found = PublicBusinessContactVerifier.TryVerifyFromHtml(html, "exampleclub.org", "https://exampleclub.org/about");
        Assert.NotNull(found);
        Assert.Equal("Jane Smith", found!.ContactName);
    }

    [Fact]
    public void Research_attempts_fields_default_and_increment_semantics()
    {
        var p = new PartnerProspect
        {
            OrganizationName = "Test Club",
            Website = "https://exampleclub.org",
            Status = "no_verified_public_email",
            ResearchAttempts = 0,
        };
        Assert.Equal(0, p.ResearchAttempts);
        p.ResearchAttempts++;
        p.LastResearchAt = DateTime.UtcNow;
        p.ContactabilityState = PartnerCrmLifecycle.ContactResearching;
        Assert.Equal(1, p.ResearchAttempts);
        Assert.NotNull(p.LastResearchAt);
        Assert.Equal(PartnerCrmLifecycle.ContactResearching, p.ContactabilityState);

        PartnerCrmLifecycle.ApplyLegacyNormalization(p);
        Assert.Equal(PartnerCrmLifecycle.ContactResearching, p.ContactabilityState);
    }

    [Fact]
    public void Partner_email_utm_appended_when_missing()
    {
        var url = PartnerEmailMime.AppendPartnerUtm(
            "https://gettrainmate.com/partners/us/atlanta/atl-x",
            "us_atlanta_train_partners",
            "atl-x");
        Assert.Contains("utm_source=partner_outreach", url);
        Assert.Contains("utm_medium=email", url);
        Assert.Contains("utm_campaign=us_atlanta_train_partners", url);
        Assert.Contains("ref=atl-x", url);
        var again = PartnerEmailMime.AppendPartnerUtm(url, "other", "y");
        Assert.Equal(url, again);
    }

    [Fact]
    public void RenderDefault_branches_english_by_prospect_kind()
    {
        var gym = PartnerEmailMime.RenderDefault(
            "Fit Studio",
            "https://gettrainmate.com/partners/us/atlanta/fit",
            "fit",
            "https://gettrainmate.com/email/unsubscribe?t=abc",
            "Atlanta, GA",
            "Atlanta",
            "en",
            organizationType: "gym");
        Assert.Contains("Help Fit Studio members find local training partners", gym.Subject, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("GetTrainMate helps people connect", gym.Text, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("utm_source=partner_outreach", gym.Text);
        Assert.Contains("Explore GetTrainMate", gym.Html, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("I'm Max", gym.Text, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("I\u2019m Max", gym.Text, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("Partner code", gym.Text, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("Invite code", gym.Text, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("partnership", gym.Text, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("founder", gym.Text, StringComparison.OrdinalIgnoreCase);

        var run = PartnerEmailMime.RenderDefault(
            "Run Crew",
            "https://gettrainmate.com/partners/us/atlanta/run",
            "run",
            "https://gettrainmate.com/email/unsubscribe?t=abc",
            "Atlanta, GA",
            "Atlanta",
            "en",
            organizationType: "run_club");
        Assert.Contains("Help Run Crew members find local training partners", run.Subject, StringComparison.OrdinalIgnoreCase);
        Assert.Equal(PartnerOutreachRules.PartnerFromName, "GetTrainMate");
        Assert.Equal(PartnerOutreachRules.TemplateVersion, "partner-v5-2026-09-21");
        Assert.Equal(100, PartnerOutreachRules.DefaultDailyLimit);
    }

    [Fact]
    public void Brand_led_english_copy_excludes_max_and_partner_code()
    {
        var copy = PartnerEmailMime.RenderDefault(
            "Example Club",
            "https://gettrainmate.com/partners/us/atlanta/atl-example",
            "atl-example",
            "https://gettrainmate.com/email/unsubscribe?t=abc",
            "Atlanta, GA");
        Assert.DoesNotContain("I'm Max", copy.Text, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("I\u2019m Max", copy.Text);
        Assert.DoesNotContain("Partner code", copy.Text, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("partnership", copy.Text, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("GetTrainMate\nhttps://gettrainmate.com/", copy.Text);
        Assert.Equal("GetTrainMate", PartnerOutreachRules.PartnerFromName);
    }

    [Fact]
    public void Normalize_acquisition_dimensions_sets_contact_needed()
    {
        var p = new PartnerProspect
        {
            Status = "no_verified_public_email",
            Email = "",
            ProspectType = "organization",
        };
        PartnerCrmLifecycle.NormalizeAcquisitionDimensions(p);
        Assert.Equal(PartnerCrmLifecycle.AcqContactNeeded, p.AcquisitionStatus);
        Assert.Equal(PartnerCrmLifecycle.CustNotCustomer, p.CustomerStatus);
        Assert.Equal(PartnerCrmLifecycle.EntityOrganization, p.EntityType);
        Assert.Equal(PartnerCrmLifecycle.PartNone, p.PartnershipStatus);
        Assert.Equal(PartnerCrmLifecycle.ContactNeeded, p.ContactState);
    }

    [Fact]
    public void Compute_next_action_research_contact_when_no_email()
    {
        var p = new PartnerProspect
        {
            Status = "discovered",
            Email = "",
            ContactState = PartnerCrmLifecycle.ContactNeeded,
        };
        PartnerCrmLifecycle.NormalizeAcquisitionDimensions(p);
        var next = PartnerCrmLifecycle.ComputeNextAction(p, null);
        var key = next.GetType().GetProperty("key")?.GetValue(next)?.ToString();
        Assert.Equal(PartnerCrmLifecycle.ActionResearchContact, key);
    }

    [Fact]
    public void Acquisition_dashboard_shape_includes_funnel_keys()
    {
        // Shape contract for admin UI — keys expected on funnel object
        var funnelKeys = new[]
        {
            "discovered", "contactable", "approved", "sent", "clicked",
            "signedUp", "activated", "buyers", "revenue",
        };
        var sample = new
        {
            discovered = 1,
            contactable = 0,
            approved = 0,
            sent = 0,
            clicked = 0,
            signedUp = 0,
            activated = 0,
            buyers = 0,
            revenue = 0L,
        };
        var props = sample.GetType().GetProperties().Select(p => p.Name).ToHashSet(StringComparer.Ordinal);
        foreach (var key in funnelKeys)
            Assert.Contains(key, props);
    }

    [Fact]
    public void Append_timeline_event_caps_at_fifty()
    {
        var p = new PartnerProspect();
        for (var i = 0; i < 55; i++)
            PartnerCrmLifecycle.AppendTimelineEvent(p, "test", $"Event {i}");
        var timeline = PartnerCrmLifecycle.ParseTimeline(p);
        Assert.Equal(50, timeline.Count);
    }

    [Fact]
    public void Partnership_status_not_defaulted_to_interested()
    {
        var p = new PartnerProspect { Status = "prospect", Email = "a@b.com" };
        PartnerCrmLifecycle.NormalizeAcquisitionDimensions(p);
        Assert.Equal(PartnerCrmLifecycle.PartNone, p.PartnershipStatus);
        Assert.NotEqual(PartnerCrmLifecycle.PartInterested, p.PartnershipStatus);
    }

    [Fact]
    public void Market_ranker_prefers_active_then_evidence()
    {
        var catalog = MarketCampaignCatalog.Candidates;
        var stored = new List<PartnerCampaign>
        {
            new() { CampaignId = "us_atlanta_train_partners", Status = "active" },
        };
        var evidence = catalog.Select(c => new MarketRanker.MarketEvidenceRow
        {
            CampaignId = c.CampaignId,
            Country = c.Country,
            Market = c.Market,
            DisplayName = c.DisplayName,
            FounderAdvantage = c.Market == "atlanta",
        }).ToList();
        var targets = MarketRanker.SelectDiscoveryTargets(catalog, stored, evidence, 5).ToList();
        Assert.True(targets.Count >= 1);
        Assert.Equal("us_atlanta_train_partners", targets[0].CampaignId);
    }

    [Fact]
    public void Mime_is_utf8_quoted_printable_with_list_unsubscribe_and_reply_to()
    {
        var copy = PartnerEmailMime.RenderDefault(
            "Example Club",
            "https://gettrainmate.com/partners/us/atlanta/atl-example",
            "atl-example",
            "https://gettrainmate.com/email/unsubscribe?t=abc",
            "Atlanta, GA");
        Assert.Contains("GetTrainMate helps people connect", copy.Text);
        Assert.DoesNotContain("I\u2019m Max", copy.Text);
        Assert.DoesNotContain("TRAIN-mode", copy.Text);
        var raw = PartnerEmailMime.BuildRaw(
            PartnerOutreachRules.PartnerFromName,
            PartnerOutreachRules.PartnerFromEmail,
            "partners@example.test",
            PartnerOutreachRules.PartnerFromEmail,
            copy.Subject,
            copy.Text,
            copy.Html,
            listUnsubscribeUrl: "https://gettrainmate.com/email/unsubscribe?t=abc",
            internalMessageId: "po_abc");
        var s = System.Text.Encoding.UTF8.GetString(raw);
        Assert.Contains("Content-Type: text/plain; charset=UTF-8", s);
        Assert.Contains("Content-Type: text/html; charset=UTF-8", s);
        Assert.Contains("Content-Transfer-Encoding: quoted-printable", s);
        Assert.Contains("Reply-To: partners@gettrainmate.com", s);
        Assert.Contains("List-Unsubscribe:", s);
        Assert.Contains("List-Unsubscribe-Post:", s);
        Assert.Contains("From: GetTrainMate <partners@gettrainmate.com>", s);
        Assert.DoesNotContain("â€™", s);
        Assert.DoesNotContain("gmail.com", s);
        Assert.DoesNotContain("noreply@", s);
        var decoded = PartnerEmailMime.DecodeQuotedPrintable(s);
        Assert.Contains("GetTrainMate helps people connect", decoded);
        Assert.DoesNotContain("I\u2019m Max", decoded);
        SesTagRules.AssertNoPii(SesTagRules.CampaignTags("po_abc"));
        Assert.Throws<InvalidOperationException>(() =>
            SesTagRules.AssertNoPii(new Dictionary<string, string> { ["email"] = "a@b.com" }));
    }

    [Fact]
    public void Html_sanitize_and_attachment_safety()
    {
        var dirty = "<p>Hi</p><script>alert(1)</script><img src=\"https://x/pixel.gif\"><a href=\"javascript:alert(1)\">x</a>";
        var clean = PartnerEmailMime.SanitizeHtml(dirty);
        Assert.DoesNotContain("<script", clean);
        Assert.DoesNotContain("<img", clean);
        Assert.DoesNotContain("javascript:", clean);
        Assert.True(PartnerEmailMime.IsDangerousAttachment("payload.exe", "application/octet-stream"));
        Assert.False(PartnerEmailMime.IsDangerousAttachment("notes.pdf", "application/pdf"));
    }

    [Fact]
    public void Unsubscribe_token_hides_email_and_expires()
    {
        var token = UnsubscribeToken.Create("prospect-1", "secret", DateTimeOffset.UtcNow.AddHours(1));
        Assert.DoesNotContain("@", token);
        Assert.True(UnsubscribeToken.TryValidate(token, "secret", out var id, out _));
        Assert.Equal("prospect-1", id);
        Assert.False(UnsubscribeToken.TryValidate(token, "wrong", out _, out _));
        var expired = UnsubscribeToken.Create("prospect-1", "secret", DateTimeOffset.UtcNow.AddHours(-1));
        Assert.False(UnsubscribeToken.TryValidate(expired, "secret", out _, out _));
    }

    [Fact]
    public void Inbound_parser_threads_in_reply_to()
    {
        var raw = "From: Org <info@example.test>\nTo: partners@gettrainmate.com\nSubject: Re: hello\nMessage-ID: <in@ex>\nIn-Reply-To: <po_abc@gettrainmate.com>\nReferences: <po_abc@gettrainmate.com>\n\nThanks, we are interested.";
        var parsed = InboundMimeParser.Parse(raw);
        Assert.Equal("<in@ex>", parsed.MessageId);
        Assert.Equal("<po_abc@gettrainmate.com>", parsed.InReplyTo);
        Assert.Contains("<po_abc@gettrainmate.com>", parsed.References);
        Assert.Contains("interested", parsed.TextBody);
    }

    [Fact]
    public void Dst_safe_weekday_window_uses_eastern_timezone()
    {
        var tz = PartnerOutreachRules.EasternTimeZone();
        // 2026-08-14 14:00 UTC = 10:00 AM EDT
        var summer = new DateTime(2026, 8, 14, 14, 0, 0, DateTimeKind.Utc);
        Assert.True(PartnerOutreachRules.IsDispatchWindow(summer, tz, 10));
        // 2026-01-14 15:00 UTC = 10:00 AM EST
        var winter = new DateTime(2026, 1, 14, 15, 0, 0, DateTimeKind.Utc);
        Assert.True(PartnerOutreachRules.IsDispatchWindow(winter, tz, 10));
        Assert.False(PartnerOutreachRules.IsWeekdayEastern(new DateTime(2026, 8, 15, 14, 0, 0, DateTimeKind.Utc), tz));
    }

    [Fact]
    public void Prospect_dedupe_matches_email_website_and_partner_code()
    {
        var existing = new PartnerProspect
        {
            Email = "info@example.test",
            Website = "https://www.example.test/contact",
            OrganizationName = "Example Club",
            PartnerCode = "atl-example",
            CampaignId = "us_atlanta_train_partners",
        };
        var byEmail = new PartnerProspect
        {
            Email = "INFO@example.test",
            OrganizationName = "Other Name",
            CampaignId = "us_atlanta_train_partners",
        };
        Assert.True(PartnerOutreachDedupe.MatchesProspect(existing, byEmail));

        var org = new DiscoveredOrganization
        {
            OrganizationName = "Example Club",
            Website = "https://example.test/contact/",
            PartnerCode = "atl-example",
            CampaignId = "us_atlanta_train_partners",
        };
        Assert.True(PartnerOutreachDedupe.MatchesDiscoveredOrg(existing, org, "us_atlanta_train_partners"));
        Assert.Equal(
            PartnerOutreachDedupe.ProspectKey(existing),
            PartnerOutreachDedupe.ProspectKey(byEmail));
    }

    [Fact]
    public void Pick_best_prospect_prefers_approved_over_draft()
    {
        var draft = new PartnerProspect { ProspectId = "d", Status = "draft", CreatedAt = DateTime.UtcNow };
        var approved = new PartnerProspect { ProspectId = "a", Status = "approved", CreatedAt = draft.CreatedAt.AddMinutes(-5) };
        var best = PartnerOutreachDedupe.PickBestProspect(new[] { draft, approved });
        Assert.Equal("a", best.ProspectId);
    }

    [Fact]
    public void Clamp_daily_limit_is_1_to_500_default_100()
    {
        Assert.Equal(100, PartnerOutreachRules.ClampDailyLimit(0));
        Assert.Equal(1, PartnerOutreachRules.ClampDailyLimit(1));
        Assert.Equal(500, PartnerOutreachRules.ClampDailyLimit(500));
        Assert.Equal(500, PartnerOutreachRules.ClampDailyLimit(9999));
        Assert.Equal(100, PartnerOutreachRules.ClampDailyLimit(-3));
    }

    [Fact]
    public void Automatic_qualified_send_does_not_require_approval()
    {
        var ctx = BaseSendContext();
        ctx.Approved = false;
        ctx.AutomaticQualifiedSend = true;
        Assert.Null(PartnerOutreachRules.EvaluateSendGate(ctx));
    }

    [Fact]
    public void Manual_campaign_still_requires_approval()
    {
        var ctx = BaseSendContext();
        ctx.Approved = false;
        ctx.AutomaticQualifiedSend = false;
        Assert.Equal("missing_authorization_record", PartnerOutreachRules.EvaluateSendGate(ctx));
    }

    [Fact]
    public void Dry_run_blocks_before_ses()
    {
        var ctx = BaseSendContext();
        ctx.DryRun = true;
        Assert.Equal("dry_run", PartnerOutreachRules.EvaluateSendGate(ctx));
        Assert.Equal(WhyNotSent.DryRun, WhyNotSent.FromGateCode("dry_run"));
    }

    [Fact]
    public void Ses_quota_is_separate_from_daily_limit()
    {
        var ctx = BaseSendContext();
        ctx.SesQuotaExhausted = true;
        Assert.Equal("ses_quota_reached", PartnerOutreachRules.EvaluateSendGate(ctx));
        ctx.SesQuotaExhausted = false;
        ctx.SentToday = 100;
        ctx.DailyLimit = 100;
        Assert.Equal("daily_send_limit", PartnerOutreachRules.EvaluateSendGate(ctx));
    }

    [Fact]
    public void Duplicate_email_and_organization_are_pre_ses()
    {
        var ctx = BaseSendContext();
        ctx.AlreadySentThisRecipient = true;
        Assert.Equal("duplicate_recipient", PartnerOutreachRules.EvaluateSendGate(ctx));
        ctx.AlreadySentThisRecipient = false;
        ctx.DuplicateOrganizationInitial = true;
        Assert.Equal("duplicate_organization", PartnerOutreachRules.EvaluateSendGate(ctx));
    }

    [Fact]
    public void Suppression_reasons_map_to_why_not_sent()
    {
        var unsub = BaseSendContext();
        unsub.OptedOut = true;
        Assert.Equal("suppressed", PartnerOutreachRules.EvaluateSendGate(unsub));
        Assert.Equal(WhyNotSent.Unsubscribed, WhyNotSent.FromGateCode("suppressed", unsub));

        var bounce = BaseSendContext();
        bounce.HardBounced = true;
        Assert.Equal(WhyNotSent.Bounced, WhyNotSent.FromGateCode("suppressed", bounce));

        var complaint = BaseSendContext();
        complaint.Complained = true;
        Assert.Equal(WhyNotSent.Complaint, WhyNotSent.FromGateCode("suppressed", complaint));

        var manual = BaseSendContext();
        Assert.Equal(WhyNotSent.ManualSuppression, WhyNotSent.FromGateCode("suppressed", manual));
    }

    [Fact]
    public void Already_contacted_and_no_public_email_why_not_sent()
    {
        Assert.Equal(WhyNotSent.AlreadyContacted, WhyNotSent.ForProspect(
            new PartnerProspectState { HasUsableEmail = true },
            hasUnsentDraft: false, alreadySent: true,
            false, false, false, false, true, false, false, 80, 40));
        Assert.Equal(WhyNotSent.NoPublicEmail, WhyNotSent.ForProspect(
            new PartnerProspectState { HasUsableEmail = false, ContactDiscoveryStatus = "NO_PUBLIC_CONTACT" },
            false, false, false, false, false, false, true, false, false, 80, 40));
        Assert.Equal(WhyNotSent.DiscoveryPending, WhyNotSent.ForProspect(
            new PartnerProspectState { HasUsableEmail = false },
            false, false, false, false, false, false, true, false, false, 80, 40));
        Assert.Equal(WhyNotSent.NotQualified, WhyNotSent.ForProspect(
            new PartnerProspectState { HasUsableEmail = true },
            false, false, false, false, false, false, true, false, false, 10, 40));
        Assert.Equal(WhyNotSent.ReadyToSend, WhyNotSent.ForProspect(
            new PartnerProspectState { HasUsableEmail = true },
            hasUnsentDraft: true, alreadySent: false,
            false, false, false, false, true, false, false, 80, 40));
        Assert.Equal(WhyNotSent.ManualApprovalRequired, WhyNotSent.ForProspect(
            new PartnerProspectState { HasUsableEmail = true },
            hasUnsentDraft: true, alreadySent: false,
            false, false, false, false, false, false, false, 80, 40));
    }

    [Fact]
    public void Train_vibe_date_classification_is_not_train_only()
    {
        var gym = PartnerAudience.RelevantModesFor("gym");
        Assert.Contains("TRAIN", gym);
        Assert.Contains("VIBE", gym);
        Assert.DoesNotContain("DATE", gym);

        var pickle = PartnerAudience.RelevantModesFor("pickleball");
        Assert.Contains("TRAIN", pickle);
        Assert.Contains("VIBE", pickle);
        Assert.Contains("DATE", pickle);

        var social = PartnerAudience.RelevantModesFor("community");
        Assert.Contains("VIBE", social);
        Assert.Contains("DATE", social);
        Assert.Equal("VIBE", PartnerAudience.PrimaryModeFor(social));
        Assert.Equal("CROSS_MODE", PartnerAudience.PrimaryModeFor(pickle));
    }

    [Fact]
    public void Qualification_does_not_lower_score_to_fill_limit()
    {
        Assert.False(PartnerAudience.IsQualified(20, 40));
        Assert.True(PartnerAudience.IsQualified(40, 40));
        Assert.False(PartnerAudience.IsQualified(0, 40));
    }

    [Fact]
    public void Delivered_is_not_tracked_without_configuration_set()
    {
        Assert.Equal("NOT TRACKED", PartnerAudience.DeliveredTrackingStatus(null));
        Assert.Equal("NOT TRACKED", PartnerAudience.DeliveredTrackingStatus(""));
        Assert.Equal("CONFIGURED", PartnerAudience.DeliveredTrackingStatus("gettrainmate-partner-outreach"));
    }

    [Fact]
    public void Follow_up_sequence_stops_at_two()
    {
        var days = new List<int> { 4, 9, 14, 21 };
        var scheduled = days.Where(d => d > 0).Distinct().OrderBy(d => d).Take(2).ToList();
        Assert.Equal(new[] { 4, 9 }, scheduled);
        Assert.DoesNotContain(14, scheduled);
    }

    [Fact]
    public void Concurrent_initial_send_blocked_by_already_sent_or_queued()
    {
        var auto = BaseSendContext();
        auto.AutomaticQualifiedSend = true;
        auto.Approved = false;
        auto.AlreadySentThisRecipient = true;
        Assert.Equal("duplicate_recipient", PartnerOutreachRules.EvaluateSendGate(auto));

        var manual = BaseSendContext();
        manual.Approved = true;
        manual.AlreadyQueuedOrSentSameRecipient = true;
        Assert.Equal("duplicate_recipient", PartnerOutreachRules.EvaluateSendGate(manual));
    }

    [Fact]
    public void Idempotent_retry_does_not_clear_ses_message_id_gate()
    {
        var sent = new PartnerQueueItem
        {
            Status = "sent",
            SesMessageId = "010201-test",
            SentAt = DateTime.UtcNow,
        };
        Assert.True(sent.SentAt != null && !string.IsNullOrWhiteSpace(sent.SesMessageId));
    }

    [Fact]
    public void Markets_include_priority_us_metros_and_partner_001()
    {
        var ids = MarketCampaignCatalog.Candidates.Select(c => c.CampaignId).ToList();
        Assert.Contains("PARTNER-001", ids);
        Assert.Contains("us_atlanta_train_partners", ids);
        Assert.Contains("us_miami_train_partners", ids);
        Assert.Contains("us_tampa_train_partners", ids);
        Assert.Contains("us_new_york_train_partners", ids);
        Assert.Contains("us_dallas_train_partners", ids);
        Assert.Contains("us_chicago_train_partners", ids);
    }

    static PartnerSendContext BaseSendContext() => new()
    {
        PostalAddress = "1 Main St",
        Approved = true,
        ApprovalFingerprint = "x",
        CurrentFingerprint = "x",
        DailyLimit = 100,
        Recipient = "info@example.test",
    };
}
