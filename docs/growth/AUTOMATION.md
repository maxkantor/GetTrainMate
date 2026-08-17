# Cursor Automation — GetTrainMate Customer Growth

**Name:** GetTrainMate Wednesday Customer Growth  
**Schedule:** **Wednesday 8:00 AM America/New_York**  
**Cron (UTC during EDT):** `0 12 * * 3` — confirm preview shows **Wednesday at 8:00 AM EDT**  
**Repo:** `maxkantor/GetTrainMate` · branch `main`  
**Notify:** Exactly **one** Admin email after the run reaches its **final** state → `node scripts/growth/compose-and-send-growth-email.mjs`  
**North star:** 1,000+ verified external paying customers. Immediate milestone: the next newly attributed external customer. Qualified Atlanta TRAIN profiles are a leading indicator, not a substitute.  
**Cost:** Prefer cheapest capable model; do not launch a new experiment merely to ship

Do **not** activate a weekday (Mon–Fri) schedule — **Wednesday only**.

---

## Cost controls (Cursor UI)

1. **Model:** Use the cheapest capable model (Composer / Auto — not premium models unless needed).
2. **Schedule:** Wednesday 8:00 AM Eastern only.
3. **Spend limit:** Set a low hard monthly limit at [cursor.com/dashboard/billing](https://cursor.com/dashboard/billing).

---

## Automation secret *names* (values from SSM / IAM — not in git)

| Secret name                         | Source                                                                                           |
| ----------------------------------- | ------------------------------------------------------------------------------------------------ |
| `GA4_PROPERTY_ID`                   | SSM `/gettrainmate/growth/ga4-property-id`                                                       |
| `GOOGLE_ANALYTICS_CREDENTIALS_JSON` | SSM `/gettrainmate/growth/google-analytics-credentials-json`                                     |
| `STRIPE_RESTRICTED_READ_KEY`        | SSM `/gettrainmate/growth/stripe-restricted-read-key` (`rk_…` only)                              |
| `AWS_ACCESS_KEY_ID`                 | SSM `/gettrainmate/growth/aws-access-key-id` or Cursor env (required for cloud agent cold start) |
| `AWS_SECRET_ACCESS_KEY`             | SSM `/gettrainmate/growth/aws-secret-access-key` or Cursor env                                   |
| `AWS_REGION`                        | `us-east-1`                                                                                      |
| `ADMIN_EMAIL` or `SES_ADMIN_EMAIL`  | Optional (else SSM `/gettrainmate/ses-admin-email`)                                              |
| `SES_FROM_EMAIL`                    | Optional (else SSM `/gettrainmate/ses-from-email`)                                               |

IAM user `cursor-gettrainmate-growth` needs `ses:SendEmail` **and** `ssm:GetParameter` on `/gettrainmate/growth/*`, `/gettrainmate/ses-from-email`, `/gettrainmate/ses-admin-email`. Without SSM read, Admin email fails unless `SES_FROM_EMAIL` + `SES_ADMIN_EMAIL` are also in Cursor Environment secrets.

Copy from SSM when needed:

```powershell
aws ssm get-parameter --name /gettrainmate/growth/ga4-property-id --region us-east-1 --query Parameter.Value --output text | Set-Clipboard
aws ssm get-parameter --name /gettrainmate/growth/google-analytics-credentials-json --with-decryption --region us-east-1 --query Parameter.Value --output text | Set-Clipboard
aws ssm get-parameter --name /gettrainmate/growth/stripe-restricted-read-key --with-decryption --region us-east-1 --query Parameter.Value --output text | Set-Clipboard
```

---

## Prompt (paste into Automations → Agent instructions)

```
Read and follow .cursor/skills/grow-paid-customers/SKILL.md and docs/growth/AUTOMATION.md.

TIMEZONE: Decide whether an evaluation is due using America/New_York (full programmed weekday + calendar date). Do not compare evaluation dates using UTC alone.

CUSTOMER ACQUISITION OVERRIDE (until the first newly attributed external customer):
North star: 1,000+ verified external paying customers. Immediate milestone: the next newly attributed external customer.
Accurate reporting is required and is NOT the primary output. Analytics, report formatting, docs, internal pages, experiment logs, health checks, draft packages, and unexposed deploys do NOT count. Deploy ≠ distributed.
Every successful run must: (1) one measurable acquisition improvement when necessary, AND (2) one real policy-compliant distribution action in front of a relevant external audience.
Distribution must be one of: approved recipient + exact approved message; owned social with explicit posting authorization; consented email list with unsubscribe; legitimate partner/community channel that permits promotion; paid ads within approved budget; product-triggered referral/share by a real user.
Never spam, invent contacts, automate comments/DMs, evade community rules, or claim visits/customers/revenue without verified attribution.
Until first newly attributed external customer: ≤1 experiment per funnel stage; prefer qualified distribution over additional CRO; do not launch another experiment merely because the run requires a ship; measure visits → activation → checkout → verified payment; report “new customers acquired by this run” separately from customers merely observed in the date window.
A run succeeds ONLY if it executes an approved external distribution action OR removes a proven blocker preventing qualified traffic from entering or completing the funnel.
KEEP-only evaluation is NOT a successful acquisition run. An unsent partner package is NOT distribution.
If Max approval is missing: prepare the EXACT action and make the Admin report LEAD with a blocking approval request. Do not substitute analytics or formatting.
Admin report MUST lead with: Distribution executed; Audience/channel; Attributed visits; Activations; Checkout starts; Newly attributed external customers; Verified revenue; Required owner approval.
Distinguish: existing customers; customers observed during the experiment window; customers causally attributed to a specific experiment; new customers acquired by the current run.

Current prepared action: docs/growth/partners/OWNER-APPROVAL-REQUEST.md (Instagram @gettrainmate exact caption, approval id IG-2026-08-17). Cursor must NOT post. Partner email send remains banned.

Qualified Atlanta TRAIN profile (leading indicator, not a customer): unique non-owner non-test; completed signup; completed required profile fields; Atlanta metro from application data; TRAIN selected; Discover-eligible and not blocked/deleted/suspended.

Report separately (never collapse): registered users; completed profiles; qualified Atlanta TRAIN profiles; Discover-eligible users; verified external paying customers; successful attributed payments; new customers acquired by this run.

STRIPE TRUTH: Count only GetTrainMate-attributed live Stripe transactions matched through the approved Product ID, Price ID, Payment Link ID, Checkout metadata allowlist, or legacy credits ownership rules (docs/growth/STRIPE-ATTRIBUTION.md). Report separately: successful attributed live payments; unique verified external paying customers; owner/test payments; unattributed payments; refunds; verified net revenue. Exclude account-wide and unattributed payments from GetTrainMate customers and revenue. Never invent users, matches, messages, reviews, or purchases. Zero is valid evidence.

READING METRICS, UPDATING DOCS, WAITING, OR SENDING ADMIN EMAIL DOES NOT COUNT AS DISTRIBUTION.

CONCURRENCY: Before collecting data or changing files, run:
  node scripts/growth/acquire-growth-lock.mjs
If it exits non-zero (active non-stale lock), STOP. Never delete or bypass an active lock. Stale duration defaults to 3 hours (GROWTH_RUN_LOCK_STALE_MS). Always release at end:
  node scripts/growth/release-growth-lock.mjs
(or --force only after confirming the lock is yours/stale).

EVALUATION DECISIONS (when an experiment is due — these do not replace distribution):
- KEEP: Record. Do not change the treatment. Then still distribute or prepare the exact blocking approval.
- ITERATE: One reversible change to THAT experiment’s treatment only. Do not launch a different experiment in the same run.
- STOP: Disable only that experiment’s treatment safely; preserve the reusable page when appropriate.
- INCONCLUSIVE: Extend once only if the log’s minimum evidence rule permits; otherwise stop the experiment. No other experiment ship in the same run.

TASK ORDER:
1) Acquire the growth-run lock. Stop if another valid run is active.
2) Verify critical production health and collect current GA4, CRM, and product-specific Stripe evidence (report only).
3) If an experiment evaluation is due/overdue (America/New_York): record KEEP/ITERATE/STOP/INCONCLUSIVE. KEEP does not end the run. Do not ship a new experiment to manufacture a code change.
4) If Max has explicitly approved the prepared distribution AND the channel is executable without banned outreach: execute it. Cursor still must not send partner email or hold PARTNER_EMAIL_INTERNAL_TOKEN. Owned social requires explicit posting authorization (reply APPROVED IG-2026-08-17).
5) Else: prepare ONE exact distribution action (exact caption or exact recipient+message on a verified public contact — never invent an inbox). Admin email MUST lead with the blocking approval. STOP. Do not substitute CRO, a new experiment, or analytics formatting.
6) Repair tracking ONLY when production inspection, application records, or a controlled test proves an expected event or attribution field is missing. Do not change tracking merely because metrics are zero.

Collision: while EXP-002 is in-flight, do not modify EXP-002 partner landing pages, invite codes, attribution parameters, eligibility, or distribution rules. Do not send traffic through an untracked overlapping treatment.

DEPLOYMENT FAILURE: If tests, build, deployment, or production verification fails: do not describe the action as shipped; repair or safely revert within the same change scope; record the failure; send one failure Admin report; release the lock; STOP without starting another acquisition action.

HARD BANS: fake activity; sending outreach; creating partner accounts; activating founding-member pricing; growth:outreach:send; PARTNER_OUTREACH_SEND_ENABLED; payments/prices/auth/secrets; inventing emails; automating comments/DMs. Preview/validate only. Cursor must not hold PARTNER_EMAIL_INTERNAL_TOKEN.

Focus: Atlanta + TRAIN. Do not spread cities. Do not equal-weight DATE/VIBE.

When shipping code: one reversible change; tests + web:build when code changed; commit/push main only if validation passes; monitor Amplify; verify production; update docs/growth/EXPERIMENT-LOG.md.

ADMIN EMAIL: Send exactly one Admin email after the run reaches its final state. Never send it before deployment verification when code shipped. The body MUST lead with the acquisition-lead fields above.
  node scripts/growth/compose-and-send-growth-email.mjs --notes "<JSON acquisition lead fields and/or short action notes>"
If Admin email fails, record the failure locally in notes/run output and report it once — do not repeat the acquisition action or send duplicate reports blindly.

Finally: node scripts/growth/release-growth-lock.mjs
```

---

## Cloud Agent Environment (Install script)

Paste into Cursor → Environment → **Install script**:

```bash
npm i --prefix scripts/growth --ignore-scripts
if ! command -v aws >/dev/null 2>&1; then
  curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o /tmp/awscliv2.zip
  unzip -q /tmp/awscliv2.zip -d /tmp
  /tmp/aws/install -i "$HOME/.local/aws-cli" -b "$HOME/.local/bin"
fi
export PATH="$HOME/.local/bin:$PATH"
```

---

## First-time local verify

```bash
npm i --prefix scripts/growth
node scripts/growth/verify-secrets.mjs
node scripts/growth/check-production-health.mjs
node scripts/growth/acquire-growth-lock.mjs
node scripts/growth/release-growth-lock.mjs
node scripts/growth/compose-and-send-growth-email.mjs --dry-run
```

See `docs/growth/SECRETS-SETUP.md` for GA4 Viewer and Stripe restricted key setup.
