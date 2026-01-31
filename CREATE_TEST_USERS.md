# How to Create Test Users

## Quick Answer: Discovery vs Dashboard

**They're the same thing!** 
- **Dashboard** = **Discover** = The main feed where you see profiles
- Both routes (`/app/dashboard` and `/app/discover`) go to the same page
- This is where you swipe/like profiles to find matches

## Creating Dummy Users (3 Methods)

### Method 1: Admin API Endpoint (Easiest) ⭐

1. **Log in as admin**:
   - Go to `/admin/login`
   - Use your admin email and password

2. **Get your admin token**: After logging in at `/admin/login`, open DevTools → Application → Local Storage → copy the `adminToken` value.

3. **Run the seed script** (easiest):
   ```bash
   ADMIN_TOKEN=your-admin-token ./scripts/seed-users-via-admin.sh
   ```
   Or call the API directly:
   ```bash
   curl -X POST "https://goskwzjzjg.execute-api.us-east-1.amazonaws.com/api/admin/users/seed-dummy" \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     -H "Content-Type: application/json"
   ```

This will create 8 dummy users:
- Sarah Runner (Running, Yoga, Hiking)
- Mike Cyclist (Cycling, Gym, CrossFit)
- Emma Yoga (Yoga, Pilates)
- Alex Hyrox (Hyrox, CrossFit, Running)
- Jordan Pickleball (Pickleball, Tennis)
- Chris Fisher (Fishing, Hiking, Kayaking)
- Maria Soccer (Soccer, Running)
- David Swimmer (Swimming, Cycling, Triathlon)

### Method 2: Manual Profile Creation

1. **Create users in Cognito** (via AWS Console or CLI)
2. **Update their profiles via API**:
   ```bash
   # Get your JWT token (from app login)
   TOKEN=your-jwt-token
   
   curl -X PUT "https://goskwzjzjg.execute-api.us-east-1.amazonaws.com/api/profile/{userId}" \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "name": "Test User",
       "city": "San Francisco",
       "bio": "Test bio",
       "sportTags": ["Running", "Cycling"],
       "level": "intermediate",
       "goals": "Test goals",
       "mode": "TRAIN"
     }'
   ```

### Method 3: Use Admin Panel (Future)

Once the admin panel user creation is implemented, you can create users directly from `/admin/users`.

## What to Do After Creating Users

1. **Go to Dashboard** (`/app/discover`)
2. **You should now see the dummy user profiles**
3. **View Profile** on a card opens their full profile; you can **Like** from there too.
4. **Start swiping**:
   - Click **Like** on profiles you're interested in
   - Click **Pass** on profiles you're not interested in
5. **Check Matches** tab to see mutual likes
6. **Start Chatting** with your matches

## Free vs paid: how users communicate

- **Free:** 10 matches/day, 5 messages/day. Basic discovery and chat.
- **Paid (Pro/Elite):** Unlimited matches and messages, advanced filters, see who liked you, verified badge, and more. See **Subscription** in the app or `/app/subscription`.

## Troubleshooting

**Q: I don't see any profiles in Discovery?**
- Make sure you've created dummy users (use Method 1 above)
- Refresh the page
- Check browser console for errors

**Q: How do I get my admin token?**
1. Log in at `/admin/login`
2. Open browser DevTools (F12)
3. Go to Application → Local Storage
4. Copy the `adminToken` value

**Q: The seed endpoint returns 403?**
- Make sure you're logged in as admin
- Check that your email is in the `ADMIN_ALLOWLIST` environment variable
- Verify your admin token is valid

---

**Need more help?** Check `QUICK_START.md` for detailed app usage instructions.
