#!/bin/bash
# Seed dummy users via Admin API (POST /api/admin/users/seed-dummy)
# Creates 8 test profiles in DynamoDB so Discover shows them.

set -e

API_URL="${API_URL:-https://goskwzjzjg.execute-api.us-east-1.amazonaws.com}"

echo "🌱 Seeding dummy users via Admin API (seed-dummy)"
echo "API URL: $API_URL"
echo ""

ADMIN_TOKEN="${ADMIN_TOKEN:-}"

if [ -z "$ADMIN_TOKEN" ]; then
  echo "⚠️  ADMIN_TOKEN not set."
  echo ""
  echo "To get your admin token:"
  echo "1. Log in at https://main.d3tocp1533tn5q.amplifyapp.com/admin/login"
  echo "2. DevTools → Application → Local Storage → copy 'adminToken'"
  echo "3. Run: ADMIN_TOKEN=your-token ./scripts/seed-users-via-admin.sh"
  echo ""
  exit 1
fi

echo "Calling POST /api/admin/users/seed-dummy..."
response=$(curl -s -w "\n%{http_code}" -X POST \
  "$API_URL/api/admin/users/seed-dummy" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" 2>&1)

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

if [ "$http_code" = "200" ]; then
  echo "✅ Success"
  echo "$body" | head -c 500
  echo ""
  echo ""
  echo "💡 Go to /app/discover to see Sarah, Mike, Emma, Alex, Jordan, Chris, Maria, David."
else
  echo "❌ HTTP $http_code"
  echo "$body"
  exit 1
fi
