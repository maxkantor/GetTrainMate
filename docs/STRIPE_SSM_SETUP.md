# Stripe Keys via SSM Parameter Store

The API loads Stripe keys from AWS Systems Manager Parameter Store at startup. If parameters are missing or keys are expired, the Pricing page will show "Expired API Key" or "Payment configuration error."

## Required Parameters

| Parameter | Description |
|-----------|-------------|
| `/gettrainmate/stripe/secret-key` | Stripe secret key (`sk_live_...` or `sk_test_...`) |
| `/gettrainmate/stripe/webhook-secret` | Stripe webhook signing secret (`whsec_...`). You may store **multiple** secrets separated by comma or newline (e.g. old + new during rotation). |

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

## Troubleshooting: `400` / `Invalid signature` on webhooks

Stripe signs the **exact** raw POST body. Verification fails if:

1. **Wrong signing secret** — Each webhook **endpoint URL** in Stripe has its own **Signing secret** (`whsec_...`). The value in SSM **`/gettrainmate/stripe/webhook-secret` must match** the secret shown for the endpoint whose URL is exactly what Stripe calls (e.g. `https://YOUR_API_ID.execute-api.us-east-1.amazonaws.com/stripe/webhook`). If you add a new endpoint or rotate the secret in Stripe, update SSM and redeploy the API Lambda.
2. **Test vs Live** — Use the **live** secret with live mode keys (and the endpoint configured in live Stripe).
3. **Lambda is not using the SSM value** — Resolution order is: `Configuration["Stripe:WebhookSecret"]` (includes `Stripe__WebhookSecret` on the Lambda), then `STRIPE_WEBHOOK_SECRET`, then SSM **only if the value is still empty**. If the Lambda has **any** non-empty `Stripe__WebhookSecret` or `STRIPE_WEBHOOK_SECRET` (leftover from an old test), that value is used and **SSM is never read** for the webhook secret. If **both** API key and webhook secret are already non-empty from env/config, the whole SSM block is skipped. **Symptom:** Stripe and SSM match in the console, but CloudWatch still shows `Invalid signature` — open **Lambda → Configuration → Environment variables**, remove stale Stripe vars so SSM loads, redeploy, and confirm startup logs `firstSegmentPrefixOk=True`.
4. **Wrong kind of secret** — Only the **Signing secret** (`whsec_...`) from **Developers → Webhooks → [your endpoint]** works. The restricted API key, `sk_live_...`, or a secret from a **different** webhook destination will always fail verification.

After updating SSM, restart/redeploy Lambda so it reloads parameters at cold start.

On startup, CloudWatch should include: `Stripe webhook signing secret: length=…, firstSegmentPrefixOk=True` when a proper `whsec_` value is loaded.

### It used to work — then every delivery failed

That almost always means the **signing secret in SSM no longer matches** the secret Stripe uses for **this** endpoint (same webhook URL in Stripe). Common causes:

- **New or duplicated webhook** in Stripe — each destination has its **own** `whsec_...`; pasting an old secret breaks verification.
- **“Roll secret”** or Stripe endpoint recreated — the previous `whsec` is invalid immediately.
- **Copy/paste errors** — `whsec_` strings mix up **`1` vs `l`**, **`0` vs `O`**. Compare the full value: open **Reveal** next to *Signing secret* on the endpoint that shows URL `https://<your-api-id>.execute-api.us-east-1.amazonaws.com/stripe/webhook` and ensure SSM matches **character-for-character**.
- **Test vs Live** — Live Stripe events require the **live** endpoint’s signing secret (and live `sk_live_...` API key in SSM).

**Fix:** In Stripe → Webhooks → select **Get Train Mate** (same URL as API Gateway) → **Reveal** signing secret → copy the **entire** `whsec_...` → `aws ssm put-parameter ... /gettrainmate/stripe/webhook-secret` → `--overwrite` → redeploy or wait for new Lambda instances. Then **Send test webhook** in Stripe and confirm **200**.

If a secret was exposed (screenshot, chat), use **Roll secret** in Stripe, update SSM with the new value, and redeploy.

## Verify

```bash
# Check if parameters exist (values are masked)
aws ssm get-parameter --name "/gettrainmate/stripe/secret-key" --query 'Parameter.Name'
aws ssm get-parameter --name "/gettrainmate/stripe/webhook-secret" --query 'Parameter.Name'
```

## Lambda Permissions

The API Lambda has `ssm:GetParameter` on `arn:aws:ssm:REGION:ACCOUNT:parameter/gettrainmate/*`. No additional setup needed if you deploy with the standard CDK stack.
