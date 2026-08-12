# Cursor Automation — GetTrainMate Wednesday Customer Growth

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

| Secret name | Source |
|-------------|--------|
| `GA4_PROPERTY_ID` | SSM `/gettrainmate/growth/ga4-property-id` |
| `GOOGLE_ANALYTICS_CREDENTIALS_JSON` | SSM `/gettrainmate/growth/google-analytics-credentials-json` |
| `STRIPE_RESTRICTED_READ_KEY` | SSM `/gettrainmate/growth/stripe-restricted-read-key` (`rk_…` only) |
| `AWS_ACCESS_KEY_ID` | IAM (cloud agent) |
| `AWS_SECRET_ACCESS_KEY` | IAM |
| `AWS_REGION` | `us-east-1` |
| `ADMIN_EMAIL` or `SES_ADMIN_EMAIL` | Optional (else SSM `/gettrainmate/ses-admin-email`) |
| `SES_FROM_EMAIL` | Optional (else SSM `/gettrainmate/ses-from-email`) |

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

Cost control: Prefer the cheapest capable model. On most runs: collect metrics, health-check, update experiment log notes if needed, email Admin, and stop. Only implement/deploy when there is a clear local-marketplace or conversion bottleneck, no same-stage conflict, and the change is tiny. Skip npm ci / full builds unless shipping.

Review GA4, Stripe, Admin CRM activity (when available), experiment history (docs/growth/EXPERIMENT-LOG.md), production health, marketplace density by metro, and recent main commits.

Marketplace-density rule: optimize for one metro until activation is repeatable. If no city clearly leads, focus on Atlanta, Georgia and record that assumption. Do not spread acquisition equally across many cities when local density is the bottleneck.

Never run two simultaneous conversion experiments on the same funnel stage. While an experiment is gathering data, you may implement independent acquisition, SEO, reliability, tracking, or funnel-repair improvements that do not invalidate the active experiment.

If traffic is too low to evaluate conversion, prioritize qualified local acquisition (Atlanta fitness communities, gyms/trainers, run clubs, pickleball, rec leagues, local events, referral loops, trackable partnerships, high-intent local SEO) before additional homepage redesign.

Trust and safety: never fake users, profiles, matches, messages, or testimonials. Never automate social actions from user accounts. Never send PII to GA4. Treat DATE-related changes as higher-risk than TRAIN or VIBE.

When shipping: select one small reversible change. Run tests, lint, and npm run web:build. Commit to main only when validation passes, push, monitor Amplify, verify production (signup, profile, discover, match, chat, pricing, checkout, analytics, safety). Revert on failure. Record docs/growth/EXPERIMENT-LOG.md.

ALWAYS end the run by sending a FULL Admin email via:
node scripts/growth/compose-and-send-growth-email.mjs --notes "<what was reviewed; what shipped or why not; blockers; target metro; next eval date>"
Do this even on skipped or no-op weeks. A run without Admin email is incomplete.

Load secrets from Automation env / SSM via scripts/growth/load-ssm-secrets-into-env.mjs (GA4_PROPERTY_ID, GOOGLE_ANALYTICS_CREDENTIALS_JSON, STRIPE_RESTRICTED_READ_KEY). Never commit credentials. Stripe key must remain read-only (rk_…). AWS credentials required for SSM + Admin email.
```

---

## Cloud Agent Environment (Install script)

Paste into Cursor → Environment → **Install script**:

```bash
npm i --prefix scripts/growth
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
