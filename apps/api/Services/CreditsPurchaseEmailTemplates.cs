using System.Collections.Generic;
using System.Globalization;
using System.Net;
using System.Text;

namespace GetTrainMate.Api.Services;

/// <summary>Branded purchase confirmation HTML + plain text (SES-safe, table layout).</summary>
public static class CreditsPurchaseEmailTemplates
{
    private const int MaxEmailWidthPx = 600;

    public static string FormatMoney(long? amountTotalCents, string? currency)
    {
        if (!amountTotalCents.HasValue || amountTotalCents.Value < 0)
            return "—";
        var cur = (currency ?? "usd").Trim().ToUpperInvariant();
        var amount = amountTotalCents.Value / 100m;
        if (cur == "USD")
            return $"${amount.ToString("F2", CultureInfo.InvariantCulture)}";
        return $"{amount.ToString("F2", CultureInfo.InvariantCulture)} {cur}";
    }

    private static bool EmailsAreEquivalent(string? a, string? b)
    {
        if (string.IsNullOrWhiteSpace(a) || string.IsNullOrWhiteSpace(b))
            return false;
        return string.Equals(a.Trim(), b.Trim(), StringComparison.OrdinalIgnoreCase);
    }

    private static string StripeAccountComparisonLine(string? stripePayerEmail, string? accountEmail)
    {
        var hasStripe = !string.IsNullOrWhiteSpace(stripePayerEmail);
        var hasAcct = !string.IsNullOrWhiteSpace(accountEmail);
        if (!hasStripe && !hasAcct)
            return "Stripe vs account: (no emails to compare)";
        if (hasStripe && hasAcct)
            return EmailsAreEquivalent(stripePayerEmail, accountEmail)
                ? "Stripe vs account: same address"
                : "Stripe vs account: different addresses";
        return "Stripe vs account: partial (one side missing)";
    }

    /// <param name="stripeCheckoutEmail">Email used at Stripe (receipt recipient). Never the Cognito/profile email unless they match.</param>
    /// <param name="accountEmail">Sign-in / profile email from the app, when known.</param>
    public static (string Subject, string Text, string Html) BuildCustomerPurchaseEmail(
        int credits,
        string packDisplayTitle,
        string amountPaidFormatted,
        string appBaseUrl,
        string? supportEmail,
        string stripeCheckoutEmail,
        string? accountEmail)
    {
        var subject = "Your GetTrainMate credits are ready";
        var safePack = WebUtility.HtmlEncode(packDisplayTitle);
        var safeAmount = WebUtility.HtmlEncode(amountPaidFormatted);
        var safeApp = appBaseUrl.Trim().TrimEnd('/');
        var safeAppEnc = WebUtility.HtmlEncode(safeApp);
        var safeStripe = WebUtility.HtmlEncode(stripeCheckoutEmail.Trim());

        var text = new StringBuilder();
        text.AppendLine("Thanks for your purchase — your credits have been added to your account and are ready to use.");
        text.AppendLine();
        text.AppendLine($"Credits added: {credits}");
        text.AppendLine($"Plan: {packDisplayTitle}");
        text.AppendLine($"Amount paid: {amountPaidFormatted}");
        text.AppendLine();
        if (!string.IsNullOrWhiteSpace(accountEmail) && !EmailsAreEquivalent(stripeCheckoutEmail, accountEmail))
        {
            text.AppendLine("About this email:");
            text.AppendLine($"- Receipt sent to: {stripeCheckoutEmail.Trim()} (the address used at Stripe checkout).");
            text.AppendLine($"- Your GetTrainMate sign-in / profile email: {accountEmail.Trim()} (credits are on this account).");
            text.AppendLine("These can differ — your payment receipt goes to Stripe; credits apply to your signed-in app account.");
            text.AppendLine();
        }
        else if (!string.IsNullOrWhiteSpace(accountEmail) && EmailsAreEquivalent(stripeCheckoutEmail, accountEmail))
        {
            text.AppendLine($"This receipt was sent to {stripeCheckoutEmail.Trim()} — the same address as your GetTrainMate account.");
            text.AppendLine();
        }
        else
        {
            text.AppendLine($"This receipt was sent to {stripeCheckoutEmail.Trim()} (Stripe checkout). Sign in to the app with your usual GetTrainMate account to use your credits.");
            text.AppendLine();
        }

        text.AppendLine("Use your credits to:");
        text.AppendLine("- Unlock chats with matches");
        text.AppendLine("- Boost your profile");
        text.AppendLine("- Reveal likes (where available)");
        text.AppendLine("- Access AI coach and insights");
        text.AppendLine();
        text.AppendLine("Credits stay on your account until you use them.");
        text.AppendLine();
        text.AppendLine($"Open GetTrainMate: {safeApp}");
        text.AppendLine();
        if (!string.IsNullOrWhiteSpace(supportEmail))
        {
            text.AppendLine($"If you have questions, contact us at {supportEmail.Trim()}.");
        }
        else
        {
            text.AppendLine("If you have questions, reply to this email and we'll help.");
        }

        text.AppendLine();
        text.AppendLine("—");
        text.AppendLine("GetTrainMate");
        text.AppendLine("Find your perfect training partner.");

        var supportLineHtml = !string.IsNullOrWhiteSpace(supportEmail)
            ? $"<p style=\"margin:16px 0 0;font-size:14px;line-height:1.55;color:#94a3b8;\">Questions? Email us at <a href=\"mailto:{WebUtility.HtmlEncode(supportEmail.Trim())}\" style=\"color:#c4b5fd;text-decoration:none;\">{WebUtility.HtmlEncode(supportEmail.Trim())}</a>.</p>"
            : "<p style=\"margin:16px 0 0;font-size:14px;line-height:1.55;color:#94a3b8;\">If you need help, reply to this email.</p>";

        string emailContextHtml;
        if (!string.IsNullOrWhiteSpace(accountEmail) && !EmailsAreEquivalent(stripeCheckoutEmail, accountEmail))
        {
            var safeAcct = WebUtility.HtmlEncode(accountEmail.Trim());
            emailContextHtml = $@"<table role=""presentation"" width=""100%"" cellspacing=""0"" cellpadding=""0"" style=""margin:0 0 20px;background:rgba(30,41,59,0.5);border-radius:12px;border:1px solid rgba(129,140,248,0.25);"">
<tr><td style=""padding:16px 18px;"">
<p style=""margin:0 0 8px;font-size:13px;font-weight:700;color:#e2e8f0;text-transform:uppercase;letter-spacing:0.06em;"">Checkout vs account email</p>
<p style=""margin:0;font-size:14px;line-height:1.55;color:#cbd5e1;""><strong style=""color:#fef3c7;"">Stripe checkout:</strong> {safeStripe}</p>
<p style=""margin:10px 0 0;font-size:14px;line-height:1.55;color:#cbd5e1;""><strong style=""color:#a5b4fc;"">Your app sign-in:</strong> {safeAcct}</p>
<p style=""margin:12px 0 0;font-size:13px;line-height:1.5;color:#94a3b8;"">Credits are on your GetTrainMate account. This receipt is sent to the email used to pay in Stripe — they can differ, and that&apos;s expected.</p>
</td></tr></table>";
        }
        else if (!string.IsNullOrWhiteSpace(accountEmail) && EmailsAreEquivalent(stripeCheckoutEmail, accountEmail))
        {
            emailContextHtml = $@"<p style=""margin:0 0 20px;font-size:14px;line-height:1.55;color:#94a3b8;"">Receipt for <strong style=""color:#e2e8f0;"">{safeStripe}</strong> — same as your GetTrainMate account email.</p>";
        }
        else
        {
            emailContextHtml = $@"<p style=""margin:0 0 20px;font-size:14px;line-height:1.55;color:#94a3b8;"">Receipt sent to <strong style=""color:#e2e8f0;"">{safeStripe}</strong> (Stripe). Sign in with your GetTrainMate account to use credits.</p>";
        }

        var html = $@"<!DOCTYPE html>
<html lang=""en"">
<head><meta charset=""utf-8""/><meta name=""viewport"" content=""width=device-width,initial-scale=1""/>
<title>{WebUtility.HtmlEncode(subject)}</title></head>
<body style=""margin:0;padding:0;background-color:#0b1020;"">
<table role=""presentation"" width=""100%"" cellspacing=""0"" cellpadding=""0"" style=""background-color:#0b1020;padding:24px 12px;"">
<tr><td align=""center"">
<table role=""presentation"" width=""{MaxEmailWidthPx}"" cellspacing=""0"" cellpadding=""0"" style=""max-width:{MaxEmailWidthPx}px;width:100%;background:linear-gradient(180deg,#111827 0%,#0f172a 100%);border-radius:16px;border:1px solid rgba(148,163,184,0.18);overflow:hidden;"">
<tr><td style=""padding:28px 28px 8px;text-align:left;background:linear-gradient(90deg,#4f46e5 0%,#7c3aed 55%,#c026d3 100%);"">
<p style=""margin:0;font-size:13px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.92);"">GetTrainMate</p>
</td></tr>
<tr><td style=""padding:28px 28px 8px;"">
<h1 style=""margin:0 0 12px;font-family:Georgia,'Segoe UI',system-ui,sans-serif;font-size:26px;line-height:1.2;font-weight:800;color:#f8fafc;"">Your credits are ready</h1>
<p style=""margin:0 0 20px;font-size:16px;line-height:1.55;color:#cbd5e1;"">Thanks for your purchase — your credits have been added to your account and are ready to use.</p>
{emailContextHtml}
<table role=""presentation"" width=""100%"" cellspacing=""0"" cellpadding=""0"" style=""background:rgba(30,41,59,0.65);border-radius:12px;border:1px solid rgba(148,163,184,0.2);"">
<tr><td style=""padding:18px 20px;"">
<p style=""margin:0 0 10px;font-size:14px;color:#94a3b8;""><span style=""display:inline-block;min-width:120px;"">Credits added</span> <strong style=""color:#fef3c7;font-size:16px;"">{credits}</strong></p>
<p style=""margin:0 0 10px;font-size:14px;color:#94a3b8;""><span style=""display:inline-block;min-width:120px;"">Plan</span> <strong style=""color:#e2e8f0;"">{safePack}</strong></p>
<p style=""margin:0;font-size:14px;color:#94a3b8;""><span style=""display:inline-block;min-width:120px;"">Amount paid</span> <strong style=""color:#e2e8f0;"">{safeAmount}</strong></p>
</td></tr></table>
<h2 style=""margin:24px 0 10px;font-size:15px;font-weight:700;color:#e2e8f0;"">What you can do now</h2>
<ul style=""margin:0;padding:0 0 0 18px;color:#cbd5e1;font-size:15px;line-height:1.65;"">
<li style=""margin:0 0 6px;"">Unlock chats with matches</li>
<li style=""margin:0 0 6px;"">Boost your profile</li>
<li style=""margin:0 0 6px;"">Reveal likes (where available)</li>
<li style=""margin:0 0 6px;"">Use AI coach and match insights</li>
</ul>
<p style=""margin:18px 0 0;font-size:14px;line-height:1.55;color:#94a3b8;"">Credits stay on your account until you use them.</p>
<table role=""presentation"" cellspacing=""0"" cellpadding=""0"" style=""margin:28px auto 0;"">
<tr><td align=""center"" bgcolor=""#6366f1"" style=""border-radius:10px;background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%);"">
<a href=""{safeAppEnc}"" style=""display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:#ffffff !important;text-decoration:none;font-family:system-ui,-apple-system,sans-serif;"">Go to GetTrainMate</a>
</td></tr></table>
{supportLineHtml}
</td></tr>
<tr><td style=""padding:20px 28px 28px;border-top:1px solid rgba(148,163,184,0.15);"">
<p style=""margin:0;font-size:12px;line-height:1.5;color:#64748b;"">GetTrainMate · Find your perfect training partner.</p>
</td></tr>
</table>
</td></tr></table>
</body></html>";

        return (subject, text.ToString(), html);
    }

    public static (string Subject, string Text, string Html) BuildAdminCreditsPurchaseEmail(
        string userId,
        string? stripePayerEmail,
        string? accountEmail,
        int credits,
        string packKey,
        string packDisplayTitle,
        string stripeSessionId,
        string? paymentIntentId,
        long? amountTotalCents,
        string? currency)
    {
        var subject = "[GetTrainMate Admin] Credit purchase completed";
        var when = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss 'UTC'", CultureInfo.InvariantCulture);
        var amountHuman = FormatMoney(amountTotalCents, currency);

        var lines = new List<string>
        {
            "A credit purchase was completed.",
            "",
            $"Time (UTC): {when}",
            $"Payer email (Stripe checkout): {(string.IsNullOrWhiteSpace(stripePayerEmail) ? "(not captured on session)" : stripePayerEmail.Trim())}",
            $"Account email (app profile / sign-in): {(string.IsNullOrWhiteSpace(accountEmail) ? "(not on profile)" : accountEmail.Trim())}",
            StripeAccountComparisonLine(stripePayerEmail, accountEmail),
            $"User ID (internal): {userId}",
            $"Pack key: {packKey}",
            $"Pack title: {packDisplayTitle}",
            $"Credits: {credits}",
            $"Amount: {amountHuman}",
            $"Stripe Checkout session: {stripeSessionId}",
        };
        if (!string.IsNullOrWhiteSpace(paymentIntentId))
            lines.Add($"Stripe PaymentIntent: {paymentIntentId}");

        var text = string.Join(Environment.NewLine, lines);

        var html = new StringBuilder();
        html.Append("<!DOCTYPE html><html><head><meta charset=\"utf-8\"/></head><body style=\"font-family:system-ui,sans-serif;background:#f8fafc;padding:16px;\">");
        html.Append("<table role=\"presentation\" style=\"max-width:640px;margin:0 auto;background:#fff;border:1px solid #e2e8f8;border-radius:8px;padding:20px;\">");
        html.Append($"<tr><td><h2 style=\"margin:0 0 12px;font-size:18px;color:#0f172a;\">{WebUtility.HtmlEncode(subject)}</h2></td></tr>");
        foreach (var line in lines)
        {
            if (string.IsNullOrEmpty(line))
            {
                html.Append("<tr><td style=\"height:8px;\"></td></tr>");
                continue;
            }
            html.Append("<tr><td style=\"font-size:14px;line-height:1.5;color:#334155;padding:2px 0;\">");
            html.Append(WebUtility.HtmlEncode(line));
            html.Append("</td></tr>");
        }
        html.Append("</table></body></html>");

        return (subject, text, html.ToString());
    }
}
