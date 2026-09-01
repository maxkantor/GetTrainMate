# GetTrainMate growth strategy lock

**Status:** REVIEWED (lock ended 2026-08-31 ET)  
**Started (America/New_York):** 2026-08-24  
**Review:** 2026-08-31  
**Governing prompt:** FINAL AUTONOMOUS GROWTH SYSTEM (lock window complete)

## End-of-lock decision

**Primary bottleneck:** landings without signup starts (GA4 `signup_started` stayed 0 through the lock; CRM still ~21 completed profiles; 0 verified paid customers).

**One strategic change (2026-08-31):** owned-social Facebook cards and Instagram `/go/:code` links now open **`/signup` with mode + UTMs**, not a second marketing landing. SEO mode pages (`/workout-partner`, `/meet-people`, `/active-dating`) stay live for search. Do **not** invent a new experiment this run.

**What will not get 1,000 paid customers:** weekday organic posts alone. Partner DynamoDB tables exist; send is still fail-closed (no `/gettrainmate/partner/send-enabled` or postal-address SSM). Cursor must not send partner mail or buy ads.

**Owner levers that actually scale:** (1) CAN-SPAM postal address + `PARTNER_OUTREACH_SEND_ENABLED=true` + approve 9 Atlanta drafts in Admin CRM (3/day). (2) Explicit Meta ads budget to `/signup`. (3) Do not redesign homepage.

## Rules after review

- Keep weekday FB/IG rotation (TRAIN / VIBE / DATE × en / es / ru).
- Product/code changes only for confirmed funnel blockers, tracking/signup/checkout bugs, or experiment evals.
- Partner email stays fail-closed until SSM + per-recipient approval. Never invent inboxes.

## Lock day counter

| Date (ET) | Lock day | Distribution | Product change |
|-----------|----------|--------------|----------------|
| 2026-08-24 | 1 / 7 | TRAIN×EN + TRAIN×RU owned social (manual after Cursor rate-limit) | NO |
| 2026-08-25 | 2 / 7 | DATE×ES owned social FB+IG (`owned-*-date-es-20260825`) | Report lead honesty only (not product UX) |
| 2026-08-26 | 3 / 7 | DATE×ES + DATE×EN FB+IG (~10:04–10:05 ET); Admin email recovered manually | NO |
| 2026-08-27 | 4 / 7 | VIBE×EN FB+IG (manual; automation false-Succeeded with PR only) | NO — EXP-002 KEEP |
| 2026-08-28 | 5 / 7 | Partner discovery/CORS work; Max approved EXP-002 outreach (send still disabled) | Partner Outreach UI/API |
| 2026-08-29 | 6 / 7 | Weekday owned social (automation) | NO |
| 2026-08-30 | 7 / 7 | Weekday owned social (automation) | NO |
| 2026-08-31 | REVIEW | TRAIN×EN FB+IG (`…122130159662773778` / IG `18105309032166116`) | Owned-social click → `/signup` |
| 2026-09-01 | post-lock | VIBE×EN FB+IG (`…122130294086773778` / IG `18097084913572026`; `vibe-en-new-in-town`) | NO |

## Exploit / explore (70/30)

- **Exploit signal:** Atlanta DATE pocket (3 completed profiles, 1 match); CRM mode totals TRAIN 8 / VIBE 6 / DATE 7; SF metro density historically strongest completed-profile metro.
- **Explore:** non-TRAIN modes, non-Atlanta markets, non-repeated hooks.
- **Do not** make Atlanta TRAIN the entire daily mix.

## Bottleneck (current)

Landing/traffic exists but **0 GA4 signup starts**. CRM still ~21 completed profiles (TRAIN 8 / VIBE 6 / DATE 7). Bottleneck: **landings without signup starts** — addressed by sending owned-social clicks to `/signup`. Volume to 1,000 payers still requires partner send + paid ads (owner).
