using System.Net.Mail;
using System.Text.RegularExpressions;
using GetTrainMate.Api.Models;

namespace GetTrainMate.Api.Services.PartnerOutreach;

public class ManualContactRequest
{
    public string? Email { get; set; }
    public string? ContactName { get; set; }
    public string? ContactRole { get; set; }
    public string? JobTitle { get; set; }
    public string? Phone { get; set; }
    public string? SourceUrl { get; set; }
    public string? Notes { get; set; }
    /// <summary>When true, save even if email already belongs to another prospect/customer.</summary>
    public bool ConfirmDuplicate { get; set; }
}

/// <summary>
/// Pure helpers for admin manual contact entry (no Dynamo I/O).
/// </summary>
public static class ManualContactRules
{
    public const string EmailSourceManualAdmin = "manual_admin";
    public const string ContactSourceTypeManualAdmin = "MANUAL_ADMIN";
    public const string VerificationManualUnverified = "manual_unverified";

    static readonly Regex SimpleEmail = new(
        @"^[^@\s]+@[^@\s]+\.[^@\s]+$",
        RegexOptions.Compiled | RegexOptions.CultureInvariant);

    public static string? NormalizeEmail(string? raw)
    {
        var email = (raw ?? "").Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(email)) return null;
        return email;
    }

    public static bool IsValidEmailSyntax(string? email)
    {
        var normalized = NormalizeEmail(email);
        if (normalized is null) return false;
        if (!SimpleEmail.IsMatch(normalized)) return false;
        try
        {
            _ = new MailAddress(normalized);
            return true;
        }
        catch
        {
            return false;
        }
    }

    /// <summary>
    /// Apply manual contact fields onto an existing prospect. Does not persist.
    /// Does not create drafts or send mail.
    /// </summary>
    public static void ApplyManualContact(
        PartnerProspect p,
        string email,
        string? contactName,
        string? contactRole,
        string? phone,
        string? sourceUrl,
        string? notes,
        string actor,
        DateTime utcNow)
    {
        var previousEmail = p.Email;
        p.Email = email;
        p.EmailSource = EmailSourceManualAdmin;
        p.ContactSourceType = ContactSourceTypeManualAdmin;
        p.EmailVerificationStatus = VerificationManualUnverified;
        p.EmailVerifiedOn = null; // not verified by system
        p.OfficialDomain = email.Contains('@') ? email.Split('@')[1] : p.OfficialDomain;

        if (!string.IsNullOrWhiteSpace(contactName))
            p.ContactName = contactName.Trim();
        if (!string.IsNullOrWhiteSpace(contactRole))
            p.ContactRole = contactRole.Trim();
        if (!string.IsNullOrWhiteSpace(phone))
            p.Phone = phone.Trim();
        if (!string.IsNullOrWhiteSpace(sourceUrl))
        {
            p.ContactSourceUrl = sourceUrl.Trim();
            p.SourceUrl = string.IsNullOrWhiteSpace(p.SourceUrl) ? sourceUrl.Trim() : p.SourceUrl;
        }

        if (!string.IsNullOrWhiteSpace(notes))
        {
            var stamp = utcNow.ToString("yyyy-MM-dd HH:mm") + "Z";
            var line = $"[Manual contact {stamp} by {actor}] {notes.Trim()}";
            p.Notes = string.IsNullOrWhiteSpace(p.Notes) ? line : p.Notes.TrimEnd() + "\n" + line;
        }

        p.ContactState = PartnerCrmLifecycle.ContactFound;
        p.ContactabilityState = PartnerCrmLifecycle.ContactFound;
        p.NextResearchAt = null;
        p.ContactabilityScore = Math.Max(p.ContactabilityScore, 70);
        p.ContactQualityScore = Math.Max(p.ContactQualityScore, 70);
        p.LastEvaluatedAt = utcNow;

        if (string.Equals(p.Status, "no_verified_public_email", StringComparison.OrdinalIgnoreCase)
            || string.Equals(p.Status, "discovered", StringComparison.OrdinalIgnoreCase)
            || string.IsNullOrWhiteSpace(p.Status))
            p.Status = "prospect";

        if (string.IsNullOrWhiteSpace(p.CrmLifecycle) || p.CrmLifecycle == PartnerCrmLifecycle.New)
            p.CrmLifecycle = PartnerCrmLifecycle.Qualified;

        // Force re-derive acquisition status from the new contact (clear CONTACT_NEEDED).
        var priorAcq = (p.AcquisitionStatus ?? "").ToUpperInvariant();
        if (priorAcq is "" or PartnerCrmLifecycle.AcqContactNeeded or PartnerCrmLifecycle.AcqDiscovered
            or "CONTACT_NEEDED" or "DISCOVERED")
        {
            p.AcquisitionStatus = null;
        }

        PartnerCrmLifecycle.NormalizeAcquisitionDimensions(p);
        if (string.IsNullOrWhiteSpace(p.AcquisitionStatus)
            || p.AcquisitionStatus == PartnerCrmLifecycle.AcqContactNeeded
            || p.AcquisitionStatus == PartnerCrmLifecycle.AcqDiscovered)
        {
            p.AcquisitionStatus = PartnerCrmLifecycle.AcqContactable;
        }

        var replaced = !string.IsNullOrWhiteSpace(previousEmail)
            && !string.Equals(previousEmail, email, StringComparison.OrdinalIgnoreCase);
        PartnerCrmLifecycle.AppendTimelineEvent(
            p,
            replaced ? "manual_contact_replaced" : "manual_contact_added",
            replaced ? "Manual contact replaced by admin" : "Manual contact added by admin",
            utcNow,
            new
            {
                email,
                previousEmail = replaced ? previousEmail : null,
                contactName = p.ContactName,
                contactRole = p.ContactRole,
                sourceUrl = p.ContactSourceUrl,
                actor,
                emailSource = EmailSourceManualAdmin,
            });
    }
}
