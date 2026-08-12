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

### 2026-08-12 — BASELINE First scheduled growth measurement (no ship)

| Field | Value |
|-------|--------|
| Status | completed (measurement only) |
| Evidence | GA4 ok (7d: 3 landing views, 0 signups; 30d: 16 landing views, 2 signups, 1 profile complete, 17 match_shown, 0 first_message). Stripe ok (30d: 1 live paid $9.99). Production health all green. Metro dimension not registered in GA4; Admin CRM not queried. |
| Target metro and segment | **Atlanta, Georgia** (assumption — no metro leader in data) |
| Funnel stage | acquisition / marketplace density (pre-conversion) |
| Customer hypothesis | Volume too low for CRO; qualified Atlanta fitness-community acquisition should precede funnel experiments. |
| Exact change | None — baseline snapshot only (`docs/growth/snapshots/funnel-2026-08-12.json`). |
| Primary metric | Qualified local signups per week (Atlanta) |
| Guardrail metric | Production uptime; no fake activity |
| Baseline | 7d landing_page_view=3, signup_completed=0; 30d landing=16, signup_completed=2, verified_purchase (Stripe)=1 |
| Target | ≥10 qualified Atlanta signups/week before CRO experiments |
| Required sample or duration | 2–4 weeks of acquisition focus |
| Evaluation date | 2026-08-19 |
| Continue/stop rule | Continue Atlanta acquisition focus; do not start same-stage CRO until weekly signups support measurement. |
| Rollback procedure | n/a (no product change) |
| Commit | n/a |
| Deployment status | n/a |
| Production verification | Health script passed 2026-08-12 |
| Verified purchase result | Stripe 30d: $9.99 live (1 session) |

---

_None beyond setup and baseline._
