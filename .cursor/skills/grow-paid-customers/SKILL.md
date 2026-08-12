---
name: grow-paid-customers
description: Autonomously analyze and improve GetTrainMate customer acquisition, local marketplace density, activation, matching, retention, conversion, verified revenue, SEO, referrals, and production growth experiments. Use for scheduled or manual growth runs that inspect real funnel data, select one reversible experiment, validate it, deploy it safely, verify production, and record results.
---

# Grow paid customers (GetTrainMate)

Optimize for **qualified local users, marketplace activation, verified Stripe purchases, and revenue** — not vanity traffic or broad national signups.

Product: https://gettrainmate.com/  
Repository: `maxkantor/GetTrainMate` · branch `main`  
Revenue source of truth: **verified Stripe live payments** (Admin CRM as secondary).  
GA4 measurement ID: **`G-C29M8NWNY4`** via `VITE_GA_MEASUREMENT_ID` — **never add a second GA4 install**.

## Primary funnel

Measure conversion between available stages:

`landing_page_view` → `signup_started` → `signup_completed` → `profile_started` → `profile_completed` → `mode_selected` → `location_completed` → `discover_started` → `profile_viewed` → `like_or_connection_sent` → `match_created` → `first_message_sent` → `meaningful_conversation` → `return_visit` → `pricing_viewed` → `checkout_started` → `verified_purchase`

Segment by: metro, mode (TRAIN / VIBE / DATE), acquisition source, new vs returning, profile completion, match/message activity, paid status.

## Optimization goals (ranked)

1. Qualified local registrations  
2. Completed profiles  
3. Mode selection (TRAIN, VIBE, DATE)  
4. Location permission or valid city selection  
5. Discover sessions  
6. Likes or connection requests  
7. Mutual matches  
8. First messages  
9. Meaningful conversations  
10. Event interest or attendance  
11. Returning active users  
12. Pricing views  
13. Checkout starts  
14. Verified Stripe purchases  
15. Paid-user retention  

## Marketplace-density rule

GetTrainMate needs **compatible active users in the same geographic area**. When density is low:

- Focus on **one metro** and one or two high-intent segments.  
- Do **not** spread acquisition equally across Atlanta, Miami, Tampa, New York, Dallas, Chicago, etc. until a local market shows repeatable activation.  
- Measure density: activated users per metro, completed profiles per metro, weekly active discover users, compatible profiles per active user, likes sent, match rate, first-message rate, 7-day return rate.  
- If data does not support a winning city, use **Atlanta, Georgia** as the temporary test market and **mark it as an assumption** in the experiment log and Admin email.

## Weekly workflow

**Cost control:** Prefer the cheapest capable model. On most runs: collect metrics, health-check, update experiment notes if needed, email Admin, and **stop**. Only implement/deploy when there is a clear bottleneck, no same-stage conflict, and the change is tiny. Skip `npm ci` / full production builds unless shipping.

1. Verify production health: `node scripts/growth/check-production-health.mjs`
2. Read experiment history: `docs/growth/EXPERIMENT-LOG.md`
3. Load secrets (optional): `node scripts/growth/load-ssm-secrets-into-env.mjs`
4. Collect funnel evidence (7d + 30d): `node scripts/growth/collect-funnel-snapshot.mjs`
5. Inspect recent `main` commits and uncommitted changes; preserve unrelated work.
6. Read acquisition, activation, retention, marketplace-density, and revenue data from snapshot + Admin CRM when available.
7. Calculate conversion rates between **available** funnel stages only.
8. Identify the largest meaningful bottleneck.
9. **Low-traffic rule:** If volume is too low for CRO, prioritize **qualified local acquisition** (Atlanta fitness communities, gyms/trainers, run clubs, pickleball, rec leagues, local events, referral loops, trackable partnerships, high-intent local SEO) — **not** repeated homepage redesign when the core problem is insufficient local density.
10. Check experiment concurrency (below). Skip conversion experiments that conflict with an `active` experiment on the **same funnel stage**.
11. If no clear, tiny ship candidate: email Admin and end the run.
12. Otherwise select **exactly one** reversible improvement:
    `Priority = (expected customer or marketplace impact × confidence × strategic fit) ÷ implementation effort`
13. Explain why the action outranks alternatives. Prefer changes measurable within 7–30 days.
14. Define the experiment block (required fields), implement, validate, deploy.
15. Append result to `docs/growth/EXPERIMENT-LOG.md` (`node scripts/growth/append-experiment.mjs` or manual edit).
16. **Email Admin every run** (success, blocked, failed, reverted, or no-op):
    ```bash
    node scripts/growth/compose-and-send-growth-email.mjs --notes "<what was reviewed; what shipped or why not; blockers; next eval>"
    ```

## Data sources

Use when available (label missing sources; **never invent data**):

| Source | Use |
|--------|-----|
| GA4 Data API | Funnel events, sessions, channels |
| Stripe restricted read-only API | Verified live payments, revenue |
| Mixpanel | When connected |
| Admin CRM / activity API | Operational funnel, user counts (aggregated) |
| Cognito registration counts | When safely accessible |
| Production health scripts | Uptime, SEO shells |
| Search Console | When connected |
| Recent commits | Deployment context |
| `docs/growth/EXPERIMENT-LOG.md` | Experiment continuity |

Read last **7** and **30** days. Baselines unknown until secrets or APIs respond.

## Allowed experiments

Local landing pages · Atlanta-focused positioning · signup completion · profile completion · onboarding · mode selection clarity · location friction · empty-state recovery · discover activation · match quality · first-message prompts · return-user reminders · events activation · referral invitations · shareable profiles/events · local ambassador/partnership funnels · lifecycle email · pricing clarity · checkout conversion · mobile performance · local-intent SEO · analytics repairs · broken-funnel repairs.

## Experiment concurrency

**Never run two simultaneous conversion experiments on the same funnel stage.**

While one experiment gathers data, you **may** implement independent acquisition, SEO, reliability, tracking, or funnel-repair work that does **not** invalidate the active experiment.

## Experiment definition (required)

| Field | Required |
|-------|----------|
| Experiment ID | Yes |
| Date | Yes |
| Evidence | Yes |
| Target metro and segment | Yes |
| Funnel stage | Yes (concurrency) |
| Customer hypothesis | Yes |
| Exact change | Yes |
| Primary metric | Yes |
| Guardrail metric | Yes |
| Baseline | Yes (or `unknown — missing data source`) |
| Target | Yes |
| Required sample or duration | Yes |
| Evaluation date | Yes |
| Continue/stop rule | Yes |
| Rollback procedure | Yes |
| Commit | When shipped |
| Deployment status | When shipped |
| Production verification | When shipped |
| Verified purchase result | When available |

## Trust, privacy, and safety (hard rules)

- Never create fake users, profiles, matches, messages, reviews, testimonials, or activity.  
- Never automate likes, matches, or messages from user accounts.  
- Never expose exact private locations.  
- Never send email, IP, phone, message text, precise coordinates, or personal profile data to GA4.  
- Never claim unsupported user counts, match rates, safety guarantees, or relationship outcomes.  
- Preserve block, report, moderation, privacy, age, and safety controls.  
- Avoid manipulative dating or fitness claims. Treat **DATE** work as higher-risk than TRAIN or VIBE.  
- Never use sensitive traits for targeting without explicit, lawful consent.  
- Never send bulk unsolicited outreach.

## Hard bans (never auto-change)

Pricing · Stripe configuration · refund behavior · authentication architecture · AWS infrastructure · legal/privacy policies · age requirements · moderation rules · advertising spend · bulk outreach · production secrets.

## Deploy gate

Before push to `main`:

1. `npm ci --ignore-scripts` at repo root (if deps changed)  
2. API tests: `dotnet test apps/api/GetTrainMate.Api.Tests/GetTrainMate.Api.Tests.csproj`  
3. Web tests: `cd apps/web && npm test`  
4. Lint: `npm run web:lint`  
5. Full production web build: `npm run web:build`  
6. Inspect diff — one change set, reversible  
7. Commit + push `main`  
8. Monitor AWS Amplify (auto-deploy on push)  
9. Verify production desktop + mobile: signup, profile, discover, match, chat, pricing, checkout, analytics, safety paths as applicable  
10. On failure: revert immediately, record cause in experiment log  

API Lambda deploy is separate (`npm run deploy:full` or `deploy:push-zip`) — **do not** change API/infra unless the experiment requires it and is explicitly in scope.

## Scripts

| Script | Purpose |
|--------|---------|
| `scripts/growth/collect-funnel-snapshot.mjs` | GA4 + Stripe + sanitized funnel summary |
| `scripts/growth/check-production-health.mjs` | Live site + API health + SEO shells |
| `scripts/growth/append-experiment.mjs` | Append experiment stub to log |
| `scripts/growth/verify-secrets.mjs` | Confirm SSM params exist (no values) |
| `scripts/growth/load-ssm-secrets-into-env.mjs` | Load SSM into process env |
| `scripts/growth/notify-admin-email.mjs` | Low-level SES send |
| `scripts/growth/compose-and-send-growth-email.mjs` | Full Admin email after every run |
| `scripts/growth/print-env-secret-presence.mjs` | Debug secret injection (booleans only) |

## Secrets (never commit)

**Env / Cursor Automation names:**

- `GA4_PROPERTY_ID` — numeric GA4 property ID (not `G-C29M8NWNY4`)  
- `GOOGLE_ANALYTICS_CREDENTIALS_JSON` — service account JSON string  
- `STRIPE_RESTRICTED_READ_KEY` — read-only `rk_live_…` only  
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION` — SES + SSM  
- `ADMIN_EMAIL` or `SES_ADMIN_EMAIL` — optional override  
- `SES_FROM_EMAIL` — optional override  

**AWS SSM (prefix `/gettrainmate/growth/`):**

| Env | SSM path |
|-----|----------|
| `GA4_PROPERTY_ID` | `/gettrainmate/growth/ga4-property-id` |
| `GOOGLE_ANALYTICS_CREDENTIALS_JSON` | `/gettrainmate/growth/google-analytics-credentials-json` |
| `STRIPE_RESTRICTED_READ_KEY` | `/gettrainmate/growth/stripe-restricted-read-key` |
| `AWS_ACCESS_KEY_ID` | `/gettrainmate/growth/aws-access-key-id` (optional; Cursor env preferred for cloud agents) |
| `AWS_SECRET_ACCESS_KEY` | `/gettrainmate/growth/aws-secret-access-key` (optional) |

Admin inbox: `/gettrainmate/ses-admin-email` · SES from: `/gettrainmate/ses-from-email`

Grant the Google service account **Viewer** on GA4 property `G-C29M8NWNY4`. See `docs/growth/SECRETS-SETUP.md`.

## Analytics (preserve existing)

Single GA4 via `apps/web/src/lib/gtag.ts` + `apps/web/src/utils/analytics.ts`. Use GA4 recommended events where appropriate: `sign_up`, `login`, `begin_checkout`, `purchase`. Fire `purchase` only after backend verification; prevent duplicates. Improve event coverage only when necessary for funnel decisions — do not duplicate installs.

**Currently tracked (partial):** `landing_page_view`, `signup_started`, `signup_completed`, `sign_up`, `onboarding_started`, `onboarding_completed`, `match_search_clicked`, `request_sent`, `begin_checkout`, `purchase`, `pricing_viewed`, `return_visit`, `page_view`, and related engagement events.

**Gaps to watch (wire in funnel-repair experiments):** `profile_started`, `profile_completed`, `mode_selected`, `location_completed`, `discover_started`, `profile_viewed`, `like_or_connection_sent`, `match_created`, `first_message_sent`, `meaningful_conversation`, `checkout_started` (alias), metro segmentation params — many helpers exist in `gaFunnelEvents` but are not fully wired in onboarding/discover flows.

## Admin CRM

Use Admin activity feed and metrics as operational signal. Do not confuse GA4 sessions with CRM user records.
