#!/bin/bash
# Seed Users via Admin API
# Creates dummy users using the admin API endpoints

set -e

API_URL="${API_URL:-https://goskwzjzjg.execute-api.us-east-1.amazonaws.com}"

echo "🌱 Seeding Dummy Users via Admin API"
echo "API URL: $API_URL"
echo ""

# You need to be logged in as admin and have the admin token
ADMIN_TOKEN="${ADMIN_TOKEN:-}"

if [ -z "$ADMIN_TOKEN" ]; then
  echo "⚠️  ADMIN_TOKEN not set."
  echo ""
  echo "To get your admin token:"
  echo "1. Log in to the app at /admin/login"
  echo "2. Open browser DevTools → Application → Local Storage"
  echo "3. Copy the 'adminToken' value"
  echo "4. Run: ADMIN_TOKEN=your-token ./scripts/seed-users-via-admin.sh"
  echo ""
  exit 1
fi

# Create users via admin API
# Note: This assumes the admin API has endpoints to create users
# You may need to adjust based on your actual API structure

echo "Creating dummy users..."
echo ""

# User data
users=(
  '{"email":"sarah.runner@test.com","name":"Sarah Runner","city":"San Francisco","bio":"Marathon runner looking for training partners","sportTags":["Running","Yoga","Hiking"],"level":"intermediate","goals":"Complete a sub-4 hour marathon","mode":"TRAIN"}'
  '{"email":"mike.cyclist@test.com","name":"Mike Cyclist","city":"San Francisco","bio":"Cycling enthusiast","sportTags":["Cycling","Gym","CrossFit"],"level":"advanced","goals":"Complete a century ride","mode":"VIBE"}'
  '{"email":"emma.yoga@test.com","name":"Emma Yoga","city":"San Francisco","bio":"Yoga instructor","sportTags":["Yoga","Pilates"],"level":"pro","goals":"Build a yoga community","mode":"VIBE"}'
  '{"email":"alex.hyrox@test.com","name":"Alex Hyrox","city":"San Francisco","bio":"Hyrox competitor","sportTags":["Hyrox","CrossFit","Running"],"level":"advanced","goals":"Qualify for Hyrox World Championships","mode":"TRAIN"}'
  '{"email":"jordan.pickleball@test.com","name":"Jordan Pickleball","city":"San Francisco","bio":"Pickleball player","sportTags":["Pickleball","Tennis"],"level":"intermediate","goals":"Improve tournament ranking","mode":"VIBE"}'
  '{"email":"chris.fisher@test.com","name":"Chris Fisher","city":"San Francisco","bio":"Fishing enthusiast","sportTags":["Fishing","Hiking","Kayaking"],"level":"beginner","goals":"Learn new fishing techniques","mode":"VIBE"}'
)

success=0
failed=0

for user_json in "${users[@]}"; do
  name=$(echo "$user_json" | grep -o '"name":"[^"]*' | cut -d'"' -f4)
  echo -n "Creating $name... "
  
  # Try to create via admin API
  # Adjust endpoint based on your actual API structure
  response=$(curl -s -w "\n%{http_code}" -X POST \
    "$API_URL/api/admin/users" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -d "$user_json" 2>&1)
  
  http_code=$(echo "$response" | tail -n1)
  
  if [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
    echo "✅"
    ((success++))
  else
    echo "❌ (HTTP $http_code)"
    echo "$response" | head -n-1
    ((failed++))
  fi
  
  sleep 0.5
done

echo ""
echo "✅ Successfully created: $success users"
if [ $failed -gt 0 ]; then
  echo "❌ Failed to create: $failed users"
fi
echo ""
echo "💡 Note: These users need to be created in Cognito first."
echo "   Then their profiles can be populated via the API."
