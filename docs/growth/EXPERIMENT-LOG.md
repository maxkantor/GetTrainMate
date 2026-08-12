# GetTrainMate — customer growth experiment log

Agents must append every experiment here. Do not delete history.

## Active

- **EXP-001** — Atlanta training partners landing (`/atlanta-training-partners`) — eval **2026-08-26** — funnel stage: acquisition / SEO

## Log

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
| Required sample or duration | 14 days (eval 2026-08-26) |
| Evaluation date | 2026-08-26 |
| Continue/stop rule | If page 404s, prerender/canonical broken, or signup path fails within 48h → rollback. Continue if URL is indexed and captures any signup starts. |
| Rollback procedure | `git revert` EXP-001 commit on `main` and push; Amplify redeploys. |
| Commit | (pending push) |
| Deployment status | pending Amplify |
| Production verification | pending |
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
