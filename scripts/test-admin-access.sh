#!/bin/bash

# Script to test admin access

set -e

API_URL=$(aws cloudformation describe-stacks \
  --stack-name GetTrainMateStack \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
  --output text)

USER_POOL_ID="us-east-1_MRv5xL2l5"
CLIENT_ID="7phu8vk1o9s4nmmqofvcfmbntq"
EMAIL="mykantor@bellsouth.net"

echo "Testing Admin Access"
echo "==================="
echo ""
echo "API URL: $API_URL"
echo "Email: $EMAIL"
echo ""

# Get ID token
echo "Getting ID token from Cognito..."
read -sp "Enter password for $EMAIL: " PASSWORD
echo ""

TOKEN=$(aws cognito-idp initiate-auth \
  --auth-flow USER_PASSWORD_AUTH \
  --client-id "$CLIENT_ID" \
  --auth-parameters USERNAME="$EMAIL",PASSWORD="$PASSWORD" \
  --query 'AuthenticationResult.IdToken' \
  --output text 2>&1)

if [ $? -ne 0 ] || [ -z "$TOKEN" ]; then
  echo "❌ Failed to get token. Please check your credentials."
  exit 1
fi

echo "✅ Token obtained"
echo ""

# Test admin endpoint
echo "Testing /api/admin/me endpoint..."
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -H "Authorization: Bearer $TOKEN" \
  "$API_URL/api/admin/me")

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')

echo "HTTP Status: $HTTP_STATUS"
echo "Response:"
echo "$BODY" | jq . 2>/dev/null || echo "$BODY"
echo ""

if [ "$HTTP_STATUS" = "200" ]; then
  echo "✅ Admin access verified!"
  echo ""
  echo "You can now:"
  echo "1. Navigate to your Amplify app URL + /admin"
  echo "2. Test all admin features"
else
  echo "❌ Admin access denied (Status: $HTTP_STATUS)"
  echo ""
  echo "Check:"
  echo "1. ADMIN_ALLOWLIST is set in Lambda: mykantor@bellsouth.net"
  echo "2. Your email matches the allowlist"
  echo "3. JWT token is valid"
fi
