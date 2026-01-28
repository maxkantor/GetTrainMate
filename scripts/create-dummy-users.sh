#!/bin/bash
# Create Dummy Users Script
# This script creates test users via the API for development/testing

set -e

API_URL="${API_URL:-https://goskwzjzjg.execute-api.us-east-1.amazonaws.com}"

echo "🌱 Creating Dummy Users for GetTrainMate"
echo "API URL: $API_URL"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we have an admin token or user token
# For now, we'll create profiles directly (they'll need to be created via Cognito first)
# This script assumes profiles can be created/updated via the profile API

echo "⚠️  Note: This script creates profile data for existing Cognito users."
echo "   To fully seed users, you need to:"
echo "   1. Create users in Cognito (via AWS Console or CLI)"
echo "   2. Then run this script to populate their profiles"
echo ""

# Dummy users data
declare -a USERS=(
  '{"userId":"dummy-user-1","name":"Sarah Runner","city":"San Francisco","bio":"Marathon runner looking for training partners","sportTags":["Running","Yoga","Hiking"],"level":"intermediate","goals":"Complete a sub-4 hour marathon","mode":"TRAIN","isComplete":true}'
  '{"userId":"dummy-user-2","name":"Mike Cyclist","city":"San Francisco","bio":"Cycling enthusiast looking for weekend ride buddies","sportTags":["Cycling","Gym","CrossFit"],"level":"advanced","goals":"Complete a century ride","mode":"VIBE","isComplete":true}'
  '{"userId":"dummy-user-3","name":"Emma Yoga","city":"San Francisco","bio":"Yoga instructor and fitness enthusiast","sportTags":["Yoga","Pilates"],"level":"pro","goals":"Build a yoga community","mode":"VIBE","isComplete":true}'
  '{"userId":"dummy-user-4","name":"Alex Hyrox","city":"San Francisco","bio":"Hyrox competitor training for next race","sportTags":["Hyrox","CrossFit","Running"],"level":"advanced","goals":"Qualify for Hyrox World Championships","mode":"TRAIN","isComplete":true}'
  '{"userId":"dummy-user-5","name":"Jordan Pickleball","city":"San Francisco","bio":"Pickleball player looking for doubles partners","sportTags":["Pickleball","Tennis"],"level":"intermediate","goals":"Improve tournament ranking","mode":"VIBE","isComplete":true}'
  '{"userId":"dummy-user-6","name":"Chris Fisher","city":"San Francisco","bio":"Fishing enthusiast. Love early morning fishing trips","sportTags":["Fishing","Hiking","Kayaking"],"level":"beginner","goals":"Learn new fishing techniques","mode":"VIBE","isComplete":true}'
)

echo "Creating ${#USERS[@]} dummy user profiles..."
echo ""

# You'll need a valid JWT token to create profiles
# For now, this is a template - you'll need to authenticate first
TOKEN="${ADMIN_TOKEN:-}"

if [ -z "$TOKEN" ]; then
  echo -e "${YELLOW}⚠️  No token provided.${NC}"
  echo "   To use this script, you need to:"
  echo "   1. Log in to the app and get your JWT token"
  echo "   2. Set ADMIN_TOKEN environment variable"
  echo "   3. Or modify the backend to allow public seeding in dev mode"
  echo ""
  echo "   Example:"
  echo "   ADMIN_TOKEN=your-jwt-token ./scripts/create-dummy-users.sh"
  echo ""
  exit 1
fi

success=0
failed=0

for user_data in "${USERS[@]}"; do
  user_id=$(echo "$user_data" | grep -o '"userId":"[^"]*' | cut -d'"' -f4)
  user_name=$(echo "$user_data" | grep -o '"name":"[^"]*' | cut -d'"' -f4)
  
  echo -n "Creating $user_name... "
  
  response=$(curl -s -w "\n%{http_code}" -X PUT \
    "$API_URL/api/profile/$user_id" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "$user_data")
  
  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')
  
  if [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
    echo -e "${GREEN}✅${NC}"
    ((success++))
  else
    echo -e "${RED}❌ (HTTP $http_code)${NC}"
    echo "   Response: $body"
    ((failed++))
  fi
  
  sleep 0.5
done

echo ""
echo -e "${GREEN}✅ Successfully created: $success users${NC}"
if [ $failed -gt 0 ]; then
  echo -e "${RED}❌ Failed to create: $failed users${NC}"
fi
echo ""
echo "🎉 Done! Check the Discovery feed to see these users."
