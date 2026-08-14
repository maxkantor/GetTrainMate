# Cursor Automation — GetTrainMate Customer Growth

**Name:** GetTrainMate Wednesday Customer Growth  
**Schedule:** **Wednesday 8:00 AM America/New_York**  
**Cron (UTC during EDT):** `0 12 * * 3` — confirm preview shows **Wednesday at 8:00 AM EDT**  
**Repo:** `maxkantor/GetTrainMate` · branch `main`  
**Notify:** Full Admin email after **every** run → `node scripts/growth/compose-and-send-growth-email.mjs`  
**Cost:** Prefer cheapest capable model; measure + email most weeks; ship only when justified

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
Before taking any action, read and follow:
.cursor/skills/grow-paid-customers/SKILL.md

This is Atlanta marketplace-launch execution, not passive reporting.
Every run must complete one meaningful marketplace-growth action (partner landing, invite codes, referral, empty-state, outreach prep, density reporting, tracking repair). Reading metrics + email alone does not count.

Cost control: Prefer the cheapest capable model. Ship only when the action is reversible and justified. Skip npm ci / full builds unless shipping.

Focus: Atlanta + TRAIN. Do not spread cities or equal-weight DATE/VIBE acquisition. Verified external paying customers baseline = 0 until Stripe product reconciliation completes. Never attribute account-wide Stripe.

Preserve active experiments (e.g. EXP-001). Partner/referral infrastructure may ship in parallel.

Never fake users/activity. Never send outreach, create partner accounts, or activate founding-member pricing. Prepare partner packages under docs/growth/partners/. Do not run growth:outreach:send. Do not set PARTNER_OUTREACH_SEND_ENABLED. Preview/validate only.

When shipping: one reversible change; tests + web:build; commit/push main; monitor Amplify; verify production paths; update EXPERIMENT-LOG.md.

Always end with full Admin email (never partner outreach send):
node scripts/growth/compose-and-send-growth-email.mjs --notes "<marketplace action; drafts vs sent; blockers; EXP-001 eval note>"
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
node scripts/growth/compose-and-send-growth-email.mjs --dry-run
```

See `docs/growth/SECRETS-SETUP.md` for GA4 Viewer and Stripe restricted key setup.