#!/usr/bin/env bash
# Create or update Stripe keys in SSM Parameter Store.
# Usage: ./scripts/set-stripe-ssm.sh
# Or with explicit values: STRIPE_SECRET_KEY=sk_live_xxx STRIPE_WEBHOOK_SECRET=whsec_xxx ./scripts/set-stripe-ssm.sh

set -e

KEY_PARAM="/gettrainmate/stripe/secret-key"
WH_PARAM="/gettrainmate/stripe/webhook-secret"

echo "Stripe SSM Setup"
echo "==============="

if [ -n "$STRIPE_SECRET_KEY" ]; then
  echo "Setting secret key from STRIPE_SECRET_KEY env..."
  aws ssm put-parameter \
    --name "$KEY_PARAM" \
    --value "$STRIPE_SECRET_KEY" \
    --type SecureString \
    --overwrite 2>/dev/null || aws ssm put-parameter \
    --name "$KEY_PARAM" \
    --value "$STRIPE_SECRET_KEY" \
    --type SecureString
  echo "✓ $KEY_PARAM"
else
  echo "Skipping secret key (set STRIPE_SECRET_KEY to create)"
fi

if [ -n "$STRIPE_WEBHOOK_SECRET" ]; then
  echo "Setting webhook secret from STRIPE_WEBHOOK_SECRET env..."
  aws ssm put-parameter \
    --name "$WH_PARAM" \
    --value "$STRIPE_WEBHOOK_SECRET" \
    --type SecureString \
    --overwrite 2>/dev/null || aws ssm put-parameter \
    --name "$WH_PARAM" \
    --value "$STRIPE_WEBHOOK_SECRET" \
    --type SecureString
  echo "✓ $WH_PARAM"
else
  echo "Skipping webhook secret (set STRIPE_WEBHOOK_SECRET to create)"
fi

echo ""
echo "Done. Deploy or restart the API Lambda to pick up changes."
echo "See docs/STRIPE_SSM_SETUP.md for details."
