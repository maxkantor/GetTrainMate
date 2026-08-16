# Grow paid customers — Atlanta marketplace launch (GetTrainMate)

Optimize for **qualified Atlanta TRAIN users, marketplace activation, and density** before monetization vanity. Revenue is secondary until local marketplace density is sufficient.

Product: https://gettrainmate.com/  
Repository: `maxkantor/GetTrainMate` · branch `main`  
Revenue source of truth: **verified GetTrainMate-attributed Stripe live payments only** — see `docs/growth/STRIPE-ATTRIBUTION.md`.  
**Verified external paying customers baseline: 0** until product-specific reconciliation completes.  
GA4 measurement ID: **`G-C29M8NWNY4`** via `VITE_GA_MEASUREMENT_ID` — **never add a second GA4 install**.

North star (not a promise): **1000+ qualified Atlanta TRAIN customers** who can match. Optimize density and activation first; report verified attributed Stripe honestly, including 0.

## Thirty-day Atlanta TRAIN targets (not fabricated projections)

| Metric | Target |
|--------|--------|
| Legitimate completed profiles | 50 |
| Users starting Discover | 20 |
| Legitimate connection requests | 10 |
| Mutual matches | 5 |
| First conversations | 3 |

## Focus rule (validation period)

- **Metro:** Atlanta (unless aggregated data proves a stronger metro)
- **Mode:** TRAIN first (preserve VIBE/DATE access; do not equal-weight acquisition)
- **Segments:** run clubs, trainers, pickleball, CrossFit/HYROX, recreational sports
- Do **not** spread acquisition across many cities
- Do **not** auto-change pricing or make paid features free; founding-member offers require **owner approval** before activation

## Execution rule (every run)

Complete **one meaningful marketplace-growth action**. These alone do **not** count:

- Reading metrics · updating docs · waiting · redesigning the general homepage · sending the Admin email

Valid actions include: partner landing templates · invite-code attribution · event signup flows · referral invites · empty-state recovery · founding-member path (draft) · qualified partner outreach prep · metro-density reporting · activation tracking repairs.

Active experiments lock **only** their exact treatment/cohort. They do **not** block independent partner, referral, event, or acquisition infrastructure.

## Primary funnel

`landing_page_view` → `signup_started` → `signup_completed` → `profile_started` → `profile_completed` → `mode_selected` → `location_completed` → `discover_started` → `profile_viewed` → `like_or_connection_sent` → `match_created` → `first_message_sent` → `meaningful_conversation` → `return_visit` → `pricing_viewed` → `checkout_started` → `verified_purchase`

## Weekly workflow

1. Verify production health: `node scripts/growth/check-production-health.mjs`
2. Reconcile GetTrainMate-specific Stripe (allowlist / `gtm_source` — never account-wide)
3. Read experiment log + recent commits; preserve EXP-001 and other active treatments
4. Collect funnel snapshot; read safe CRM metro aggregates when available
5. Calculate aggregated Atlanta TRAIN activation/density (label Unavailable honestly)
6. Identify largest marketplace bottleneck
7. Score: `(expected activated-user impact × confidence × strategic fit) ÷ effort`
8. Select **exactly one** reversible marketplace action
9. Define community, hypothesis, metric, guardrail, target, duration, rollback
10. Implement authorized repo changes
11. Tests, lint, `npm run web:build`; inspect diff
12. Commit + push `main` only if validation passes
13. Monitor Amplify; verify signup → profile → location → Discover → connection → chat → privacy (desktop + mobile as applicable)
14. Revert on verification failure
15. Update `docs/growth/EXPERIMENT-LOG.md`
16. Send Admin report (marketplace-first sections)

## Hard bans

Never: fake users/profiles/matches/messages/reviews/events · automate likes/matches/messages from user accounts · auto pricing/Stripe/auth/infra/legal/age/moderation/ad spend · bulk unsolicited outreach · send outreach without Max approval · expose PII to GA4/logs/email · promise guaranteed matches

## Partner outreach (hard fail-closed)

Automation **must not** send outreach, submit contact forms, post socially, retry, follow up, or mark drafts as approved.

A Cursor prompt, approved experiment, or draft-generation task is **not** send authorization.

Default: `PARTNER_OUTREACH_SEND_ENABLED` is absent/`false` (fail closed).

Real send requires **all** of: per-recipient approval manifest (exact address, subject, template version, timestamp, approval id) + `npm run growth:outreach:send -- --approval-id <id> --send` + `PARTNER_OUTREACH_SEND_ENABLED=true` + not already contacted + daily cap 3. No wildcards. Wednesday automation must never invoke the send path.

Allowed: research, prospect lists, drafts, tracked URLs, rendering validation, previews (`npm run growth:outreach:preview` / `validate`).

Partner campaign sending lives in **Admin CRM → Partner Outreach**, From `partners@gettrainmate.com`. Cursor must not hold `PARTNER_EMAIL_INTERNAL_TOKEN`. Daily EventBridge may invoke API Lambda dispatch; it still cannot send unless `PARTNER_OUTREACH_SEND_ENABLED=true`, postal address is set, and Max has approved each recipient. Unsubscribed, complained, and hard-bounced addresses are suppressed forever. See `docs/growth/PARTNER-OUTREACH-INFRA.md`.

## Scripts

| Script | Purpose |
|--------|---------|
| `scripts/growth/collect-funnel-snapshot.mjs` | GA4 + attributed Stripe + metro CRM |
| `scripts/growth/check-production-health.mjs` | Live site + partner landings |
| `scripts/growth/compose-and-send-growth-email.mjs` | Admin email every run |
| `scripts/growth/append-experiment.mjs` | Experiment log stub |

## Secrets

See `docs/growth/SECRETS-SETUP.md` and `docs/growth/STRIPE-ATTRIBUTION.md`. Never commit credentials.
