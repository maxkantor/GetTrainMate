# GetTrainMate — customer growth experiment log

Agents must append every experiment here. Do not delete history.

## Active

_None — growth system initialized 2026-08-12. No customer experiment shipped during setup._

## Log

### 2026-08-12 — SETUP Growth infrastructure bootstrap

| Field | Value |
|-------|--------|
| Status | completed |
| Evidence | User requested autonomous paid-customer growth system matching YouTubeBooster / LuckyNumbersLab architecture. |
| Target metro and segment | n/a (infrastructure only) |
| Funnel stage | n/a |
| Customer hypothesis | n/a |
| Exact change | Added `.cursor/skills/grow-paid-customers/SKILL.md`, `docs/growth/*`, `scripts/growth/*`. No product experiment. |
| Primary metric | n/a |
| Guardrail metric | n/a |
| Baseline | n/a |
| Target | n/a |
| Required sample or duration | n/a |
| Evaluation date | n/a |
| Continue/stop rule | n/a |
| Rollback procedure | Revert setup commit on `main` if scripts break CI. |
| Commit | (see deployment report) |
| Deployment status | pushed to main |
| Production verification | Health script + web build pass; no product change. |
| Verified purchase result | n/a |

**Marketplace assumption:** Until GA4 + CRM data shows a clear leading metro, default focus market is **Atlanta, Georgia** — validate from data on first growth run.

---

## Completed / failed

_None beyond setup._

### 2026-08-12 — BASELINE First scheduled growth metrics run (no ship)

| Field | Value |
|-------|--------|
| Status | completed (monitoring only) |
| Evidence | GA4 7d: 3 landing_page_view, 0 signups, 3 return_visit. GA4 30d: 16 landing, 1 signup_started, 2 signup_completed, 1 profile_completed, 1 discover, 2 likes, 22 return_visit, 1 pricing_viewed, 0 checkout/purchase events. Stripe 30d: 1 live paid ($9.99); 7d: $0. Production health: all checks pass. Metro segmentation unavailable (customEvent:metro not registered in GA4). Admin CRM not wired into snapshot script. |
| Target metro and segment | **Atlanta, Georgia** (assumption — no metro data yet); TRAIN/VIBE fitness partners |
| Funnel stage | acquisition / marketplace density (pre-conversion) |
| Customer hypothesis | n/a — baseline only |
| Exact change | None shipped. Traffic too low for CRO; prioritize qualified local Atlanta acquisition over homepage/conversion experiments. |
| Primary metric | Qualified signups + completed profiles in Atlanta |
| Guardrail metric | Site health, no fake activity |
| Baseline | 7d signups: 0; 30d signups: 2; 30d Stripe revenue: $9.99 |
| Target | Repeatable Atlanta activation before spreading metros |
| Required sample or duration | Re-evaluate after 2 weeks of local acquisition effort |
| Evaluation date | 2026-08-26 |
| Continue/stop rule | Ship tiny local SEO or partnership tracking only when Atlanta density still leads; no simultaneous conversion experiments on same stage. |
| Rollback procedure | n/a |
| Commit | n/a |
| Deployment status | n/a |
| Production verification | Health script OK 2026-08-12 |
| Verified purchase result | 1 live purchase in 30d ($9.99) |
