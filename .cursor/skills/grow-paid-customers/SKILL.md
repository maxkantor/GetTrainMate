# Grow paid customers — Atlanta marketplace launch (GetTrainMate)

Optimize for **qualified Atlanta TRAIN profiles** (Discover-eligible density) before monetization vanity. Revenue is secondary until local marketplace density is sufficient. A qualified profile is **not** automatically a paying customer.

Product: https://gettrainmate.com/  
Repository: `maxkantor/GetTrainMate` · branch `main`  
Revenue source of truth: **verified GetTrainMate-attributed Stripe live payments only** — see `docs/growth/STRIPE-ATTRIBUTION.md`.  
**Verified external paying customers baseline: 0** until product-specific reconciliation completes.  
GA4 measurement ID: **`G-C29M8NWNY4`** via `VITE_GA_MEASUREMENT_ID` — **never add a second GA4 install**.

North star (scoreboard, not a promise): **1000+ qualified Atlanta TRAIN profiles** who can match. Report verified attributed Stripe honestly, including 0.

Automation paste prompt + lock rules: `docs/growth/AUTOMATION.md`.

## Qualified Atlanta TRAIN profile (executable)

All of the following:

- Unique, non-owner, non-test account
- Completed signup
- Completed required profile fields
- Atlanta metro location verified from application data
- TRAIN selected
- Discover-eligible and not blocked, deleted, or suspended

Report separately (never collapse):

| Line | Meaning |
|------|---------|
| Registered users | Accounts created |
| Completed profiles | Required profile fields done |
| Qualified Atlanta TRAIN profiles | Meets definition above |
| Discover-eligible users | Can appear in Discover |
| Verified external paying customers | Deduped attributed live payers minus excludes |
| Successful attributed payments | Attributed live succeeded payments |

## Stripe truth

Count only GetTrainMate-attributed live Stripe transactions matched through approved Product ID, Price ID, Payment Link ID, Checkout metadata allowlist, or legacy credits ownership (`docs/growth/STRIPE-ATTRIBUTION.md`).

Report separately: successful attributed live payments · unique verified external paying customers · owner/test payments · unattributed payments · refunds · verified net revenue.

Exclude account-wide and unattributed payments from GetTrainMate customers and revenue.

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

## Growth-run lock (required)

Before collecting data or changing files:

```bash
node scripts/growth/acquire-growth-lock.mjs
```

If a **non-stale** lock exists, **stop**. Never delete or bypass an active lock. Default stale window: **3 hours** (`GROWTH_RUN_LOCK_STALE_MS`).

At end of every run (success or failure):

```bash
node scripts/growth/release-growth-lock.mjs
```

## Timezone for evaluations

Determine whether an evaluation is due using **America/New_York** (full programmed weekday and calendar date). Do **not** compare dates using UTC alone.

## Execution rule (every run)

Complete **at most one** meaningful marketplace-growth action. These alone do **not** count:

- Reading metrics · updating docs · waiting · redesigning the general homepage · sending the Admin email · generic research notes

### Evaluation decisions (when an experiment is due)

| Decision | Allowed work this run |
|----------|------------------------|
| **KEEP** | Record and stop. Do not change the treatment. |
| **ITERATE** | Exactly **one** reversible change to that experiment’s treatment; validate; deploy; verify; stop. |
| **STOP** | Safely disable only that experiment’s treatment; preserve reusable underlying page when appropriate; validate; deploy; verify; stop. |
| **INCONCLUSIVE** | Extend **once** only if the experiment log’s minimum evidence rule permits; otherwise stop the experiment. No other acquisition ship in the same run. |

If you evaluate EXP-001 in this run, that evaluation (plus at most one ITERATE/STOP code change) **is** today’s action. Do **not** also ship Step-4/5 work in the same run. Step “ship a different acquisition surface while EXP-002 is in-flight” applies only on a **later** run after EXP-001 was already evaluated.

### Partner package (counts only if complete)

A partner package under `docs/growth/partners/` counts as the run’s action **only** if it contains:

1. One verified Atlanta organization  
2. A public source URL  
3. A verified public business contact channel  
4. A tailored **unsent** draft  
5. A partner-fit explanation  
6. An attributable proposed URL or UTM plan  

Generic research notes do not count. Draft only — never send. While EXP-002 is active, packages may add sample without changing treatment; sending remains banned.

### Experiment-stage collision

Before shipping, identify the active experiment’s funnel stage and treatment surface.

While **EXP-002** is in-flight: do **not** modify EXP-002 partner landing pages, invite codes, attribution parameters, eligibility, or distribution rules.

A referral, empty-state, or event surface may ship only when it:

- Targets a distinct acquisition entry point  
- Does not modify EXP-002 treatment  
- Has distinct attribution  
- Does not send traffic through an untracked overlapping treatment  

### Tracking repairs

Do **not** change tracking merely because metrics are zero. Treat zero as valid unless production inspection, application records, or a controlled test proves an expected event or attribution field is missing.

### Deployment failure

If tests, build, deployment, or production verification fails:

- Do not describe the action as shipped  
- Repair or safely revert within the same change scope  
- Record the failure  
- Send one failure Admin report  
- Release the lock  
- Stop without starting another acquisition action  

### Admin email

Send **exactly one** Admin email after the run reaches its **final** state. Never send it before deployment verification when code shipped. If email fails, record locally and report once — do not repeat the acquisition action or send duplicates blindly.

## Primary funnel

`landing_page_view` → `signup_started` → `signup_completed` → `profile_started` → `profile_completed` → `mode_selected` → `location_completed` → `discover_started` → `profile_viewed` → `like_or_connection_sent` → `match_created` → `first_message_sent` → `meaningful_conversation` → `return_visit` → `pricing_viewed` → `checkout_started` → `verified_purchase`

## Recommended task order

1. Acquire growth-run lock (stop if held)  
2. Verify production health; collect GA4, CRM, product-specific Stripe  
3. If EXP-001 due (America/New_York): evaluate → KEEP / ITERATE / STOP / INCONCLUSIVE → stop run  
4. Else if EXP-001 already evaluated in a **previous** run and EXP-002 still active: one distinctly attributed non-partner acquisition surface  
5. Else: one complete qualified Atlanta TRAIN partner package (draft only)  
6. Else: repair tracking only if proven broken  
7. Validate / build when code changed / commit / push / monitor Amplify / verify / update `docs/growth/EXPERIMENT-LOG.md` / one Admin email / release lock  

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
| `scripts/growth/acquire-growth-lock.mjs` | Exclusive growth-run lock |
| `scripts/growth/release-growth-lock.mjs` | Release lock |
| `scripts/growth/collect-funnel-snapshot.mjs` | GA4 + attributed Stripe + metro CRM |
| `scripts/growth/check-production-health.mjs` | Live site + partner landings |
| `scripts/growth/compose-and-send-growth-email.mjs` | Admin email once per final state |
| `scripts/growth/append-experiment.mjs` | Experiment log stub |

## Secrets

See `docs/growth/SECRETS-SETUP.md` and `docs/growth/STRIPE-ATTRIBUTION.md`. Never commit credentials.
