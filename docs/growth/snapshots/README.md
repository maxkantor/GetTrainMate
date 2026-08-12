# Funnel snapshots

Daily JSON snapshots written by `scripts/growth/collect-funnel-snapshot.mjs`.

- Filename pattern: `funnel-YYYY-MM-DD.json`
- Contains aggregated GA4 event counts, Stripe live/test payment summaries, marketplace-density notes, and data-source status
- **No PII** — never user emails, messages, or precise locations
- Snapshot JSON files are gitignored (`funnel-*.json`); only this README is committed

Run locally:

```bash
node scripts/growth/load-ssm-secrets-into-env.mjs   # optional
node scripts/growth/collect-funnel-snapshot.mjs
```
