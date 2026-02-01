#!/usr/bin/env bash
# Seed billing plans via Admin API.
# Requires: ADMIN_TOKEN from admin login, API_URL
# Usage: ADMIN_TOKEN=xxx API_URL=https://xxx ./scripts/seed-billing-plans.sh

set -e
API_URL="${API_URL:-https://goskwzjzjg.execute-api.us-east-1.amazonaws.com}"
if [ -z "$ADMIN_TOKEN" ]; then
  echo "Get ADMIN_TOKEN via: curl -X POST $API_URL/api/admin/login -H 'Content-Type: application/json' -d '{\"email\":\"your@email\",\"password\":\"xxx\"}'"
  exit 1
fi

echo "Seeding billing plans..."
curl -s -X POST "$API_URL/api/admin/billing/plans/seed" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'

echo ""
echo "Done. Configure Stripe Price IDs for Pro and Elite in Admin CRM → Billing Plans."
