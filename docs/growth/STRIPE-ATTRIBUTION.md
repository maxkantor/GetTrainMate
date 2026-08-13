# Stripe attribution for GetTrainMate growth reporting

**Critical:** The Stripe account may power multiple applications (including YouTubeBooster).  
**Never** treat account-wide live payments as GetTrainMate revenue or customers.

## Verified business baselines (until reconciliation completes)

| Product | Verified external paying customers |
|---------|-------------------------------------|
| GetTrainMate | **0** |
| YouTubeBooster | **0** |

Do **not** overwrite these baselines from an account-wide Stripe query. Set `reconciliationComplete: true` in `scripts/growth/config/stripe-allowlist.json` only after a human-reviewed reconciliation.

## Conclusive GetTrainMate ownership (include)

A live paid Checkout Session / matching Charge counts as this app **only** when one of:

1. Metadata `gtm_source=gettrainmate` (canonical; set by API on Checkout Session create)
2. Allowlisted Stripe **Price ID** (`price_…`) from config / `STRIPE_GTM_PRICE_IDS`
3. Allowlisted Stripe **Product ID** (`prod_…`) from config / `STRIPE_GTM_PRODUCT_IDS`
4. Allowlisted **Payment Link ID** from config / `STRIPE_GTM_PAYMENT_LINK_IDS`
5. **Legacy credits** metadata containing **all** of: `packKey`, `credits`, `priceUsd` (and no foreign app source key)

Code reference: `apps/api/Infrastructure/StripeSessionOwnership.cs`  
Allowlist file: `scripts/growth/config/stripe-allowlist.json`

## Exclude (never GetTrainMate revenue / customers)

- Transactions for another application
- Owner / self purchases (`excludeCustomerIds` / `STRIPE_GTM_EXCLUDE_CUSTOMER_IDS`)
- Setup and smoke-test purchases (same exclude list or explicit metadata)
- Refunded payments
- Test-mode payments
- Duplicate Charge vs PaymentIntent / Checkout Session representations
- **Unknown product attribution** → report as **Unattributed Stripe payment** (not revenue, not customers)

## Reporting fields

| Field | Meaning |
|-------|---------|
| `attributed_live_payments` | Successful live payments conclusively tied to GetTrainMate |
| `unattributed_live_payments` | Live paid sessions/charges that cannot be attributed — **not** revenue |
| `unique_external_paying_customers` | Deduped attributed customers minus excludes; **forced to verified baseline (0) until reconciliationComplete** |
| `revenue_live_usd` | Sum of attributed live payments only (refunds excluded) |

## Secrets / config (no credentials in git)

| Env | Purpose |
|-----|---------|
| `STRIPE_RESTRICTED_READ_KEY` | Read-only Stripe key |
| `STRIPE_GTM_PRICE_IDS` | Comma-separated Price IDs |
| `STRIPE_GTM_PRODUCT_IDS` | Comma-separated Product IDs |
| `STRIPE_GTM_PAYMENT_LINK_IDS` | Comma-separated Payment Link IDs |
| `STRIPE_GTM_EXCLUDE_CUSTOMER_IDS` | Owner/self/smoke Stripe customer ids to exclude |

Optional SSM mirrors under `/gettrainmate/growth/stripe-*` may be added later; do not store secret API keys in the allowlist JSON.
