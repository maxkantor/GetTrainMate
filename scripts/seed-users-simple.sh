#!/bin/bash
# Simple script to seed dummy users via Admin API
# This is the easiest way to create test users

set -e

API_URL="${API_URL:-https://goskwzjzjg.execute-api.us-east-1.amazonaws.com}"

echo "🌱 GetTrainMate - Seed Dummy Users"
echo "===================================="
echo ""
echo "This script creates 8 test users so you can see profiles in Discovery."
echo ""

# Check for admin token
if [ -z "$ADMIN_TOKEN" ]; then
  echo "⚠️  ADMIN_TOKEN not set."
  echo ""
  echo "To get your admin token:"
  echo "1. Go to: https://main.d3tocp1533tn5q.amplifyapp.com/admin/login"
  echo "2. Log in with your admin credentials"
  echo "3. Open browser DevTools (F12)"
  echo "4. Go to: Application → Local Storage → your domain"
  echo "5. Copy the 'adminToken' value"
  echo ""
  echo "Then run:"
  echo "  ADMIN_TOKEN=your-token-here ./scripts/seed-users-simple.sh"
  echo ""
  exit 1
fi

echo "Creating dummy users..."
echo ""

response=$(curl -s -w "\n%{http_code}" -X POST \
  "$API_URL/api/admin/users/seed-dummy" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json")

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

if [ "$http_code" = "200" ]; then
  echo "✅ Success! Dummy users created."
  echo ""
  echo "$body" | grep -o '"message":"[^"]*' | cut -d'"' -f4 || echo "Check response above"
  echo ""
  echo "🎉 You can now see these users in the Discovery feed!"
  echo "   Go to: https://main.d3tocp1533tn5q.amplifyapp.com/app/discover"
else
  echo "❌ Failed to create users (HTTP $http_code)"
  echo ""
  echo "Response:"
  echo "$body"
  echo ""
  echo "Common issues:"
  echo "- Invalid or expired admin token"
  echo "- Not logged in as admin"
  echo "- Backend API not deployed"
fi
