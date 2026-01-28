# 🎯 How to Use GetTrainMate - Simple Guide

## 🔍 Discovery vs Dashboard - They're the Same!

**Dashboard = Discover = The main feed**
- Both `/app/dashboard` and `/app/discover` go to the same page
- This is where you **see profiles** and **swipe/like** to find matches
- Think of it like Tinder/Bumble for training partners!

## 📋 Step-by-Step Instructions

### ✅ Step 1: Complete Your Profile

1. Click your **avatar** (top right, shows "M mkantor")
2. Click **Profile**
3. Fill in:
   - **Name** and **City** (required)
   - **Bio**: Write about yourself
   - **Sports**: Select all sports you like (can pick multiple)
   - **Level**: Your skill level
   - **Goals**: What you want to achieve
   - **Schedule**: When you're available
   - **Mode**: TRAIN (serious), VIBE (casual), or DATE
   - **Photos**: Upload at least 1 photo
4. Click **Save Profile**

### ✅ Step 2: Create Test Users (So You Can See Profiles)

Since you're the only user, you need to create dummy users to see in Discovery:

**Quick Method:**

1. **Log in as admin**:
   - Go to: `https://main.d3tocp1533tn5q.amplifyapp.com/admin/login`
   - Use your admin email and password

2. **Get your admin token**:
   - After logging in, press **F12** (open DevTools)
   - Go to: **Application** → **Local Storage** → your domain
   - Find and copy the `adminToken` value

3. **Run the seed script**:
   ```bash
   cd /Users/maxkantor/Desktop/GetTrainMate
   ADMIN_TOKEN=paste-your-token-here ./scripts/seed-users-simple.sh
   ```

This creates 8 test users you can see and interact with!

### ✅ Step 3: Start Discovering!

1. Go to **Dashboard** (click "Dashboard" in the top nav)
2. You'll see profiles of the dummy users
3. For each profile:
   - Click **Like** (👍) if interested
   - Click **Pass** (👎) if not interested
4. Keep swiping to see more!

### ✅ Step 4: Check Your Matches

1. Click **Match** tab
2. See all users who liked you back
3. Click **Start Chat** on any match

### ✅ Step 5: Start Chatting

1. Click **Chat** tab
2. Select a conversation
3. Send messages to plan training sessions!

### ✅ Step 6: Create or Join Events

1. Click **Events** tab
2. Click **Create Event** to organize group activities
3. Or browse and **Join** existing events

## 🎮 What Each Tab Does

| Tab | What It Does |
|-----|-------------|
| **Dashboard** | See profiles → Like/Pass → Find matches |
| **Match** | View all your mutual matches |
| **Chat** | Message your matches |
| **Events** | Create or join group training events |

## 💡 Pro Tips

1. **Complete profiles get more matches**: Add photos, detailed bio, multiple sports
2. **Be active**: Like profiles regularly
3. **Use Events**: Great way to meet multiple people
4. **Be specific**: Detailed bios help find better matches

## ❓ Troubleshooting

**Q: I don't see any profiles in Discovery?**
- You need to create test users first (see Step 2 above)
- Or wait for real users to join

**Q: How do I get my admin token?**
- Log in at `/admin/login`
- F12 → Application → Local Storage → copy `adminToken`

**Q: The seed script fails?**
- Make sure you're logged in as admin
- Check that your email is in `ADMIN_ALLOWLIST`
- Verify the backend API is deployed

---

**Ready to start?** Complete your profile, seed some users, and start swiping! 🚀
