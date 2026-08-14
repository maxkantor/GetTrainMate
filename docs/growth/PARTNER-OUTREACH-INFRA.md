# Partner outreach CRM — infrastructure plan (do not apply yet)

**Status:** Application code is in the repo. **Campaign sending defaults to disabled.**  
**Do not** create DNS, MX, SES receipt rules, S3 inbound buckets, IAM roles, or EventBridge schedules until Max approves this plan.

Existing transactional mail (`noreply@gettrainmate.com` via `EmailService.SendEmailAsync`) stays unchanged.

## Architecture (fits current stack)

| Piece | Approach |
|-------|----------|
| CRM UI | Admin → Partner Outreach (`/admin/partner-outreach`), same Admin token as Contacts CRM |
| Approval + queue + threads | DynamoDB tables (created only with CDK context `enablePartnerOutreachInfra=true`) |
| Outbound MIME | Existing API Lambda + `IEmailService.SendRawEmailAsync` (SES `SendRawEmail`, us-east-1) |
| Daily batch | EventBridge → `POST /api/internal/partner-outreach/dispatch` with `X-Partner-Email-Token` (not Cursor SES IAM) |
| Delivery events | SES configuration set → EventBridge/SNS → `POST /api/internal/partner-outreach/events` |
| Inbound replies | SES receipt rule for `partners@gettrainmate.com` → encrypted S3 → processor Lambda → `POST /api/internal/partner-outreach/inbound` |
| Admin ping | Existing SES `SendEmailAsync` to SSM `/gettrainmate/ses-admin-email` (informational; reply in CRM) |
| Public opt-out | `GET/POST /email/unsubscribe?t=` signed token (no email in URL) |

Cursor Wednesday automation **must not** receive `PARTNER_EMAIL_INTERNAL_TOKEN` or `PARTNER_OUTREACH_SEND_ENABLED`.

## Preferred identities

- From: `Max from GetTrainMate <partners@gettrainmate.com>`
- Reply-To: `partners@gettrainmate.com`
- Do not use `gettrainmate@gmail.com` or `noreply@` for partner outreach
- Optional alias later: `marketing@gettrainmate.com`

## DNS records to add (inspect existing first)

Region: **us-east-1** (SES receiving is supported here).

Before applying, run:

```bash
aws route53 list-resource-record-sets --hosted-zone-id <ZONE> --query "ResourceRecordSets[?Name=='gettrainmate.com.' || Name=='bounce.gettrainmate.com.']"
aws ses get-identity-dkim-attributes --identities gettrainmate.com --region us-east-1
aws ses get-identity-mail-from-domain-attributes --identities gettrainmate.com --region us-east-1
```

**Never delete or overwrite** an existing MX, SPF, DKIM, or DMARC row. Merge TXT/SPF includes instead.

Proposed **new** records (values must be copied from SES console after identity/mail-from setup):

| Name | Type | Value (placeholder) |
|------|------|---------------------|
| `gettrainmate.com` | TXT (SPF) | Keep current `v=spf1` and **add** `include:amazonses.com` if missing |
| `_dmarc.gettrainmate.com` | TXT | `v=DMARC1; p=none; rua=mailto:partners@gettrainmate.com; fo=1` (monitoring only) |
| Easy DKIM CNAMEs | CNAME | Three `*.dkim.amazonses.com` hosts from SES |
| `bounce.gettrainmate.com` | MX | `10 feedback-smtp.us-east-1.amazonses.com` |
| `bounce.gettrainmate.com` | TXT | `v=spf1 include:amazonses.com -all` |
| `gettrainmate.com` MX for inbound | MX | `10 inbound-smtp.us-east-1.amazonaws.com` **only if** no other MX exists. If Amplify/Google/Microsoft MX already exists, **stop** and use a subdomain such as `partners-in.gettrainmate.com` instead of replacing apex MX. |

Apex MX collision is the main production risk. GetTrainMate’s website is on Amplify; mail may already route elsewhere.

## SES

1. Verify domain `gettrainmate.com` (already verified historically).
2. Enable Easy DKIM.
3. Custom MAIL FROM `bounce.gettrainmate.com`.
4. Verify `partners@gettrainmate.com` (or domain-wide sending).
5. Configuration set `gettrainmate-partner-outreach` with events: send, delivery, bounce, complaint, reject, rendering failure, delivery delay. Tag only `gtm_mid` (opaque id, no PII).
6. Receipt rule set: recipient `partners@gettrainmate.com`; TLS; drop virus-fail; S3 store + Lambda notify.
7. Account-level suppression for bounces/complaints.

## SSM / env (do not commit values)

| Name | Purpose |
|------|---------|
| `/gettrainmate/ses-admin-email` | Admin notification inbox (existing) |
| `/gettrainmate/partner/from-email` | `partners@gettrainmate.com` |
| `/gettrainmate/partner/reply-to-email` | `partners@gettrainmate.com` |
| `/gettrainmate/partner/postal-address` | `GETTRAINMATE_BUSINESS_POSTAL_ADDRESS` — **required before any campaign send** |
| `/gettrainmate/partner/send-enabled` | `false` until Phase 5 |
| `/gettrainmate/partner/daily-limit` | `3` |
| `/gettrainmate/partner/unsubscribe-secret` | HMAC secret |
| `/gettrainmate/partner/internal-token` | `X-Partner-Email-Token` |
| `/gettrainmate/partner/inbound-bucket` | encrypted S3 name |
| `/gettrainmate/partner/ses-configuration-set` | `gettrainmate-partner-outreach` |
| `/gettrainmate/partner/crm-base-url` | `https://gettrainmate.com` |

Lambda env mirrors: `PARTNER_FROM_EMAIL`, `PARTNER_REPLY_TO_EMAIL`, `GETTRAINMATE_BUSINESS_POSTAL_ADDRESS`, `PARTNER_OUTREACH_SEND_ENABLED=false`, `PARTNER_DAILY_SEND_LIMIT=3`, `PARTNER_UNSUBSCRIBE_SIGNING_SECRET`, `PARTNER_EMAIL_INTERNAL_TOKEN`, `PARTNER_SES_CONFIGURATION_SET`.

## IAM (separate from `cursor-gettrainmate-growth`)

| Role | Allow |
|------|--------|
| API Lambda (existing) | `ses:SendEmail` (transactional, already granted). After approval, add `ses:SendRawEmail` from `partners@` only if not already covered by `*`. DynamoDB partner tables when created. |
| Outbound dispatcher | Invoke API dispatch **or** `ses:SendRawEmail` + queue table read/write. No DynamoDB user PII tables beyond partner-* . |
| Inbound processor | `s3:GetObject` inbound bucket, `ses:SendEmail` to admin notify via API, partner tables write |
| Event processor | partner queue/settings update only |

Do **not** attach these to the Cursor growth IAM user.

## CDK

Tables are **not** created on a normal `cdk deploy`. Opt in only after approval:

```bash
npx cdk deploy --context enablePartnerOutreachInfra=true
```

## Manual sequence after Max approval

1. Inventory current MX/SPF/DKIM/DMARC.
2. Set postal address SSM (cannot invent it).
3. Create SSM secrets listed above; keep `send-enabled=false`.
4. Deploy API (zip/Lambda) so CRM routes exist.
5. Enable CDK tables.
6. Create inbound S3 bucket (SSE-S3 or SSE-KMS), lifecycle 2555 days.
7. SES config set + receipt rule.
8. EventBridge: `cron(0 14 ? * MON-FRI *)` is **wrong** across DST. Use a timezone-aware schedule (`America/New_York` 10:00) or have the dispatcher no-op outside `IsDispatchWindow`.
9. Max-only test to Admin email, subject `[TEST] GetTrainMate Partner Email`.
10. Enable `PARTNER_OUTREACH_SEND_ENABLED=true` only after UTF-8 + threading look correct.

## Compliance

- List-Unsubscribe + One-Click
- Visible unsub URL + postal footer
- No tracking pixels / external fonts / JS
- No auto-replies, no auto follow-ups in v1
- Complaint pauses all campaign sending
- Transactional mail is a separate From identity
