# Growth metric definitions

Canonical definitions live in `scripts/growth/lib/metric-definitions.mjs` and are shared by snapshot collection and Admin email.

## Rules

1. **Never sum duplicate instrumentation.** If `signup_completed` and `sign_up` both fire for one signup, count **primary only**.
2. **Fallbacks only when primary is absent** (event count 0 / missing).
3. **Label honestly:** if unique users are unavailable, show event counts and say so.
4. **Stripe live payments ≠ unique customers.** Deduplicate by Stripe customer id when present; otherwise customers = Unavailable.
5. **`match_shown` is not `match_created`.**
6. **Never count account-wide Stripe as GetTrainMate.** Only conclusively attributed payments (`gtm_source=gettrainmate`, allowlisted Price/Product/Payment Link IDs, or legacy credits metadata). Everything else is **Unattributed Stripe payment** — not revenue, not customers. See `docs/growth/STRIPE-ATTRIBUTION.md`.
7. **Verified external paying customers baseline = 0** for GetTrainMate (and YouTubeBooster) until `reconciliationComplete` is true in the allowlist.

## Canonical map (summary)

| Metric | Primary event | Fallbacks (if primary absent) | Kind |
|--------|---------------|-------------------------------|------|
| landings | `landing_page_view` | — | events |
| completed_signups | `signup_completed` | `sign_up` | users (prefer totalUsers) |
| completed_profiles | `profile_completed` | `onboarding_completed` | users |
| discover_users | `discover_started` | `discover_viewed` | users |
| connections_sent | `request_sent` | `like_or_connection_sent` | events |
| matches_created | `match_created` | — (never `match_shown`) | events |
| first_messages | `first_message_sent` | — | events |
| returning_users | `return_visit` | — | users |
| pricing_views | `pricing_viewed` | `view_pricing` | events |
| checkout_starts | `begin_checkout` | `checkout_started` | events |
| live_payments / revenue | Stripe **attributed** live succeeded only | — | payments / USD |
| unattributed_live_payments | Live paid without conclusive GTM ownership | — | informational |

## Root cause of Aug 2026 email inconsistencies

1. Snapshot `buildFunnelSummary` **added** aliases (`signup_completed + sign_up`, `match_created + match_shown`, …).
2. Email `funnelKpis` **added them again** via `pick(stageSum, aliasEvent)`, producing ~2× profiles/connections/matches and signup 3 vs notes 2 vs GA4 table 1.

## Metro density (CRM HTTP path)

- Endpoint: `GET /api/admin/metrics/metro?minCohort=3`
- Auth: `X-Growth-Metro-Token` (preferred) or Admin token — **not** SES growth IAM → DynamoDB
- Suppresses metros below min cohort; never returns emails, user ids, or coordinates
- Discover/returning by metro: Unavailable until CRM stores those signals

## EXP-001 paid attribution

- Checkout metadata may include `acquisition_source`, `experiment_id`, `utm_*`, `metro` (no PII)
- Attribution is Unknown when live payments lack those fields
- Sitewide Stripe revenue is never labeled as EXP-001 revenue without metadata evidence
