# Grow paid customers — international marketplace (GetTrainMate)

**North star:** 1,000+ **real active users** (completed profiles using TRAIN, VIBE, and/or DATE, with Discover activity) across viable international markets — then 1,000+ **verified external paying customers**.  
**Operating objective:** **global product + focused local density**. Rank country · metro · language · mode pockets from evidence. Do not treat Atlanta TRAIN as the product.  
**Immediate milestone:** daily owned-social distribution on Facebook + Instagram when Meta credentials are valid, plus marketplace liquidity in the strongest pockets.

GetTrainMate is a multilingual, international social discovery platform:

- **TRAIN** — workouts, sports, running, gym, fitness, races  
- **VIBE** — socialize, events, explore, hang out, shared interests  
- **DATE** — dating and romantic connections (never guaranteed)

Atlanta TRAIN may remain **one** geographic acquisition experiment because landing infrastructure exists. It must **not** redefine positioning, reporting, or daily social content.

Product: https://gettrainmate.com/  
Repository: `maxkantor/GetTrainMate` · branch `main`  
Revenue source of truth: **verified GetTrainMate-attributed Stripe live payments only** — see `docs/growth/STRIPE-ATTRIBUTION.md`.  
**Verified external paying customers baseline: 0** until product-specific reconciliation completes.  
GA4 measurement ID: **`G-C29M8NWNY4`** via `VITE_GA_MEASUREMENT_ID` — **never add a second GA4 install**.

Automation paste prompt + lock rules: `docs/growth/AUTOMATION.md`.

## Customer acquisition override (until the first newly attributed external customer)

Accurate reporting is required and is **not** the primary output. Analytics review, report formatting, documentation, internal pages, experiment logs, health checks, draft packages, and unexposed production changes **do not count**.

A production asset is **not** distributed merely because it is deployed.

Every successful run must complete:

1. One measurable acquisition improvement, **when necessary**; and
2. One real, policy-compliant **distribution** action that places the product in front of a relevant external audience.

Distribution must use one of:

- An explicitly approved recipient and exact approved message
- An owned social account with **explicit posting authorization**
- An approved email list with valid consent and unsubscribe controls
- A legitimate partner or community channel that permits promotion
- Paid advertising within an explicitly approved budget
- A product-triggered referral/share action initiated by a real user (organic collection only — **waiting for a user to share is not an acquisition action**)

Never send spam, invent contacts, automate comments or DMs, evade community rules, or claim visits, customers, or revenue without verified attribution.

Until the first newly attributed external customer:

- Run no more than one experiment per funnel stage.
- Prefer qualified distribution over additional CRO.
- Do not launch another experiment merely because the current run requires a ship.
- Measure visits → activation → checkout → verified payment.
- Report **new customers acquired by this run** separately from customers merely observed during its date window.

A run is successful **only** when it either:

- Executes an approved external distribution action; or
- Removes a proven blocker preventing qualified traffic from entering or completing the funnel.

**KEEP-only evaluation is not a successful acquisition run.** Record KEEP (do not change that treatment) and still complete distribution — or prepare the exact action and make the Admin report **lead** with a blocking approval request. A partner package / unsent draft is **not** distribution.

If distribution requires Max’s approval and none exists **and** owned-social Meta API is unavailable: prepare the **exact** action and stop. Do not substitute another analytics or formatting task.

When Meta Page token + Facebook Page id + Instagram business account id are configured in SSM, **publish** to https://www.facebook.com/gettrainmate and https://www.instagram.com/gettrainmate/ without per-post Max approval. `node scripts/growth/run-weekday-growth.mjs` (or `publish-owned-social.mjs`) is the daily distribution path. A caption sitting in a doc is **not** distribution.

The Admin report must **start** with GetTrainMate global growth (profiles, Discover, requests, matches, first messages, returning users, customers, revenue), then growth by mode (TRAIN / VIBE / DATE), then top markets, then acquisition executed today, then owned social YES/NO + post ids. Atlanta TRAIN profiles are **not** the global KPI.

Distinguish: existing customers · customers observed during the experiment window · customers causally attributed to a specific experiment · **new customers acquired by the current run**.


## Qualified GetTrainMate profile (executable)

All of the following:

- Unique, non-owner, non-test account
- Completed signup
- Completed required profile fields
- **Valid supported location** (city/metro from application data — not Atlanta-only)
- **At least one mode selected** (TRAIN, VIBE, or DATE)
- Discover-eligible and not blocked, deleted, or suspended

Report separately by **country · metro · language · mode** (never collapse into one global density number):

| Line | Meaning |
|------|---------|
| Registered users | Accounts created |
| Completed profiles | Required profile fields done |
| Qualified profiles (by market + mode) | Meets definition above |
| Discover-eligible users | Can appear in Discover |
| Connections / matches / first messages | By market when CRM/GA4 allow |
| Verified external paying customers | Deduped attributed live payers minus excludes |
| Successful attributed payments | Attributed live succeeded payments |

## Market campaigns (three acquisition engines)

- Atlanta is the **first active** launch market, not the product boundary.
- Initial candidates: Atlanta (EN), Miami/Fort Lauderdale (EN/ES), NYC (EN/ES/RU), London (EN), Toronto (EN).
- **At most 3 active markets** at once. Suggested effort split: **50% / 30% / 20%** across ranked active markets — recalculate from verified evidence only.
- Partner outreach uses three engines when verified public contacts exist: **TRAIN** (gyms, clubs, fitness orgs), **VIBE** (events and communities), **DATE** (appropriate lifestyle/singles events). Never guarantee matches or dates. Rank pockets from evidence instead of equal-weighting every city.
- Routes: `/partners/<country>/<market>/<invite-code>` (legacy `/partners/atlanta/:code` aliases preserved).
- Attribution: `utm_campaign=<country>_<market>_train_partners` (e.g. `us_atlanta_train_partners`).
- **Never infer emails.** Automated pipeline: organization discovery → official website resolution → public business-contact verification → CRM prospect creation → deduplication → scoring → invite-code generation → landing-URL generation → personalized draft → approval queue. If no verified public email is found automatically, mark **No verified public email** and exclude from sending. Manual Add Prospect is optional override only — Max must not paste emails as the primary workflow.
- Approved human-reviewed outreach templates: **English, Spanish, Russian**. If no approved template exists for the organization’s language, mark **Qualified prospect — language template unavailable** — never send raw machine translation.

## Stripe truth

Count only GetTrainMate-attributed live Stripe transactions matched through approved Product ID, Price ID, Payment Link ID, Checkout metadata allowlist, or legacy credits ownership (`docs/growth/STRIPE-ATTRIBUTION.md`).

Report separately: successful attributed live payments · unique verified external paying customers · owner/test payments · unattributed payments · refunds · verified net revenue.

Exclude account-wide and unattributed payments from GetTrainMate customers and revenue.

## Thirty-day density targets (per active market — not fabricated projections)

| Metric | Target (each active market) |
|--------|----------------------------|
| Legitimate completed profiles | 50 |
| Users starting Discover | 20 |
| Legitimate connection requests | 10 |
| Mutual matches | 5 |
| First conversations | 3 |

## Focus rule (validation period)

- **Markets:** up to **3 active** campaigns ranked by verified CRM/GA4 evidence; Atlanta remains first active unless data ranks another market higher
- **Partner campaign modes:** TRAIN clubs, VIBE communities/events, DATE appropriate communities — only with verified public contacts; concentrate on ranked pockets
- **Segments:** gyms, run clubs, trainers, pickleball, CrossFit/HYROX, cycling, hiking, rec sports, fitness events
- Do **not** scatter outreach across many cities simultaneously
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

Complete **at most one** meaningful marketplace-growth action **and**, until the first newly attributed external customer, one policy-compliant distribution (or a prepared exact approval request). These alone do **not** count:

- Reading metrics · updating docs · waiting · redesigning the general homepage · sending the Admin email · generic research notes · deploying an unshared asset · an unsent partner package

### Evaluation decisions (when an experiment is due)

| Decision | Allowed work this run |
|----------|------------------------|
| **KEEP** | Record the decision. Do **not** change the treatment. KEEP is **not** the run’s success condition — still execute approved distribution or prepare the exact blocking approval request. |
| **ITERATE** | Exactly **one** reversible change to that experiment’s treatment; validate; deploy; verify. Do not launch a different experiment in the same run. Still prefer distribution over extra CRO. |
| **STOP** | Safely disable only that experiment’s treatment; preserve reusable underlying page when appropriate; validate; deploy; verify. |
| **INCONCLUSIVE** | Extend **once** only if the experiment log’s minimum evidence rule permits; otherwise stop the experiment. No other **experiment** ship in the same run. Distribution / approval-prep is still required. |

Do **not** also ship a new acquisition surface merely so the run has a code change. Prefer qualified distribution.

Weekday owned-social is the default distribution: `node scripts/growth/publish-owned-social.mjs` rotates TRAIN / VIBE / DATE and en / es / ru. Per-post Max approval is **not** required when the Meta Page token is valid.

### Automated partner discovery (primary partner workflow)

Scheduled weekly (`partner-outreach-discovery` EventBridge) and on-demand via `POST /api/admin/partner-outreach/discover/automated` or `node scripts/growth/run-market-discovery.mjs`.

For each active/ranked market (≤3): discover gyms, trainers, run clubs, pickleball/racket clubs, CrossFit/HYROX, cycling clubs, rec sports orgs, fitness event organizers via OSM Overpass + seed catalog. Populate CRM with organization, country, market, language, TRAIN activity, website, verified public business email (or `no_verified_public_email`), source URL, verification timestamp, fit score, invite code, landing URL, subject, draft, campaign, status.

Instagram + Facebook: publish via Meta Graph when SSM credentials exist (`node scripts/growth/publish-owned-social.mjs`). If the connector is unavailable, report the exact SSM/permission blocker. Do not count a draft as distribution. Do not substitute manual prospect entry.

### Partner package (not distribution)

A partner package under `docs/growth/partners/` may be the measurable improvement **only** when it is the exact approval-ready action (verified public contact channel + exact unsent message). It still **does not** count as distribution until Max approves and the message is actually placed in front of the audience.

A complete package contains:

1. One verified organization in the **target market**
2. A public source URL  
3. A verified public business contact channel (**never invent an inbox**)  
4. A tailored **unsent** draft  
5. A partner-fit explanation  
6. An attributable proposed URL or UTM plan  

Generic research notes do not count. Draft only — never send. Cursor must not invoke the send path.

### Experiment-stage collision

Before shipping, identify the active experiment’s funnel stage and treatment surface.

While **EXP-002** is in-flight: do **not** modify EXP-002 Atlanta partner landing pages, invite codes, attribution parameters, eligibility, or distribution rules. International canonical paths (`/partners/us/atlanta/...`) are aliases — legacy `/partners/atlanta/...` must keep working.

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

Send **exactly one** Admin email after **every** scheduled fire reaches its **final** state, including skip / no-evaluation / lock-stop days. Never mark the run succeeded without running `node scripts/growth/compose-and-send-growth-email.mjs` (or the wrapper `node scripts/growth/run-weekday-growth.mjs`). A 1-minute no-tool success is a failed notification. A Cursor dashboard **Succeeded** with only **Pull Request** is a **failed** growth run. Never send the Admin email before deployment verification when code shipped. If email fails, record locally and report once — do not repeat the acquisition action or send duplicates blindly.

## Primary funnel

`landing_page_view` → `signup_started` → `signup_completed` → `profile_started` → `profile_completed` → `mode_selected` → `location_completed` → `discover_started` → `profile_viewed` → `like_or_connection_sent` → `match_created` → `first_message_sent` → `meaningful_conversation` → `return_visit` → `pricing_viewed` → `checkout_started` → `verified_purchase`

## Recommended task order

1. Acquire growth-run lock (stop if held)  
2. Verify production health; collect GA4, CRM, product-specific Stripe (**report only**)  
3. If an experiment evaluation is due (America/New_York): KEEP / ITERATE / STOP / INCONCLUSIVE. KEEP does **not** end the run. Do not launch a new experiment to manufacture a ship.  
4. Execute owned-social publish (`publish-owned-social.mjs`) when Meta credentials are present. Partner email only via Admin CRM after flags — Cursor still must not send partner mail.  
5. If Meta is missing: report the exact credential blocker in the Admin email. Still send the Admin email. Do not substitute CRO or a new experiment. 
6. Repair tracking only if proven broken  
7. Validate / build when code changed / commit / push / monitor Amplify / verify / update `docs/growth/EXPERIMENT-LOG.md` / one Admin email / release lock  

## Hard bans

Never: fake users/profiles/matches/messages/reviews/events · automate likes/matches/messages from user accounts · auto pricing/Stripe/auth/infra/legal/age/moderation/ad spend · bulk unsolicited outreach · send outreach without Max approval · expose PII to GA4/logs/email · promise guaranteed matches

## Partner outreach (hard fail-closed)

Automation **must not** send partner email, submit contact forms, automate DMs/comments, retry, follow up, or mark drafts as approved.

Owned Facebook/Instagram posts through the Meta Graph API **are** allowed when SSM credentials are valid. That is distribution, not partner spam.

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
| `scripts/growth/run-weekday-growth.mjs` | **Preferred Cursor Automation entrypoint** — lock + publish FB/IG + Admin email + release |
| `scripts/growth/compose-and-send-growth-email.mjs` | Admin email once per final state |
| `scripts/growth/publish-owned-social.mjs` | Facebook + Instagram weekday publish |

## Secrets

See `docs/growth/SECRETS-SETUP.md` and `docs/growth/STRIPE-ATTRIBUTION.md`. Never commit credentials.
