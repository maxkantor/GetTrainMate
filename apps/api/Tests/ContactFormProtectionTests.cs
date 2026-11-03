using GetTrainMate.Api.Services.ContactForm;
using Xunit;

namespace GetTrainMate.Api.Tests;

public class ContactFormProtectionTests
{
    [Fact]
    public void Validate_accepts_english_submission()
    {
        var r = ContactFormProtection.Validate(
            "Maxim Kantor",
            "maxim@example.com",
            "general",
            "Hello — I have a question about TRAIN.",
            honeypotRaw: "");
        Assert.True(r.Ok);
        Assert.Equal("ok", r.ReasonCode);
        Assert.NotNull(r.Normalized);
        Assert.Equal("maxim@example.com", r.Normalized!.Email);
    }

    [Fact]
    public void Validate_accepts_russian_unicode_submission()
    {
        var r = ContactFormProtection.Validate(
            "Анна Иванова",
            "anna@example.com",
            "support",
            "Здравствуйте! Нужна помощь с профилем.",
            honeypotRaw: null);
        Assert.True(r.Ok, r.Error);
        Assert.Equal("Анна Иванова", r.Normalized!.Name);
    }

    [Fact]
    public void Validate_accepts_short_legit_message()
    {
        var r = ContactFormProtection.Validate("Max", "max@example.com", "general", "Hi", "");
        Assert.True(r.Ok, r.Error);
    }

    [Theory]
    [InlineData("3971018755")]
    [InlineData("  3971018755  ")]
    [InlineData("1234")]
    [InlineData("12-34-5678")]
    public void Validate_rejects_numeric_only_message(string message)
    {
        var r = ContactFormProtection.Validate(
            "DYxJAuudTLQqvaKPltK",
            "person@example.com",
            "general",
            message,
            "");
        Assert.False(r.Ok);
        Assert.Equal("message_numeric_only", r.ReasonCode);
    }

    [Fact]
    public void Validate_rejects_filled_honeypot_silently()
    {
        var r = ContactFormProtection.Validate(
            "Real Person",
            "real@example.com",
            "general",
            "I need help please",
            honeypotRaw: "Acme Corp");
        Assert.False(r.Ok);
        Assert.Equal("honeypot", r.ReasonCode);
        Assert.True(r.SilentAccept);
    }

    [Fact]
    public void Validate_rejects_dot_stuffed_email()
    {
        var r = ContactFormProtection.Validate(
            "Someone",
            "robi.d.eli.s.i.r19.8.5@gmail.com",
            "general",
            "Need help with my account",
            "");
        Assert.False(r.Ok);
        Assert.Equal("email_suspicious", r.ReasonCode);
    }

    [Fact]
    public void Validate_rejects_invalid_subject()
    {
        var r = ContactFormProtection.Validate("Max", "max@example.com", "crypto-pump", "Hello there", "");
        Assert.False(r.Ok);
        Assert.Equal("subject_invalid", r.ReasonCode);
    }

    [Fact]
    public void Validate_rejects_oversized_request()
    {
        var r = ContactFormProtection.Validate(
            "Max",
            "max@example.com",
            "general",
            "Hello",
            "",
            contentLengthBytes: ContactFormProtection.MaxRequestBodyBytes + 1);
        Assert.False(r.Ok);
        Assert.Equal("request_too_large", r.ReasonCode);
    }

    [Fact]
    public void Validate_does_not_reject_unfamiliar_but_valid_name()
    {
        // Long single-token name must not be rejected solely for looking unfamiliar.
        var r = ContactFormProtection.Validate(
            "DYxJAuudTLQqvaKPltK",
            "normal.user@example.com",
            "general",
            "Please help me reset my password.",
            "");
        Assert.True(r.Ok, r.Error);
    }

    [Fact]
    public void ContentFingerprint_is_stable_for_normalized_whitespace()
    {
        var a = ContactFormProtection.Validate("Max", "max@example.com", "general", "Hello   world", "")!.Normalized!;
        var b = new ContactFormProtection.NormalizedSubmission("Max", "max@example.com", "general", "Hello world");
        Assert.Equal(
            ContactFormProtection.ContentFingerprint(a),
            ContactFormProtection.ContentFingerprint(b));
    }

    [Fact]
    public void IsNumericOnlyMessage_allows_mixed_text()
    {
        Assert.False(ContactFormProtection.IsNumericOnlyMessage("Order 3971018755 please"));
        Assert.False(ContactFormProtection.IsNumericOnlyMessage("Привет"));
    }
}
