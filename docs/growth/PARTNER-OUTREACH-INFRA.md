# Partner outreach CRM — infrastructure plan

**Status (Nov 21, 2026): Max approved the inbound reply path.** The plumbing is
implemented in the repo behind CDK context `enablePartnerOutreachInfra=true`
(see `infra/stacks/main-stack.ts` `createPartnerInboundInfra`, the processor
Lambda `infra/lambdas/inbound-processor/`, and the API Startup SSM token load).
It is NOT yet deployed: the GitHub OIDC role cannot do the AWS writes (verified
Nov 21 — see Deployment runbook below). Do not run `cdk-deploy.yml` until the
IAM grant in the runbook is attached to the OIDC role.
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

---

## Deployment runbook — inbound reply path (Nov 21, 2026)

Verified live Nov 21 (inspection run 44937858217, main branch):
- AWS account `718522948657`; OIDC role `arn:aws:iam::718522948657:role/GetTrainMateGitHubGrowth`.
- The role trusts `refs/heads/main` only — a branch run fails `AssumeRoleWithWebIdentity`. All deploy/inspection workflows must run from main.
- `PARTNER_SES_CONFIGURATION_SET=gettrainmate-partner-outreach` IS set on the live API Lambda (delivery events were never the problem — see below).
- `PARTNER_EMAIL_INTERNAL_TOKEN` is UNSET on the live Lambda, so `POST /api/internal/partner-outreach/inbound` rejects everything today. The API now reads the token from SSM `/gettrainmate/partner/internal-token` at startup (Startup.cs); the processor reads the same parameter at runtime. Create the parameter once (step 2) — no secret value belongs in code, env, or chat.
- DNS is Route53 (awsdns name servers, verified Nov 21). No MX / SPF / DMARC exist. The hosted zone ID is NOT discoverable by the OIDC role (`route53:ListHostedZones` denied) — read it from the Route53 console (Hosted zones → gettrainmate.com) and pass it as the `route53_hosted_zone_id` input to `cdk-deploy.yml`.
- "Delivered NOT TRACKED" was a hardcoded placeholder in `AnalyticsPanel.tsx`, not a telemetry failure: the metrics API already returns the delivered count and the settings API already returns `deliveredTracking=CONFIGURED`. Fixed in the web app (card now shows the real count when tracking is configured). Web deploys via Amplify on push to main.

### 1. IAM grant (needs Max's approval — do not assume it)

Attach this policy (or its equivalent) to `GetTrainMateGitHubGrowth`. Replace
`<ZONE_ID>` with the Route53 hosted zone ID. Scope is deliberately narrow:
only the stack, the inbound bucket, the processor function, the receipt rule
set, and the one hosted zone. If a deploy fails on a missing action, add
exactly that action scoped to the same resources and re-run — do not widen
to `*`.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "CdkDeployStacks",
      "Effect": "Allow",
      "Action": [
        "cloudformation:CreateChangeSet", "cloudformation:ExecuteChangeSet",
        "cloudformation:DescribeStacks", "cloudformation:DescribeStackEvents",
        "cloudformation:DescribeChangeSet", "cloudformation:DeleteChangeSet",
        "cloudformation:GetTemplateSummary", "cloudformation:DescribeStackResources"
      ],
      "Resource": [
        "arn:aws:cloudformation:us-east-1:718522948657:stack/GetTrainMateStack/*",
        "arn:aws:cloudformation:us-east-1:718522948657:stack/CDKToolkit/*"
      ]
    },
    {
      "Sid": "CdkAssets",
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject", "s3:ListBucket", "s3:GetBucketLocation"],
      "Resource": [
        "arn:aws:s3:::cdk-*-assets-718522948657-us-east-1",
        "arn:aws:s3:::cdk-*-assets-718522948657-us-east-1/*"
      ]
    },
    {
      "Sid": "ProcessorLambda",
      "Effect": "Allow",
      "Action": [
        "lambda:CreateFunction", "lambda:DeleteFunction", "lambda:UpdateFunctionCode",
        "lambda:UpdateFunctionConfiguration", "lambda:GetFunction",
        "lambda:AddPermission", "lambda:RemovePermission", "lambda:TagResource"
      ],
      "Resource": "arn:aws:lambda:us-east-1:718522948657:function:GetTrainMateStack-PartnerInboundProcessor*"
    },
    {
      "Sid": "ProcessorRole",
      "Effect": "Allow",
      "Action": [
        "iam:CreateRole", "iam:DeleteRole", "iam:GetRole", "iam:PutRolePolicy",
        "iam:DeleteRolePolicy", "iam:AttachRolePolicy", "iam:DetachRolePolicy", "iam:PassRole"
      ],
      "Resource": "arn:aws:iam::718522948657:role/GetTrainMateStack-PartnerInboundProcessor*"
    },
    {
      "Sid": "InboundBucket",
      "Effect": "Allow",
      "Action": [
        "s3:CreateBucket", "s3:DeleteBucket", "s3:PutBucketPolicy", "s3:DeleteBucketPolicy",
        "s3:PutEncryptionConfiguration", "s3:PutLifecycleConfiguration",
        "s3:PutBucketPublicAccessBlock", "s3:GetBucketPolicy", "s3:GetEncryptionConfiguration",
        "s3:GetLifecycleConfiguration", "s3:ListBucket"
      ],
      "Resource": "arn:aws:s3:::gettrainmate-partner-inbound"
    },
    {
      "Sid": "SesReceipt",
      "Effect": "Allow",
      "Action": [
        "ses:CreateReceiptRuleSet", "ses:DeleteReceiptRuleSet", "ses:CreateReceiptRule",
        "ses:DeleteReceiptRule", "ses:DescribeReceiptRuleSet", "ses:DescribeActiveReceiptRuleSet",
        "ses:SetActiveReceiptRuleSet", "ses:GetIdentityDkimAttributes",
        "ses:GetIdentityMailFromDomainAttributes", "ses:ListConfigurationSets",
        "ses:DescribeConfigurationSet"
      ],
      "Resource": "*"
    },
    {
      "Sid": "Route53Zone",
      "Effect": "Allow",
      "Action": ["route53:ChangeResourceRecordSets", "route53:ListResourceRecordSets", "route53:GetHostedZone"],
      "Resource": "arn:aws:route53:::hostedzone/<ZONE_ID>"
    },
    {
      "Sid": "SsmToken",
      "Effect": "Allow",
      "Action": ["ssm:PutParameter", "ssm:GetParameter", "ssm:DescribeParameters"],
      "Resource": "arn:aws:ssm:us-east-1:718522948657:parameter/gettrainmate/*"
    }
  ]
}
```

The OIDC role is known (Nov 21) to already allow `lambda:GetFunction`,
`lambda:UpdateFunctionCode` on the API function, and `sts:GetCallerIdentity`.
It is known NOT to allow `route53:*`, `ses:*` reads, `s3:ListAllMyBuckets`,
`ssm:DescribeParameters`, or `iam:List*` on itself.

### 2. Create the internal token (one time, console or CLI — value never printed)

```bash
aws ssm put-parameter --name /gettrainmate/partner/internal-token \
  --type SecureString --value "$(openssl rand -hex 32)" --region us-east-1
```

Only if the parameter does not already exist. The API (Startup SSM load) and
the processor (runtime SSM read) both use it. Do not put the value in code,
env, or chat.

### 3. Deploy

Run `.github/workflows/cdk-deploy.yml` (manual dispatch, from main) with the
`route53_hosted_zone_id` input. It deploys with
`--context enablePartnerOutreachInfra=true`, checks no other receipt rule set
is active (it refuses to replace one — decide manually if one exists), then
activates `gettrainmate-partner-inbound` and verifies the rule set.

### 4. End-to-end test (Max only — no prospect contact)

1. Max sends an email from his own address to `partners@gettrainmate.com`
   (subject e.g. `[TEST] reply path`).
2. Confirm: an object appears in S3 `gettrainmate-partner-inbound` (key = SES
   messageId); the processor Lambda logs show the POST to
   `/api/internal/partner-outreach/inbound` succeeding; the CRM Inbox shows
   the thread as "Needs response"; settings ReplyCount increments; the admin
   notification email fires (to SSM `/gettrainmate/ses-admin-email`).
3. Do NOT send or resend anything to prospects as part of the test.

### 5. Follow-ups (not in this change)

- Easy DKIM: enable on the SES identity and add the three DKIM CNAMEs from
  SES to Route53 (tokens were not readable by the OIDC role; get them from
  the SES console).
- Custom MAIL FROM `bounce.gettrainmate.com` (MX `10 feedback-smtp.us-east-1.amazonses.com`
  + TXT `v=spf1 include:amazonses.com -all`) via `ses set-identity-mail-from-domain`.
- Fix delivery telemetry display is already in this change (AnalyticsPanel);
  verify the Delivered count appears in the live admin UI after the web deploy.
