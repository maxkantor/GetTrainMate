# Cursor Automation — GetTrainMate Customer Growth

**Name:** GetTrainMate Wednesday Customer Growth  
**Schedule:** **Wednesday 8:00 AM America/New_York**  
**Cron (UTC during EDT):** `0 12 * * 3` — confirm preview shows **Wednesday at 8:00 AM EDT**  
**Repo:** `maxkantor/GetTrainMate` · branch `main`  
**Notify:** Full Admin email after **every** run → `node scripts/growth/compose-and-send-growth-email.mjs`  
**North star:** 1000+ real Atlanta TRAIN customers (scoreboard, not a promise)  
**Cost:** Prefer cheapest capable model; ship one acquisition action per run when justified

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
Read and follow .cursor/skills/grow-paid-customers/SKILL.md.

North star: 1000+ real GetTrainMate customers (qualified Atlanta TRAIN profiles who can match). That is a scoreboard, not a promise. Never invent users, matches, messages, reviews, or purchases. Report this week’s verified attributed Stripe and CRM activation honestly, including 0.

This is Atlanta marketplace-launch execution. Every run must complete one meaningful customer-acquisition action. Reading metrics, updating docs, or sending Admin email alone does not count.

Today’s task order (do the first unfinished item, then stop after one ship):
1) Evaluate EXP-001 if its eval date is today or has passed. Keep, iterate, or stop using the experiment log rules. Record the result. If you evaluated, that is today’s action unless a keep/iterate decision requires one code change.
2) If EXP-001 is evaluated and EXP-002 is still in-flight, ship a different acquisition surface (referral invite, empty-state → signup, or event signup). Do not add another partner landing/code until EXP-002 is kept, iterated, or stopped.
3) If partner packages are thin, add one qualified gym/run-club/trainer package under docs/growth/partners/ (drafts only).
4) Repair tracking only if signup, profile, or partner attribution is broken.

Focus: Atlanta + TRAIN. Do not spread cities. Do not equal-weight DATE/VIBE. Never attribute account-wide Stripe to GetTrainMate.

Preserve active experiments. Independent partner/referral work may ship in parallel with a locked conversion treatment.

Hard bans: fake activity; sending outreach; creating partner accounts; activating founding-member pricing; growth:outreach:send; PARTNER_OUTREACH_SEND_ENABLED; payments/prices/auth/secrets. Preview/validate only.

Cost: cheapest capable model. Skip npm ci / full builds unless shipping.

When shipping: one reversible change; tests + web:build; commit/push main; monitor Amplify; verify production; update docs/growth/EXPERIMENT-LOG.md.

Always end with full Admin email:
node scripts/growth/compose-and-send-growth-email.mjs --notes "<action shipped; customers/profiles this week vs 1000 north star; drafts vs sent; EXP eval; blockers>"
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