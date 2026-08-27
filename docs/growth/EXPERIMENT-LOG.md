# GetTrainMate — customer growth experiment log

Agents must append every experiment here. Do not delete history.

## Active

- **EXP-001** — Atlanta training partners landing (`/atlanta-training-partners`) — eval **2026-08-16** — **KEEP 2026-08-17** (treatment unchanged) — funnel stage: acquisition / SEO
- **EXP-002** — Atlanta TRAIN partner invite landings + codes (`/partners/atlanta/:code`) — eval **2026-08-27** — **KEEP 2026-08-27** (treatment unchanged; partner routes healthy; 0 partner-attributed signups — outreach fail-closed) — funnel stage: partner acquisition infrastructure (independent of EXP-001 treatment)
- **EXP-003** — User-initiated referral invite (`/invite/:ref`) — **ITERATE 2026-08-21** (TRAIN+VIBE+DATE invite CTA) — eval **2026-08-31** — funnel stage: acquisition / referral
- **EXP-004** — San Francisco density landing (`/san-francisco`) — started **2026-08-21** — funnel stage: acquisition / SEO market discovery (CRM densest metro)
- **Owned-social:** Facebook + Instagram — weekday Meta Graph; reduce priority if posts remain FAILED_NO_SIGNUP

## Log

### 2026-08-27 — STRATEGY LOCK Day 4 / 7 (EXP-002 KEEP; Meta distribution blocked)

| Field | Value |
|-------|--------|
| Status | LOCKED — EXP-002 evaluation recorded KEEP; distribution NOT executed (Meta SSM credentials missing in cloud agent) |
| Evaluation | **EXP-002 KEEP** — partner hub + invite routes healthy; 0 partner-attributed signups (partner email fail-closed; no approved shares); infrastructure treatment unchanged |
| Evidence | Production healthy (all partner routes 200). 7d GA4: 67 landings, 0 signup_started, 0 profile_completed, 14 returning users. Stripe: 0 attributed payments; 1 unattributed live session (30d) excluded. CRM unavailable (GROWTH_METRO_READ_TOKEN unconfigured). |
| Distribution attempted | NO — `META_PAGE_ACCESS_TOKEN`, `FACEBOOK_PAGE_ID`, `INSTAGRAM_BUSINESS_ACCOUNT_ID` missing from SSM/env in this run |
| Prepared (not published) | VIBE×EN would rotate next per lock bias; dry-run selected `train-en-workout-partner` (catalog weekday rotation) |
| Blocker | Owner action: configure Meta SSM params or run `node scripts/growth/setup-meta-token.mjs` so weekday `publish-owned-social.mjs` can execute |
| Product change | NO — collecting data; no EXP-002 surface changes |
| New customers acquired by this run | 0 |
| Verified purchase result | 0 |

### 2026-08-26 — STRATEGY LOCK Day 3 / 7 (email recovery)

| Field | Value |
|-------|--------|
| Status | LOCKED — distribution executed; Admin email was missing until manual recovery |
| Cause | Weekday automation published Meta posts (~14:04–14:05 UTC) but did not complete `compose-and-send-growth-email.mjs` (no local published-log update; likely cloud worktree exit before SES) |
| Distribution | DATE×ES FB `1138684902641972_122129338148773778` + IG `18122369977878348`; DATE×EN FB `1138684902641972_122129338232773778` + IG `17956841069996699` |
| Admin email | Recovered 2026-08-26 — SES `010001a03e851bdc-bb3a75a2-456f-479a-bd1b-3b860ff72f3b-000000` |
| Next acquisition bias | **VIBE** (DATE used 8/25 and 8/26); not more DATE-only / Atlanta TRAIN CRO |
| Product change | NO |
| Verified purchase result | 0 |

### 2026-08-25 — STRATEGY LOCK Day 2 / 7

| Field | Value |
|-------|--------|
| Status | LOCKED — collecting data |
| Evidence | Automation report: 66 landings / 7d, 0 GA4 signups/profiles/Discover/requests/messages; returning 10 (7d) / 13 (30d); CRM TRAIN 8 / VIBE 6 / DATE 7; Atlanta DATE pocket 3 profiles / 1 match |
| Distribution | DATE×ES `owned-*-date-es-20260825` FB `1138684902641972_122129153204773778` + IG `18126290320765039` |
| Report note | Email wrongly showed `Distribution executed: false` + stale Meta BLOCKING while Meta VALID and posts PUBLISHED — reporting bug fixed under lock rule (tracking honesty) |
| Next acquisition bias | Prefer VIBE (DATE done today); keep exploit Atlanta DATE / SF density; not Atlanta TRAIN CRO |
| Product change | Report lead coalesce only (no product UX change) |
| Verified purchase result | 0 |

### 2026-08-24 — STRATEGY LOCKED (Day 1 / 7)

| Field | Value |
|-------|--------|
| Status | LOCKED measurement window started |
| Evidence | FINAL AUTONOMOUS GROWTH SYSTEM accepted. 7d: 64 landings, 0 signup_started (GA4); CRM TRAIN 8 / VIBE 6 / DATE 7; Atlanta DATE pocket 3 profiles / 1 match. |
| Distribution today | Already executed: TRAIN×EN + TRAIN×RU FB+IG. No third TRAIN post. No product code change. |
| Lock | `docs/growth/STRATEGY-LOCK.md` — review on/after 2026-08-31 |
| Next acquisition bias | Prefer DATE or VIBE (exploit Atlanta DATE liquidity / explore non-TRAIN); not Atlanta TRAIN CRO |
| Product change | NO — collecting data |
| Verified purchase result | 0 |

### 2026-08-24 — Manual weekday run (Cursor Automations rate-limited)

| Field | Value |
|-------|--------|
| Status | Distributed (manual; Cursor Automations Run Test failed on global rate limit) |
| Evidence | Cursor: `Automation run rate limit exceeded: global limit 4000 per minute, current_count=5316`. Production healthy. 7d GA4: 64 landings, 0 signup_started, 0 customers. |
| Distribution | TRAIN×EN `train-en-question-consistency` FB `1138684902641972_122128979204773778` + IG `17906306094540717` |
| Verified purchase result | 0 new customers acquired by this run |

### 2026-08-21 — Multi-mode invite + SF density + DATE×SF distribution

| Field | Value |
|-------|--------|
| Status | Shipped + distributed |
| Evidence | CRM: SF 4 completed profiles (top metro); DATE Atlanta pocket has matches; TRAIN 8 / VIBE 6 / DATE 7. Owned-social VIBE posts same day with 0 attributed signups historically. EXP-003 TRAIN-only blocked VIBE/DATE inviters. |
| Actions | (1) EXP-003 ITERATE: invite CTA for TRAIN+VIBE+DATE + mode-aware landing. (2) EXP-004: `/san-francisco` multi-mode acquisition landing. (3) Owned-social DATE×EN×SF → `/san-francisco` (not another VIBE caption). |
| Primary metric | Referral share attempts by mode; SF `landing_page_view` + `signup_started`; DATE SF campaign attributed visits |
| Guardrail | No EXP-002 partner send. No fake density. No Atlanta-default market selection. |
| Commit | https://github.com/maxkantor/GetTrainMate/commit/34c956a |
| Deployment status | Amplify job 495 SUCCEED |
| Production verification | `/san-francisco` live with TRAIN/VIBE/DATE join CTAs |
| Distribution | DATE×EN×SF FB `1138684902641972_122128457078773778` + IG `18122520661857602` |
| Verified purchase result | 0 new customers acquired by this run |

### 2026-08-21 — Landing→signup conversion (mode landings + signup friction)

| Field | Value |
|-------|--------|
| Status | Shipped + distributed |
| Evidence | 7d GA4: 24 `landing_page_view`, 0 `signup_started`, 0 completed signups, 0 customers. Decision engine: traffic > 0 and signup_start = 0 → landing/CTA problem. Production audit: mode pages sold product architecture ("not Atlanta-only") instead of benefits; pricing CTA competed with join; signup dropped mode context and required confirm-password. |
| Target | International TRAIN + VIBE + DATE visitors from SEO + owned social |
| Funnel stage | landing → signup (proven blocker) |
| Exact change | Benefit-first mode landings (`/workout-partner`, `/meet-people`, `/active-dating`); free-to-join CTA; remove confirm-password; mode-aware signup copy; `signup_view` / `signup_submit` / `signup_error` / `signup_verification_sent` / `signup_verified`; persist modeTotals+pockets in funnel snapshot; redeployed API Lambda so CRM returns ModeTotals (TRAIN 8 / VIBE 6 / DATE 7). |
| Primary metric | `signup_started` and `signup_view` from mode landings within 7d |
| Guardrail | Do not modify EXP-002 partner pages/codes. No fake density. Partner email still fail-closed. |
| Commit | https://github.com/maxkantor/GetTrainMate/commit/f9ec989 |
| Deployment status | Amplify job 493 SUCCEED; API Lambda CDK UPDATE_COMPLETE |
| Production verification | `/workout-partner` shows "Find people who actually want to train" + Join free CTA; `/signup?mode=TRAIN` shows mode-aware copy and 3 fields (no confirm password) |
| Distribution | Owned social VIBE×EN: FB `1138684902641972_122128450736773778` + IG `17882021496684702` → `/meet-people` (plus earlier same-day VIBE×ES) |
| Verified purchase result | 0 new customers acquired by this run |

### 2026-08-18 — International TRAIN+VIBE+DATE positioning + owned social engine


| Field | Value |
|-------|--------|
| Status | Shipped (code). Distribution executes when Meta SSM credentials are present. |
| Change | Growth north star is 1,000+ active users then paying customers across TRAIN/VIBE/DATE. Reports lead with global growth, mode split, and ranked markets — not Atlanta TRAIN profiles. Weekday Facebook+Instagram publisher (`publish-owned-social.mjs`) rotates mode/language. SEO pages `/workout-partner`, `/meet-people`, `/active-dating`. Metro CRM adds mode totals and metro×mode pockets. |
| Guardrail | Never guarantee matches/dates. Partner email still fail-closed. Never commit Meta tokens. Draft ≠ distribution. |

### 2026-08-17 — International marketplace scope (infrastructure)

| Field | Value |
|-------|--------|
| Status | Shipped (no new distribution; partner send stays disabled) |
| Change | Market campaigns model; canonical partner routes `/partners/<country>/<market>/<code>` with Atlanta legacy aliases; Admin CRM global/per-market discovery; qualified profile definition no longer Atlanta+TRAIN-only; referral landing uses referrer metro from URL; max 3 active markets |
| Active markets | Atlanta (us/atlanta) only — Miami, NYC, London, Toronto remain **candidate** until verified demand + activation |
| Guardrail | Never infer emails; English-only outreach queue; do not enable PARTNER_OUTREACH_SEND_ENABLED |

### 2026-08-17 — IG-2026-08-17 Instagram posting approved (not yet live)

| Field | Value |
|-------|--------|
| Status | Approved. Distribution not executed until Max posts. |
| Evidence | Max replied `APPROVED IG-2026-08-17` at 4:19 PM America/New_York. Cursor has no Instagram credentials and did not post. Partner email not sent. |
| Target metro and segment | Atlanta, Georgia · TRAIN |
| Funnel stage | acquisition / owned-social distribution |
| Exact change | Recorded approval in `docs/growth/partners/OWNER-APPROVAL-REQUEST.md`. No product treatment change. |
| Primary metric | After post: `landing_page_view` with `utm_source=instagram` + `utm_campaign=owned-ig-2026-08-17` |
| Guardrail metric | Do not count visits until the post is live. Do not send partner email. |
| Verified purchase result | 0 new customers acquired by this approval record |

### 2026-08-17 — EXP-003 Atlanta TRAIN user-initiated referral invite

| Field | Value |
|-------|--------|
| Status | active |
| Evidence | EXP-001 KEEP. EXP-002 collecting. Marketplace density still the bottleneck. No user-initiated Atlanta TRAIN referral surface existed. Partner drafts are not distribution. |
| Target metro and segment | Atlanta, Georgia · TRAIN |
| Funnel stage | acquisition / referral (distinct from EXP-002 partner landing/code treatment) |
| Customer hypothesis | Existing TRAIN users who tap Invite a training partner will share an opaque Atlanta TRAIN signup link; referred visitors will start signup and complete Atlanta TRAIN profiles within 14 days. |
| Eligible audience | Authenticated users with TRAIN selected, from Profile and Discover (including empty-state). |
| Exact change | `/invite` + `/invite/:ref` landing; TRAIN-only Invite CTA with Web Share + copy-link; opaque SHA-256 referral code; attribution `src=referral` / `experiment_id=EXP-003`. Does not modify `/partners/atlanta` or partner codes. |
| Attribution | `src=referral`, `experiment_id=EXP-003`, `ref=<opaque>`, metro=Atlanta, mode=TRAIN. Checkout metadata `referral_code` when present. |
| Primary metric | Referral `landing_page_view` (events) + `signup_started` with `src=referral` |
| Guardrail metric | No automatic messages; no contact uploads; no Cognito/email in URL; EXP-002 routes unchanged; no fake acceptances |
| Baseline | 0 referral landing sessions; 0 referral signups; verified external paying customers 0 |
| Target | ≥1 referral landing session and ≥1 referral signup start within 14 days after first real-user share |
| Required sample or duration | 14 days from first production deploy (eval 2026-08-31) |
| Evaluation date | 2026-08-31 (original; actual TBD at eval) |
| Continue/stop rule | KEEP if attribution works and any referral landings occur. ITERATE CTA copy/placement if TRAIN users exist but 0 share attempts after 14 days. STOP/rollback if `/invite` 404s, share exposes PII, or EXP-002 partner routes break. |
| Locked surface | `/invite`, `/invite/:ref`, Profile/Discover invite CTA. Do not change EXP-002 partner pages/codes. |
| Rollback procedure | `git revert` EXP-003 commit on `main`; remove `/invite` Amplify rewrite and prerender page |
| Commit | https://github.com/maxkantor/GetTrainMate/commit/750bfd3 |
| Deployment status | Amplify job 483 SUCCEED (commit 750bfd3) |
| Production verification | Amplify job 483 built `/invite/index.html`. Custom rewrite applied via `amplify.yml` + `deploy/amplify-custom-rules.json`. Confirm `/invite` serves prerendered Atlanta TRAIN HTML (not the SPA homepage shell). |
| Verified purchase result | 0 new customers acquired by this run until a referred verified payment exists |

### 2026-08-17 — EXP-001 KEEP + owned-social approval request (not a new experiment)

| Field | Value |
|-------|--------|
| Status | KEEP (EXP-001 treatment unchanged). Distribution not executed. |
| Evidence | EXP-001 evaluation date 2026-08-16 is overdue. Traffic remains too low for CRO. Acquisition override prefers qualified distribution over another experiment. No Instagram posting authorization. Exact caption prepared; not posted. Newly attributed external customers this run: 0. New customers acquired by this run: 0. |
| Target metro and segment | Atlanta, Georgia · TRAIN |
| Funnel stage | acquisition / owned-social distribution (existing EXP-001 landing; no new experiment) |
| Customer hypothesis | An approved Instagram @gettrainmate post with UTM `owned-ig-2026-08-17` will produce attributable visits to `/atlanta-training-partners` after Max posts. |
| Exact change | Prepared `docs/growth/partners/OWNER-APPROVAL-REQUEST.md` + Admin report lead fields. No product treatment change. No partner email send. |
| Primary metric | After post: `landing_page_view` with `utm_source=instagram` + `utm_campaign=owned-ig-2026-08-17`; then activation → checkout → verified payment |
| Guardrail metric | Do not count unattributed landings or window-observed payers as new customers. Do not post without `APPROVED IG-2026-08-17`. |
| Baseline | 0 Instagram-attributed visits for this campaign; verified external paying customers 0 |
| Target | ≥1 attributed landing session after Max posts; directional toward 1 newly attributed external customer |
| Required sample or duration | Count only after the post is live |
| Evaluation date | After first live post + 7 days (not started) |
| Continue/stop rule | Do not launch EXP-003. Do not iterate EXP-001 for CRO while this distribution is unapproved. |
| Rollback procedure | n/a (no production treatment change) |
| Commit | pending this run |
| Deployment status | docs/scripts only unless Amplify rebuilds from main |
| Production verification | Instagram post not live |
| Verified purchase result | 0 newly attributed external customers; 0 new customers acquired by this run |

### 2026-08-13 — EXP-002 Atlanta partner invite landings + codes

| Field | Value |
|-------|--------|
| Status | active |
| Evidence | Marketplace density insufficient; verified external paying customers baseline 0; EXP-001 collecting but partner distribution infrastructure missing. Bottleneck = qualified Atlanta TRAIN acquisition via communities. |
| Target metro and segment | Atlanta, Georgia · TRAIN · run clubs, trainers, pickleball, CrossFit/HYROX, rec sports |
| Funnel stage | partner acquisition infrastructure |
| Customer hypothesis | Unique partner invite landings + codes will produce attributable Atlanta TRAIN signups within 14 days when Max shares approved outreach. |
| Exact change | `/partners/atlanta` hub, `/partners/atlanta/:partnerCode` template, `atlantaPartners` registry, attribution `partner`→`partner_code`, outreach package (not sent). |
| Primary metric | Partner-landing `landing_page_view` + `signup_started` / completed profiles with `partner` attribution |
| Guardrail metric | No fake users; EXP-001 URL remains healthy; no unsolicited outreach by automation |
| Baseline | 0 partner invite URLs; 0 partner-attributed signups |
| Target | ≥1 partner-attributed signup start within 14 days after first approved share; directional toward 30d density targets |
| Required sample or duration | 14 days from first distributed link (eval 2026-08-27) |
| Evaluation date | 2026-08-27 |
| Continue/stop rule | Rollback if partner routes 404 or signup query broken. Continue while EXP-001 remains active. |
| Rollback procedure | `git revert` EXP-002 commit; remove amplify partner rewrites if needed |
| Commit | `8b67f80` |
| Deployment status | Amplify pending verification |
| Production verification | pending post-deploy |
| Verified purchase result | n/a (density-first) |

### 2026-08-12 — EXP-001 Atlanta training partners landing page

| Field | Value |
|-------|--------|
| Status | active |
| Evidence | 7d GA4: ~3 landings, 0 signups; 30d: ~16 landings, 2 signup_completed, 1 profile, low Discover. Stripe 30d: 1 live paid. Traffic too low for CRO; marketplace density is the bottleneck. Atlanta is the temporary focus metro (assumption). |
| Target metro and segment | Atlanta, Georgia · TRAIN (gyms, run clubs, Hyrox/CrossFit) |
| Funnel stage | acquisition / SEO |
| Customer hypothesis | A dedicated Atlanta TRAIN landing with clear signup CTA and UTM-friendly query params will increase qualified Atlanta signups vs homepage-only acquisition. |
| Exact change | New page `/atlanta-training-partners` + route + SEO prerender + sitemap + Amplify rewrite. Files: `AtlantaTrainingPartners.tsx`, `Router.tsx`, `seoRoutes.ts`, prerender plugin, sitemap, amplify rules. |
| Primary metric | `landing_page_view` + `signup_started` / `signup_completed` with source `/atlanta-training-partners` (or query `src=atlanta-training-partners`); secondary: Atlanta profiles in Admin CRM. |
| Guardrail metric | Homepage conversion and signup error rate must not worsen; no fake density claims. |
| Baseline | 0 dedicated Atlanta SEO URL; ~3 landings/7d sitewide. |
| Target | Directional: organic/direct visits + Atlanta signups from this URL within 14 days. |
| Required sample or duration | Collect through 2026-08-16 |
| Evaluation date | 2026-08-16 |
| Continue/stop rule | If page 404s, prerender/canonical broken, or signup path fails within 48h → rollback. Continue if URL is indexed and captures any signup starts. |
| Rollback procedure | `git revert` EXP-001 commit on `main` and push; Amplify redeploys. |
| Commit | `4c8612a` |
| Deployment status | Amplify jobs 460–462 SUCCEED; custom rules applied |
| Production verification | `/atlanta-training-partners` canonical OK (2026-08-12) |
| Verified purchase result | n/a (acquisition experiment) |

### 2026-08-12 — SETUP Growth infrastructure bootstrap

| Field | Value |
|-------|--------|
| Status | completed |
| Evidence | User requested autonomous paid-customer growth system matching YouTubeBooster / LuckyNumbersLab architecture. |
| Target metro and segment | n/a (infrastructure only) |
| Funnel stage | n/a |
| Customer hypothesis | n/a |
| Exact change | Added `.cursor/skills/grow-paid-customers/SKILL.md`, `docs/growth/*`, `scripts/growth/*`. No product experiment in setup commit. |
| Primary metric | n/a |
| Guardrail metric | n/a |
| Baseline | n/a |
| Target | n/a |
| Required sample or duration | n/a |
| Evaluation date | n/a |
| Continue/stop rule | n/a |
| Rollback procedure | Revert setup commit on `main` if scripts break CI. |
| Commit | `555513e` |
| Deployment status | Amplify job 455 SUCCEED |
| Production verification | Health OK |
| Verified purchase result | n/a |

**Marketplace assumption:** Rank markets from verified CRM/GA4 evidence. Atlanta remains the first **active** TRAIN partner campaign; international routes do not imply existing partnerships.

---

## Completed / failed

_None beyond setup._
