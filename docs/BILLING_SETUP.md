# Billing Setup (Stripe Payment Links)

## Overview

- **Plans**: Free, Pro ($5.99/mo), Elite ($9.99/mo) displayed from DB or defaults
- **Checkout**: Uses Stripe Payment Links (no products/prices to create in app)
- **Stripe**: Secret key, webhook secret, and Payment Link URLs in SSM

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

## 3. Create Stripe Payment Links

1. Go to [Stripe Dashboard → Payment Links](https://dashboard.stripe.com/payment-links)
2. Create a Payment Link for **Pro** ($5.99/mo subscription)
3. Create a Payment Link for **Elite** ($9.99/mo subscription)
4. Copy each URL (e.g. `https://buy.stripe.com/xxx`)

## 4. Add Payment Link URLs to SSM

```bash
aws ssm put-parameter --name "/gettrainmate/stripe/payment-link-pro" \
  --value "https://buy.stripe.com/YOUR_PRO_LINK" --type String

aws ssm put-parameter --name "/gettrainmate/stripe/payment-link-elite" \
  --value "https://buy.stripe.com/YOUR_ELITE_LINK" --type String
```

## 5. Stripe Webhook

Configure webhook in Stripe Dashboard → Developers → Webhooks:

- **URL**: `https://your-api-url/api/billing/webhook`
- **Events**: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`
- **Signing secret**: Store in SSM `/gettrainmate/stripe/webhook-secret`

## 6. SSM Parameters Summary

| Parameter | Description |
|-----------|-------------|
| `/gettrainmate/stripe/secret-key` | Stripe secret key |
| `/gettrainmate/stripe/webhook-secret` | Webhook signing secret |
| `/gettrainmate/stripe/payment-link-pro` | Pro plan Payment Link URL |
| `/gettrainmate/stripe/payment-link-elite` | Elite plan Payment Link URL |

## 7. API Endpoints

| Endpoint | Auth | Description |
|----------|------|-------------|
| `GET /api/billing/plans` | Public | Active plans for pricing page |
| `POST /api/billing/seed` | Public | Seed default plans (idempotent) |
| `POST /api/billing/create-checkout-session` | JWT | Redirect to Payment Link with user ref |
| `POST /api/billing/webhook` | Stripe sig | Handle subscription events |
| `GET /api/billing/subscription-status` | JWT | User's current plan |
