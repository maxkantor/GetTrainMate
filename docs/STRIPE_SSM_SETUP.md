# Stripe Keys via SSM Parameter Store

The API loads Stripe keys from AWS Systems Manager Parameter Store at startup. If parameters are missing or keys are expired, the Pricing page will show "Expired API Key" or "Payment configuration error."

## Required Parameters

| Parameter | Description |
|-----------|-------------|
| `/gettrainmate/stripe/secret-key` | Stripe secret key (`sk_live_...` or `sk_test_...`) |
| `/gettrainmate/stripe/webhook-secret` | Stripe webhook signing secret (`whsec_...`) |

## Create/Update Parameters

### Option 1: AWS CLI

```bash
# Replace with your actual keys from Stripe Dashboard → Developers → API keys
aws ssm put-parameter \
  --name "/gettrainmate/stripe/secret-key" \
  --value "sk_live_XXXXXXXXXXXXXXXX" \
  --type SecureString \
  --overwrite

aws ssm put-parameter \
  --name "/gettrainmate/stripe/webhook-secret" \
  --value "whsec_XXXXXXXXXXXXXXXX" \
  --type SecureString \
  --overwrite
```

### Option 2: Script

```bash
# From project root
./scripts/set-stripe-ssm.sh
```

## Get Fresh Keys

1. **Secret key**: [Stripe Dashboard](https://dashboard.stripe.com/apikeys) → API keys → Create secret key
2. **Webhook secret**: [Stripe Webhooks](https://dashboard.stripe.com/webhooks) → Add endpoint → Signing secret
   - Webhook URL: `https://YOUR_API_URL/stripe/webhook`
   - Events: `checkout.session.completed`, `customer.subscription.*`

## Verify

```bash
# Check if parameters exist (values are masked)
aws ssm get-parameter --name "/gettrainmate/stripe/secret-key" --query 'Parameter.Name'
aws ssm get-parameter --name "/gettrainmate/stripe/webhook-secret" --query 'Parameter.Name'
```

## Lambda Permissions

The API Lambda has `ssm:GetParameter` on `arn:aws:ssm:REGION:ACCOUNT:parameter/gettrainmate/*`. No additional setup needed if you deploy with the standard CDK stack.
