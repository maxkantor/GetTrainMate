# GetTrainMate — customer growth experiment log

Agents must append every experiment here. Do not delete history.

## Active

- **EXP-001** — Atlanta training partners landing (`/atlanta-training-partners`) — eval **2026-08-16** — **KEEP 2026-08-17** (treatment unchanged; traffic too low for CRO) — funnel stage: acquisition / SEO
- **EXP-002** — Atlanta TRAIN partner invite landings + codes (`/partners/atlanta/:code`) — eval **2026-08-27** — funnel stage: partner acquisition infrastructure (independent of EXP-001 treatment)
- **Blocking distribution:** Instagram `@gettrainmate` exact caption in `docs/growth/partners/OWNER-APPROVAL-REQUEST.md` (approval id `IG-2026-08-17`) — **not posted**

## Log

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

**Marketplace assumption:** Until GA4 + CRM data shows a clear leading metro, default focus market is **Atlanta, Georgia** — validate from data on each growth run.

---

## Completed / failed

_None beyond setup._
