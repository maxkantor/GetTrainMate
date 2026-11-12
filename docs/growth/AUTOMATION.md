# Cursor Automation — GetTrainMate Customer Growth

**Name:** GetTrainMate Customer Growth  
**Schedule:** Daily 10:00 AM America/New_York (live Cursor automation, 7 days/week)  
**Notify:** Exactly **one** Admin email per calendar day (America/New_York), including after owned-social publish or Meta blocker.

**Scheduler model (YouTubeBooster pattern):** Cursor Automation is **primary** at 10:00 ET. Windows Task Scheduler + GitHub Actions are **backups** at ~10:30 ET. Only **one** Cursor Automation may use the 10:00 ET schedule (2026-10-27 triple Cursor agents + `--force-email` sent three Admin emails). Backups are safe together because the S3 Admin-email day guard + local success skip allow only one live email/post per calendar day.  
**North star:** 1,000+ real active users (TRAIN + VIBE + DATE) then 1,000+ verified paying customers. Atlanta TRAIN is one experiment, not the product.

The GitHub backup requires either the repository variable `AWS_GROWTH_ROLE_ARN`
for a role that trusts this repository's GitHub OIDC identity, or repository
secrets `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`. The identity needs the
growth IAM permissions below. An unconfigured or invalid identity fails the
workflow before growth runs.

**STRATEGY LOCK:** Read `docs/growth/STRATEGY-LOCK.md` every run. While `status: LOCKED`, do **not** rewrite overall growth strategy. Rotate acquisition variants only. Product/code changes only under lock-rule exceptions. Valid outcome: `NO PRODUCT CHANGE — collecting data` + daily FB/IG when Meta is valid.

The live Cursor automation fires **daily (including weekends)**. Experiment **evaluation** is due only when the experiment log says so (America/New_York). A daily fire with no evaluation due is still a complete run: collect evidence, do or prepare distribution, and **always send the Admin email**. Never exit successfully without running `compose-and-send-growth-email.mjs`. A 1-minute no-tool success is a failed notification.

---

## Cost controls (Cursor UI)

1. **Model:** Use the cheapest capable model (Composer / Auto — not premium models unless needed).
2. **Schedule:** Daily 10:00 AM Eastern (match the live automation).
3. **Spend limit:** Set a low hard monthly limit at [cursor.com/dashboard/billing](https://cursor.com/dashboard/billing).
4. **Tools:** Prefer **Shell** (required). Do **not** rely on Pull Request as the only tool — PR-only runs are failed growth runs (seen 2026-08-25–27).

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
| `GROWTH_CRM_ADMIN_EMAIL`            | SSM `/gettrainmate/growth/crm-admin-email` (Partner CRM; growth IAM cannot read `/admin/*`)      |
| `GROWTH_CRM_ADMIN_PASSWORD`         | SSM `/gettrainmate/growth/crm-admin-password` (SecureString; do not use `/gettrainmate/admin/password` for cloud) |
| `GROWTH_METRO_READ_TOKEN`           | SSM `/gettrainmate/growth/metro-read-token`                                                      |
| `META_PAGE_ACCESS_TOKEN`            | SSM `/gettrainmate/growth/meta-page-access-token`                                                |
| `FACEBOOK_PAGE_ID`                  | SSM `/gettrainmate/growth/facebook-page-id`                                                      |
| `INSTAGRAM_BUSINESS_ACCOUNT_ID`     | SSM `/gettrainmate/growth/instagram-business-account-id`                                         |

IAM user `cursor-gettrainmate-growth` needs `ses:SendEmail`, `ssm:GetParameter` on `/gettrainmate/growth/*` + SES email params, S3 social image write, **and** `bedrock:InvokeModel` on Stability image models (owned-social daily creatives). Without Bedrock, Meta auth can be VALID while publishing fails at `MEDIA_GENERATION_DENIED` (seen 2026-10-27). It cannot read `/gettrainmate/admin/*` — Partner CRM must use `/gettrainmate/growth/crm-admin-*`. Cloud runs must `npm --prefix scripts/growth install` (or rely on `ensureGrowthDeps`) so GA4 (`google-auth-library`) and Meta images (`sharp`) are available.

Copy from SSM when needed:

```powershell
aws ssm get-parameter --name /gettrainmate/growth/ga4-property-id --region us-east-1 --query Parameter.Value --output text | Set-Clipboard
aws ssm get-parameter --name /gettrainmate/growth/google-analytics-credentials-json --with-decryption --region us-east-1 --query Parameter.Value --output text | Set-Clipboard
aws ssm get-parameter --name /gettrainmate/growth/stripe-restricted-read-key --with-decryption --region us-east-1 --query Parameter.Value --output text | Set-Clipboard
```

---

## Prompt (paste into Automations → Agent instructions)

Replace the entire Agent instructions field with this:

```
You are the GetTrainMate daily growth runner. Repo: GetTrainMate on branch main.

STRATEGY LOCK: Read docs/growth/STRATEGY-LOCK.md. Do NOT rewrite growth strategy. Do NOT invent daily product commits. Product/code changes ONLY for confirmed production/tracking/signup/checkout bugs or predetermined experiment evals.

=== HARD SUCCESS CRITERIA (all required) ===
A run is SUCCESS only if stdout/JSON from the growth runner shows:
  - emailSent: true (SES messageId present), AND
  - published: true OR an explicit Meta/SSM blocker was emailed
Creating a Pull Request, editing docs only, or dashboard "Succeeded" with Tools=Pull Request only is FAILURE.
FORBIDDEN as the only action: opening/creating a PR, "summarizing metrics", or exiting after git commit without Meta + Admin email.

=== PRIMARY COMMAND (run this first; do not skip) ===
node scripts/growth/run-weekday-growth.mjs

This single script: acquires lock → publishes Facebook+Instagram → collects snapshot → sends Admin SES email → releases lock. Runs daily including weekends.
If it exits 0 with emailSent true, you are DONE. Update docs/growth/STRATEGY-LOCK.md lock-day row + acquisition-history.json, commit/push those docs only if needed, then stop.

If run-weekday-growth.mjs fails:
1) Read its JSON errors.
2) Fix secrets/env only if Meta/SSM/SES is the blocker (do not redesign product).
3) Retry ONCE: node scripts/growth/run-weekday-growth.mjs
4) If still failing: node scripts/growth/compose-and-send-growth-email.mjs --skip-social --notes "{\"todaysAcquisitionAction\":\"growth runner failed\",\"requiredOwnerApproval\":\"investigate automation\"}"
   (Same-day SES guard skips a duplicate Admin email if one already sent. Never use --force-email on retries — it used to bypass the guard. Intentional second send only: --force-email-resend.)
5) release-growth-lock.mjs
Then stop. Do NOT open a PR as a substitute for distribution.

Optional content override when STRATEGY-LOCK tomorrowBias names a mode:
  node scripts/growth/run-weekday-growth.mjs --content-id <catalog-id>
Catalog ids live in scripts/growth/lib/owned-social-catalog.mjs (e.g. vibe-es-planes-ciudad, train-en-workout-partner).

Also follow .cursor/skills/grow-paid-customers/SKILL.md for bans (no partner send, no fake users, Stripe truth). Partner email remains fail-closed until Max approves a verified public recipient.

TIMEZONE: America/New_York for daily schedule + experiment eval dates.
```

---

## Local Windows Scheduled Task (BACKUP — mirrors YouTubeBooster)

When Cursor usage limits are reached or the cloud agent fails, this PC still runs growth via Task Scheduler (same design as `YouTubeBooster Daily Growth`).

### Task Details
- **Task Name:** `GetTrainMate-GrowthDaily`
- **Role:** BACKUP — primary remains Cursor at **10:00 AM** ET; this task runs at **10:30 AM** ET daily.
- **Script:** `scripts/growth/run-growth-scheduled.ps1` (PATH-hardened for Task Scheduler: Node + AWS CLI + Git)
- **Features:**
  - Interactive logon principal (reliable PATH / local AWS creds) + `MultipleInstances IgnoreNew`
  - `StartWhenAvailable` / `WakeToRun` if the PC was asleep at 10:30
  - Pulls `origin/main` before running
  - Keeps `docs/growth` artifacts **local** by default (no Amplify redeploy). Opt in with `-PushArtifacts`
  - Dedupes: local success log + S3 Admin-email day guard (skips if Cursor/GitHub already finished)
  - Logs: `docs/growth/daily-task-runner.log` and `docs/growth/logs/YYYY-MM-DD-scheduled.log`

### Management Commands
```powershell
# Register / refresh BACKUP task (default 10:30 ET):
.\scripts\growth\setup-windows-task.ps1 -Action Register

# Status / next run / last result:
.\scripts\growth\setup-windows-task.ps1 -Action Status
.\scripts\growth\check-windows-task.ps1

# Run the backup immediately (e.g. Cursor monthly limit hit):
.\scripts\growth\setup-windows-task.ps1 -Action RunNow

# Remove legacy HybridRaceWorkouts / Cooking growth tasks:
.\scripts\growth\remove-legacy-windows-growth-tasks.ps1

# Unregister backup task:
.\scripts\growth\setup-windows-task.ps1 -Action Unregister
```

---

## Cloud Backup via GitHub Actions

Workflow: `.github/workflows/daily-growth.yml` — scheduled **14:30 UTC and 15:30 UTC** daily (~10:30 ET year-round). Manual `workflow_dispatch` always available.

Required repo secrets (`Settings → Secrets and variables → Actions`):
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

S3 day guard skips the run when Cursor or Windows already sent today's Admin email.


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

Confirm Environment secrets still include AWS keys + growth SSM-backed values (or IAM that can read SSM). Without AWS/SES/Meta, the runner emails a blocker — it must not silently "Succeed" via PR.

---

## First-time local verify

```bash
npm i --prefix scripts/growth
node scripts/growth/verify-secrets.mjs
node scripts/growth/check-production-health.mjs
node scripts/growth/acquire-growth-lock.mjs
node scripts/growth/release-growth-lock.mjs
node scripts/growth/run-weekday-growth.mjs --dry-run
node scripts/growth/compose-and-send-growth-email.mjs --dry-run
```

See `docs/growth/SECRETS-SETUP.md` for GA4 Viewer and Stripe restricted key setup.
