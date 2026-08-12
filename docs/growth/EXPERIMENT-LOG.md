# GetTrainMate — customer growth experiment log

Agents must append every experiment here. Do not delete history.

## Active

_None — growth system initialized 2026-08-12. No customer experiment shipped during setup._

## Log

### 2026-08-12 — BASELINE First scheduled growth run (metrics only)

| Field | Value |
|-------|--------|
| Status | completed |
| Evidence | Production healthy. GA4 7d: 3 landing views, 0 signups. GA4 30d: 16 landing views, 2 signup_completed, 1 profile_completed, 17 match_created, 22 return_visit, 1 pricing_viewed. Stripe 30d: 1 live purchase ($9.99). Metro segmentation unavailable (customEvent:metro not registered). Admin CRM not wired in snapshot script. |
| Target metro and segment | Atlanta, Georgia (assumption — no metro leader in data) |
| Funnel stage | acquisition / marketplace density (pre-experiment baseline) |
| Customer hypothesis | n/a — baseline measurement |
| Exact change | None shipped. Traffic too low for CRO; prioritize qualified Atlanta local acquisition before conversion experiments. |
| Primary metric | Qualified local signups per week (Atlanta) |
| Guardrail metric | Production uptime, safety controls |
| Baseline | 7d landing views: 3; 30d landing views: 16; 30d signups: 2; 30d Stripe revenue: $9.99 |
| Target | ≥20 qualified Atlanta landing views/week before next conversion test |
| Required sample or duration | 2–4 weeks of local acquisition focus |
| Evaluation date | 2026-08-19 |
| Continue/stop rule | Re-evaluate when 7d Atlanta-qualified traffic supports funnel-stage CRO; do not run overlapping conversion tests on same stage. |
| Rollback procedure | n/a |
| Commit | n/a |
| Deployment status | no product change |
| Production verification | check-production-health.mjs all checks passed |
| Verified purchase result | 1 live ($9.99) in 30d Stripe window |

---

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
