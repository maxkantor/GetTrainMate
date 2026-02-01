# Billing Setup (DB-Driven Plans)

## Overview

- **Plans**: Free, Pro ($5.99/mo), Elite ($9.99/mo) stored in `gettrainmate-billing-plans` DynamoDB table
- **Stripe Price IDs**: Configured in Admin CRM → Billing Plans (no env vars)
- **Stripe env vars**: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (from SSM or env)

## 1. Deploy Infrastructure

```bash
cd infra
npx cdk deploy
```

This creates `gettrainmate-billing-plans` table.

## 2. Seed Billing Plans

After first deploy, seed default plans:

```bash
# Get admin token
ADMIN_TOKEN=$(curl -s -X POST $API_URL/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"your@email","password":"xxx"}' | jq -r '.token')

# Seed
curl -X POST "$API_URL/api/admin/billing/plans/seed" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Or use Admin CRM: go to **Billing Plans** → click **Seed default plans**.

## 3. Configure Stripe Price IDs

1. Create Products and Prices in [Stripe Dashboard](https://dashboard.stripe.com/products)
2. Copy the Price IDs (e.g. `price_xxx`)
3. In Admin CRM → **Billing Plans** → Edit Pro and Elite → paste Stripe Price ID → Save

## 4. Stripe Webhook

Configure webhook in Stripe Dashboard → Developers → Webhooks:

- **URL**: `https://your-api-url/api/billing/webhook`
- **Events**: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`
- **Signing secret**: Store in SSM `/gettrainmate/stripe/webhook-secret`

## 5. API Endpoints

| Endpoint | Auth | Description |
|----------|------|-------------|
| `GET /api/billing/plans` | Public | Active plans for pricing page |
| `POST /api/billing/create-checkout-session` | JWT | Create Stripe Checkout, redirect |
| `POST /api/billing/webhook` | Stripe sig | Handle subscription events |
| `GET /api/billing/subscription-status` | JWT | User's current plan |

## 6. Success / Cancel URLs

Derived from request headers (`Origin` or `Host`):

- Success: `{baseUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`
- Cancel: `{baseUrl}/pricing?canceled=1`
