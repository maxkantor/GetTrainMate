# Billing Setup (DB-Driven Plans, Admin CRM)

## Overview

- **Plans**: Free, Pro ($5.99/mo), Elite ($9.99/mo) stored in `gettrainmate-billing-plans` DynamoDB table
- **Admin CRM**: Edit plans, set Stripe Price IDs at Admin CRM → Billing Plans
- **Flow**: Pricing page reads DB (or defaults if empty), displays and caches; checkout reads planKey from UI, looks up plan in DB for Price ID

## 1. Deploy Infrastructure

```bash
cd infra
npx cdk deploy
```

## 2. Seed Billing Plans

After first deploy, seed default plans (public, no auth):

```bash
curl -X POST "$API_URL/api/billing/seed" -H "Content-Type: application/json" -d '{}'
```

Or: `bash scripts/seed-billing-plans.sh`

## 3. Configure Stripe Price IDs in Admin CRM

1. Create Products and Prices in [Stripe Dashboard](https://dashboard.stripe.com/products) (or use existing from another app)
2. Copy the Price IDs (e.g. `price_xxx`)
3. Admin CRM → **Billing Plans** → Edit Pro and Elite → paste Stripe Price ID → Save

## 4. Stripe Webhook

Configure webhook in Stripe Dashboard → Developers → Webhooks:

- **URL**: `https://your-api-url/stripe/webhook` (or `/api/billing/webhook`)
- **Events**: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`
- **Signing secret**: Store in SSM `/gettrainmate/stripe/webhook-secret`

## 5. Flow Summary

| Action | Source |
|--------|--------|
| Pricing page load | GET /api/billing/plans → DB (fallback: defaults) |
| Display plans | UI caches response |
| Click "Upgrade to Pro" | Frontend sends planKey to create-checkout-session |
| Checkout | Backend looks up plan in DB, uses StripePriceIdMonthly |

## 6. API Endpoints

| Endpoint | Auth | Description |
|----------|------|-------------|
| `GET /api/billing/plans` | Public | Active plans (from DB or defaults) |
| `POST /api/billing/seed` | Public | Seed default plans (idempotent) |
| `POST /api/billing/create-checkout-session` | JWT | Create Stripe Checkout using plan from DB |
| `POST /api/billing/webhook` | Stripe sig | Handle subscription events |
| `GET /api/billing/subscription-status` | JWT | User's current plan |
