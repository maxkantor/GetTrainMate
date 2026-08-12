# Growth scripts

## Collect funnel snapshot

```bash
node scripts/growth/load-ssm-secrets-into-env.mjs   # optional
node scripts/growth/collect-funnel-snapshot.mjs
node scripts/growth/check-production-health.mjs
node scripts/growth/verify-secrets.mjs
node scripts/growth/compose-and-send-growth-email.mjs --notes "Optional agent notes"
```

Install GA4 client (once):

```bash
npm i --prefix scripts/growth
```

## Secrets

See **`docs/growth/SECRETS-SETUP.md`**.

Env / Automation / SSM:

- `GA4_PROPERTY_ID` → `/gettrainmate/growth/ga4-property-id`
- `GOOGLE_ANALYTICS_CREDENTIALS_JSON` → `/gettrainmate/growth/google-analytics-credentials-json`
- `STRIPE_RESTRICTED_READ_KEY` → `/gettrainmate/growth/stripe-restricted-read-key` (`rk_…` only)

Snapshots write under `docs/growth/snapshots/` (`funnel-*.json` gitignored).
