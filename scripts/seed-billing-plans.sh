#!/usr/bin/env bash
# Seed billing plans. Uses public /api/billing/seed (no auth).
# Usage: API_URL=https://xxx ./scripts/seed-billing-plans.sh

set -e
API_URL="${API_URL:-https://goskwzjzjg.execute-api.us-east-1.amazonaws.com}"

echo "Seeding billing plans..."
curl -s -X POST "$API_URL/api/billing/seed" -H "Content-Type: application/json" -d '{}'

echo ""
echo "Done. Prices are sent directly from plans (no Stripe Price IDs needed)."
