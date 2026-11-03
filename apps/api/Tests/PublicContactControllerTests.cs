using Amazon.DynamoDBv2.DataModel;
using GetTrainMate.Api.Controllers;
using GetTrainMate.Api.Models;
using GetTrainMate.Api.Services;
using GetTrainMate.Api.Services.ContactForm;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using System.Net;
using Xunit;

namespace GetTrainMate.Api.Tests;

public class PublicContactControllerTests
{
    private readonly Mock<IDynamoDBContext> _db = new();
    private readonly Mock<IAdminNotificationService> _notify = new();
    private readonly Mock<IContactFormGuardStore> _guard = new();
    private readonly Mock<IContactFormBotVerifier> _bot = new();

    public PublicContactControllerTests()
    {
        _guard.Setup(g => g.TryIncrementRateAsync(It.IsAny<string>(), It.IsAny<int>(), It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);
        _guard.Setup(g => g.TryClaimDedupeAsync(It.IsAny<string>(), It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);
        _guard.Setup(g => g.TryClaimTokenAsync(It.IsAny<string>(), It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);
        _bot.SetupGet(b => b.IsEnabled).Returns(false);
        _bot.Setup(b => b.VerifyAsync(It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ContactFormBotVerifyResult(true, "disabled"));
        _db.Setup(d => d.SaveAsync(It.IsAny<Contact>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
        _db.Setup(d => d.SaveAsync(It.IsAny<ContactEmailThread>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
        _db.Setup(d => d.SaveAsync(It.IsAny<ContactEmailMessage>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
        _notify.Setup(n => n.NotifyContactFormAsync(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
    }

    private PublicContactController Create()
    {
        var ctl = new PublicContactController(
            _db.Object,
            _notify.Object,
            _guard.Object,
            _bot.Object,
            NullLogger<PublicContactController>.Instance);
        ctl.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                Connection = { RemoteIpAddress = IPAddress.Parse("203.0.113.10") },
            },
        };
        return ctl;
    }

    private static PublicContactRequest Legit() => new()
    {
        Name = "Maxim Kantor",
        Email = "maxim@example.com",
        Subject = "general",
        Message = "Hello, I have a question about GetTrainMate.",
        Company = "",
    };

    [Fact]
    public async Task Legit_submission_creates_contact_and_sends_email()
    {
        var ctl = Create();
        var result = await ctl.SubmitContact(Legit(), CancellationToken.None);
        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.Equal(200, ok.StatusCode);

        _db.Verify(d => d.SaveAsync(It.IsAny<Contact>(), It.IsAny<CancellationToken>()), Times.Once);
        _db.Verify(d => d.SaveAsync(It.IsAny<ContactEmailThread>(), It.IsAny<CancellationToken>()), Times.Once);
        _db.Verify(d => d.SaveAsync(It.IsAny<ContactEmailMessage>(), It.IsAny<CancellationToken>()), Times.Once);
        _notify.Verify(n => n.NotifyContactFormAsync(
            "Maxim Kantor",
            "maxim@example.com",
            "general",
            "Hello, I have a question about GetTrainMate.",
            It.IsAny<string?>(),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Russian_submission_is_accepted()
    {
        var ctl = Create();
        var result = await ctl.SubmitContact(new PublicContactRequest
        {
            Name = "Анна",
            Email = "anna@example.com",
            Subject = "support",
            Message = "Здравствуйте, нужна помощь",
        }, CancellationToken.None);
        Assert.IsType<OkObjectResult>(result);
        _notify.Verify(n => n.NotifyContactFormAsync(
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task Numeric_only_example_has_zero_side_effects()
    {
        var ctl = Create();
        var result = await ctl.SubmitContact(new PublicContactRequest
        {
            Name = "DYxJAuudTLQqvaKPltK",
            Email = "robi.d.eli.s.i.r19.8.5@gmail.com",
            Subject = "general",
            Message = "3971018755",
        }, CancellationToken.None);

        Assert.IsType<BadRequestObjectResult>(result);
        VerifyNoSideEffects();
    }

    [Fact]
    public async Task Honeypot_has_zero_side_effects()
    {
        var ctl = Create();
        var req = Legit();
        req.Company = "SpamBot Inc";
        var result = await ctl.SubmitContact(req, CancellationToken.None);
        var ok = Assert.IsType<OkObjectResult>(result);
        // Silent accept UX but accepted=false
        var json = System.Text.Json.JsonSerializer.Serialize(ok.Value);
        Assert.Contains("\"accepted\":false", json, StringComparison.OrdinalIgnoreCase);
        VerifyNoSideEffects();
    }

    [Fact]
    public async Task Rate_limit_blocks_without_crm_or_email()
    {
        _guard.Setup(g => g.TryIncrementRateAsync(
                It.Is<string>(k => k.StartsWith("rate:ip:", StringComparison.Ordinal)),
                It.IsAny<int>(),
                It.IsAny<TimeSpan>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        var ctl = Create();
        var result = await ctl.SubmitContact(Legit(), CancellationToken.None);
        var obj = Assert.IsType<ObjectResult>(result);
        Assert.Equal(429, obj.StatusCode);
        VerifyNoSideEffects();
    }

    [Fact]
    public async Task Duplicate_retry_does_not_resend_notification()
    {
        _guard.Setup(g => g.TryClaimDedupeAsync(It.IsAny<string>(), It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        var ctl = Create();
        var result = await ctl.SubmitContact(Legit(), CancellationToken.None);
        Assert.IsType<OkObjectResult>(result);
        VerifyNoSideEffects();
    }

    [Fact]
    public async Task Direct_api_bypass_still_validates()
    {
        var ctl = Create();
        var result = await ctl.SubmitContact(new PublicContactRequest
        {
            Name = "",
            Email = "not-an-email",
            Subject = "general",
            Message = "3971018755",
        }, CancellationToken.None);
        Assert.IsType<BadRequestObjectResult>(result);
        VerifyNoSideEffects();
    }

    [Fact]
    public async Task Captcha_enabled_rejects_missing_token()
    {
        _bot.SetupGet(b => b.IsEnabled).Returns(true);
        _bot.Setup(b => b.VerifyAsync(null, It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ContactFormBotVerifyResult(false, "captcha_missing"));
        _bot.Setup(b => b.VerifyAsync("", It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ContactFormBotVerifyResult(false, "captcha_missing"));
        _bot.Setup(b => b.VerifyAsync(It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ContactFormBotVerifyResult(false, "captcha_missing"));

        var ctl = Create();
        var req = Legit();
        req.CaptchaToken = null;
        var result = await ctl.SubmitContact(req, CancellationToken.None);
        Assert.IsType<BadRequestObjectResult>(result);
        VerifyNoSideEffects();
    }

    [Fact]
    public async Task Captcha_enabled_rejects_invalid_token()
    {
        _bot.SetupGet(b => b.IsEnabled).Returns(true);
        _bot.Setup(b => b.VerifyAsync(It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ContactFormBotVerifyResult(false, "captcha_invalid"));

        var ctl = Create();
        var req = Legit();
        req.CaptchaToken = "bad-token";
        var result = await ctl.SubmitContact(req, CancellationToken.None);
        Assert.IsType<BadRequestObjectResult>(result);
        VerifyNoSideEffects();
    }

    [Fact]
    public async Task Captcha_enabled_rejects_replayed_token()
    {
        _bot.SetupGet(b => b.IsEnabled).Returns(true);
        _bot.Setup(b => b.VerifyAsync(It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ContactFormBotVerifyResult(true, "captcha_ok"));
        _guard.Setup(g => g.TryClaimTokenAsync(It.IsAny<string>(), It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        var ctl = Create();
        var req = Legit();
        req.CaptchaToken = "once-token";
        var result = await ctl.SubmitContact(req, CancellationToken.None);
        Assert.IsType<BadRequestObjectResult>(result);
        VerifyNoSideEffects();
    }

    private void VerifyNoSideEffects()
    {
        _db.Verify(d => d.SaveAsync(It.IsAny<Contact>(), It.IsAny<CancellationToken>()), Times.Never);
        _db.Verify(d => d.SaveAsync(It.IsAny<ContactEmailThread>(), It.IsAny<CancellationToken>()), Times.Never);
        _db.Verify(d => d.SaveAsync(It.IsAny<ContactEmailMessage>(), It.IsAny<CancellationToken>()), Times.Never);
        _notify.Verify(n => n.NotifyContactFormAsync(
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }
}
