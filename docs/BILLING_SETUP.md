# Billing Setup (Stripe Price IDs from SSM)

## Overview

- **Plans**: Free, Pro ($5.99/mo), Elite ($9.99/mo) displayed from DB or defaults
- **Checkout**: Creates Stripe Checkout Session using Price IDs from SSM
- **No app setup**: Add Price IDs to SSM (from existing Stripe products or another app)

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

## 3. Add Stripe Price IDs to SSM

Use Price IDs from your existing Stripe account (or another app). Example:

```bash
aws ssm put-parameter --name "/gettrainmate/stripe/price-pro" \
  --value "price_xxxxxxxxxxxx" --type String

aws ssm put-parameter --name "/gettrainmate/stripe/price-elite" \
  --value "price_yyyyyyyyyyyy" --type String
```

## 4. Stripe Webhook

Configure webhook in Stripe Dashboard → Developers → Webhooks:

- **URL**: `https://your-api-url/api/billing/webhook`
- **Events**: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`
- **Signing secret**: Store in SSM `/gettrainmate/stripe/webhook-secret`

## 5. SSM Parameters Summary

| Parameter | Description |
|-----------|-------------|
| `/gettrainmate/stripe/secret-key` | Stripe secret key |
| `/gettrainmate/stripe/webhook-secret` | Webhook signing secret |
| `/gettrainmate/stripe/price-pro` | Pro plan Stripe Price ID (price_xxx) |
| `/gettrainmate/stripe/price-elite` | Elite plan Stripe Price ID (price_xxx) |

## 6. API Endpoints

| Endpoint | Auth | Description |
|----------|------|-------------|
| `GET /api/billing/plans` | Public | Active plans for pricing page |
| `POST /api/billing/seed` | Public | Seed default plans (idempotent) |
| `POST /api/billing/create-checkout-session` | JWT | Create Stripe Checkout, redirect |
| `POST /api/billing/webhook` | Stripe sig | Handle subscription events |
| `GET /api/billing/subscription-status` | JWT | User's current plan |
