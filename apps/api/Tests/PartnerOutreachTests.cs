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
            SendEnabled = true,
            PostalAddress = "1 Main St",
            Approved = true,
            ApprovalFingerprint = "x",
            CurrentFingerprint = "x",
            SentToday = 3,
            DailyLimit = 3
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
    }

    [Fact]
    public void Cursor_automation_cannot_send()
    {
        var ctx = new PartnerSendContext
        {
            SendEnabled = true,
            PostalAddress = "1 Main St",
            Approved = true,
            ApprovalFingerprint = "x",
            CurrentFingerprint = "x",
            ScheduledCursorAutomation = true
        };
        Assert.Equal("scheduled_automation_blocked", PartnerOutreachRules.EvaluateSendGate(ctx));
        ctx.ScheduledCursorAutomation = false;
        ctx.SendEnabled = false;
        Assert.Equal("send_disabled", PartnerOutreachRules.EvaluateSendGate(ctx));
    }

    [Fact]
    public void RenderDefault_rejects_unapproved_language()
    {
        Assert.Throws<InvalidOperationException>(() =>
            PartnerEmailMime.RenderDefault(
                "Example Club",
                "https://gettrainmate.com/partners/es/miami/example",
                "example",
                "https://gettrainmate.com/email/unsubscribe?t=abc",
                "Miami, FL",
                "Miami",
                "es"));
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
    public void Market_campaign_catalog_caps_active_markets_and_paths()
    {
        Assert.Equal(3, MarketCampaignCatalog.MaxActiveMarkets);
        Assert.True(MarketCampaignCatalog.IsApprovedOutreachLanguage("en"));
        Assert.False(MarketCampaignCatalog.IsApprovedOutreachLanguage("es"));
        Assert.Equal("/partners/us/atlanta/atl-track-club", MarketCampaignCatalog.PartnerPath("us", "atlanta", "atl-track-club"));
        Assert.Equal("gb_london_train_partners", MarketCampaignCatalog.CampaignId("gb", "london", "TRAIN"));
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
        Assert.Contains("I\u2019m Max", copy.Text);
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
        Assert.Contains("=E2=80=99", s);
        Assert.DoesNotContain("â€™", s);
        Assert.DoesNotContain("gmail.com", s);
        Assert.DoesNotContain("noreply@", s);
        var decoded = PartnerEmailMime.DecodeQuotedPrintable(s);
        Assert.Contains("I\u2019m Max", decoded);
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
}
