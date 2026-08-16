# Cursor Automation — GetTrainMate Customer Growth

**Name:** GetTrainMate Wednesday Customer Growth  
**Schedule:** **Wednesday 8:00 AM America/New_York**  
**Cron (UTC during EDT):** `0 12 * * 3` — confirm preview shows **Wednesday at 8:00 AM EDT**  
**Repo:** `maxkantor/GetTrainMate` · branch `main`  
**Notify:** Exactly **one** Admin email after the run reaches its **final** state → `node scripts/growth/compose-and-send-growth-email.mjs`  
**North star (scoreboard, not a promise):** 1000+ **qualified Atlanta TRAIN profiles** (Discover-eligible). Do not equate “qualified profile” with “paying customer.”  
**Cost:** Prefer cheapest capable model; ship at most **one** acquisition action per run

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

NORTH STAR (scoreboard, not a promise): 1000+ qualified Atlanta TRAIN profiles who can match. A qualified profile is NOT automatically a paying customer.

Qualified Atlanta TRAIN profile (all required):
- Unique, non-owner, non-test account
- Completed signup
- Completed required profile fields
- Atlanta metro verified from application data
- TRAIN selected
- Discover-eligible and not blocked, deleted, or suspended

Report these separately (never collapse into one “customers” number):
- Registered users
- Completed profiles
- Qualified Atlanta TRAIN profiles
- Discover-eligible users
- Verified external paying customers
- Successful attributed payments

STRIPE TRUTH: Count only GetTrainMate-attributed live Stripe transactions matched through the approved Product ID, Price ID, Payment Link ID, Checkout metadata allowlist, or legacy credits ownership rules (docs/growth/STRIPE-ATTRIBUTION.md). Report separately: successful attributed live payments; unique verified external paying customers; owner/test payments; unattributed payments; refunds; verified net revenue. Exclude account-wide and unattributed payments from GetTrainMate customers and revenue. Never invent users, matches, messages, reviews, or purchases. Zero is valid evidence.

ONE ACTION PER RUN. Reading metrics, updating docs alone, waiting, or sending Admin email does not count as the action.

CONCURRENCY: Before collecting data or changing files, run:
  node scripts/growth/acquire-growth-lock.mjs
If it exits non-zero (active non-stale lock), STOP. Never delete or bypass an active lock. Stale duration defaults to 3 hours (GROWTH_RUN_LOCK_STALE_MS). Always release at end:
  node scripts/growth/release-growth-lock.mjs
(or --force only after confirming the lock is yours/stale).

EVALUATION DECISIONS (exactly one permitted outcome when an experiment is due):
- KEEP: Record the decision and STOP. Do not change the treatment.
- ITERATE: Make exactly one reversible change to that experiment’s treatment, validate, deploy, verify, record, and STOP.
- STOP: Disable only that experiment’s treatment safely; preserve the underlying reusable page when appropriate; validate, deploy, verify, record, and STOP.
- INCONCLUSIVE: Extend once only when the experiment log’s minimum evidence rule permits it; otherwise STOP the experiment. Do not ship other acquisition work in the same run.

TASK ORDER (do the first applicable item, then stop after that run’s single action):
1) Acquire the growth-run lock. Stop if another valid run is active.
2) Verify critical production health and collect current GA4, CRM, and product-specific Stripe evidence.
3) If EXP-001 evaluation is due today or overdue (America/New_York): evaluate it now.
   - KEEP → record and stop (evaluation IS today’s action).
   - ITERATE → ship one reversible EXP-001 change and stop.
   - STOP → safely disable EXP-001 treatment and stop.
   - INCONCLUSIVE → extend once only if allowed, else stop the experiment; then stop the run.
   Do NOT also ship Step 4/5 work in the same run as an EXP-001 evaluation.
4) Otherwise, only on a later run after EXP-001 has already been evaluated in a previous run, and while EXP-002 remains active: ship one distinctly attributed non-partner acquisition surface (referral invite, empty-state → signup, or event signup).
   Collision rule: before shipping, identify EXP-002’s funnel stage and treatment surface. Do not modify EXP-002 partner landing pages, invite codes, attribution parameters, eligibility, or distribution rules while EXP-002 is in-flight. A referral/empty-state/event surface may ship only when it targets a distinct acquisition entry point, does not modify EXP-002 treatment, has distinct attribution, and does not send traffic through an untracked overlapping treatment.
5) Otherwise: create one complete qualified Atlanta TRAIN partner package (drafts only; never send).
   A partner package counts as the run’s action ONLY if it contains: one verified Atlanta organization; a public source URL; a verified public business contact channel; a tailored unsent draft; a partner-fit explanation; and an attributable proposed URL or UTM plan. Generic research notes do not count. Adding packages while EXP-002 is active may increase sample without changing treatment (acceptable). Sending remains banned.
6) Repair tracking ONLY when production inspection, application records, or a controlled test proves an expected event or attribution field is missing. Do not change tracking merely because metrics are zero — zero is valid unless proven broken.

DEPLOYMENT FAILURE: If tests, build, deployment, or production verification fails: do not describe the action as shipped; repair or safely revert within the same change scope; record the failure; send one failure Admin report; release the lock; STOP without starting another acquisition action.

HARD BANS: fake activity; sending outreach; creating partner accounts; activating founding-member pricing; growth:outreach:send; PARTNER_OUTREACH_SEND_ENABLED; payments/prices/auth/secrets. Preview/validate only. Cursor must not hold PARTNER_EMAIL_INTERNAL_TOKEN.

Focus: Atlanta + TRAIN. Do not spread cities. Do not equal-weight DATE/VIBE.

When shipping code: one reversible change; tests + web:build when code changed; commit/push main only if validation passes; monitor Amplify; verify production; update docs/growth/EXPERIMENT-LOG.md.

ADMIN EMAIL: Send exactly one Admin email after the run reaches its final state. Never send it before deployment verification when code shipped.
  node scripts/growth/compose-and-send-growth-email.mjs --notes "<action; KEEP/ITERATE/STOP/INCONCLUSIVE if any; scoreboard lines above; drafts vs sent; blockers>"
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
