using Amazon.SimpleSystemsManagement;
using Amazon.SimpleSystemsManagement.Model;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace GetTrainMate.Api.Services.ContactForm;

public sealed record ContactFormBotVerifyResult(bool Ok, string ReasonCode);

/// <summary>
/// Optional bot verification (e.g. Cloudflare Turnstile). Disabled unless a secret is configured.
/// </summary>
public interface IContactFormBotVerifier
{
    bool IsEnabled { get; }
    Task<ContactFormBotVerifyResult> VerifyAsync(string? token, string? remoteIp, CancellationToken cancellationToken);
}

/// <summary>No-op verifier used when CONTACT_FORM_TURNSTILE_SECRET is unset.</summary>
public sealed class DisabledContactFormBotVerifier : IContactFormBotVerifier
{
    public bool IsEnabled => false;

    public Task<ContactFormBotVerifyResult> VerifyAsync(string? token, string? remoteIp, CancellationToken cancellationToken)
        => Task.FromResult(new ContactFormBotVerifyResult(true, "disabled"));
}

/// <summary>
/// Cloudflare Turnstile siteverify.
/// Secret from CONTACT_FORM_TURNSTILE_SECRET env, or SSM /gettrainmate/contact/turnstile-secret.
/// Expected hostname: CONTACT_FORM_TURNSTILE_HOST (default gettrainmate.com).
/// </summary>
public sealed class TurnstileContactFormBotVerifier : IContactFormBotVerifier
{
    public const string SsmSecretPath = "/gettrainmate/contact/turnstile-secret";

    private readonly HttpClient _http;
    private readonly IAmazonSimpleSystemsManagement _ssm;
    private readonly ILogger<TurnstileContactFormBotVerifier> _logger;
    private readonly string _expectedHost;
    private string? _secret;
    private bool _ssmAttempted;

    public TurnstileContactFormBotVerifier(
        HttpClient http,
        IConfiguration config,
        IAmazonSimpleSystemsManagement ssm,
        ILogger<TurnstileContactFormBotVerifier> logger)
    {
        _http = http;
        _ssm = ssm;
        _logger = logger;
        _secret = (config["CONTACT_FORM_TURNSTILE_SECRET"] ?? Environment.GetEnvironmentVariable("CONTACT_FORM_TURNSTILE_SECRET") ?? "").Trim();
        if (_secret.Length == 0) _secret = null;
        _expectedHost = (config["CONTACT_FORM_TURNSTILE_HOST"]
                         ?? Environment.GetEnvironmentVariable("CONTACT_FORM_TURNSTILE_HOST")
                         ?? "gettrainmate.com").Trim().ToLowerInvariant();
    }

    public bool IsEnabled
    {
        get
        {
            EnsureSecretLoaded();
            return !string.IsNullOrEmpty(_secret);
        }
    }

    private void EnsureSecretLoaded()
    {
        if (!string.IsNullOrEmpty(_secret) || _ssmAttempted) return;
        _ssmAttempted = true;
        try
        {
            var res = _ssm.GetParameterAsync(new GetParameterRequest
            {
                Name = SsmSecretPath,
                WithDecryption = true,
            }).GetAwaiter().GetResult();
            var v = (res.Parameter?.Value ?? "").Trim();
            if (v.Length > 0) _secret = v;
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Turnstile SSM secret not loaded from {Path}", SsmSecretPath);
        }
    }

    public async Task<ContactFormBotVerifyResult> VerifyAsync(string? token, string? remoteIp, CancellationToken cancellationToken)
    {
        if (!IsEnabled)
            return new ContactFormBotVerifyResult(true, "disabled");

        if (string.IsNullOrWhiteSpace(token))
            return new ContactFormBotVerifyResult(false, "captcha_missing");

        try
        {
            using var content = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["secret"] = _secret!,
                ["response"] = token.Trim(),
                ["remoteip"] = remoteIp ?? "",
            });
            using var res = await _http.PostAsync("https://challenges.cloudflare.com/turnstile/v0/siteverify", content, cancellationToken);
            var json = await res.Content.ReadAsStringAsync(cancellationToken);
            using var doc = System.Text.Json.JsonDocument.Parse(json);
            var root = doc.RootElement;
            var success = root.TryGetProperty("success", out var s) && s.ValueKind == System.Text.Json.JsonValueKind.True;
            if (!success)
                return new ContactFormBotVerifyResult(false, "captcha_invalid");

            if (root.TryGetProperty("hostname", out var hostEl))
            {
                var host = (hostEl.GetString() ?? "").Trim().ToLowerInvariant();
                if (host.Length > 0
                    && !string.Equals(host, _expectedHost, StringComparison.OrdinalIgnoreCase)
                    && !host.EndsWith("." + _expectedHost, StringComparison.OrdinalIgnoreCase))
                {
                    return new ContactFormBotVerifyResult(false, "captcha_hostname");
                }
            }

            return new ContactFormBotVerifyResult(true, "captcha_ok");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Turnstile verification request failed");
            return new ContactFormBotVerifyResult(false, "captcha_error");
        }
    }
}
