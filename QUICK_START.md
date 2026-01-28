# GetTrainMate Quick Start Guide

## 🎯 What is GetTrainMate?

GetTrainMate helps you find training partners based on:
- **Sports interests** (Running, Cycling, Hyrox, Pickleball, Fishing, etc.)
- **Skill level** (Beginner to Pro)
- **Location** (City-based matching)
- **Schedule** (When you're available)
- **Goals** (What you want to achieve)

## 📍 Navigation Explained

### **Dashboard / Discover** (Same thing!)
- **Location**: Click "Dashboard" in the top navigation
- **Purpose**: This is where you **discover new people** to train with
- **How it works**: 
  - Swipe through profiles (or use Like/Pass buttons)
  - Like profiles you're interested in
  - When someone likes you back → **It's a Match!** 🎉

### **Match Tab**
- **Location**: Click "Match" in the top navigation  
- **Purpose**: Shows all your **mutual matches** (people who liked you back)
- **Action**: Click "Start Chat" to begin conversations

### **Chat Tab**
- **Location**: Click "Chat" in the top navigation
- **Purpose**: All your conversations with matched users
- **Note**: Only appears after you have matches

### **Events Tab**
- **Location**: Click "Events" in the top navigation
- **Purpose**: Browse and create group training events
- **Action**: Create events or join existing ones

## 🚀 Getting Started (Step by Step)

### Step 1: Complete Your Profile ⚙️

1. Click your **avatar** (top right) → **Profile**
2. Fill in all fields:
   - ✅ **Name** and **City** (required)
   - ✅ **Bio**: Write a short description about yourself
   - ✅ **Sports**: Select all sports you're interested in (can select multiple)
   - ✅ **Level**: Choose your skill level
   - ✅ **Goals**: What do you want to achieve?
   - ✅ **Schedule**: When are you available? (Select all that apply)
   - ✅ **Mode**: 
     - **TRAIN**: Serious fitness partners
     - **VIBE**: Casual workout buddies
     - **DATE**: Open to romantic connections
   - ✅ **Photos**: Upload at least 1 photo (more is better!)
3. Click **Save Profile**

### Step 2: Discover People 👥

1. Go to **Dashboard** (click "Dashboard" in navigation)
2. You'll see profiles of other users
3. For each profile:
   - **Like** (👍) if interested → Swipe right or click Like button
   - **Pass** (👎) if not interested → Swipe left or click Pass button
4. Keep swiping to see more profiles

### Step 3: Check Your Matches 💚

1. Click **Match** tab
2. See all users who liked you back
3. Click **Start Chat** on any match

### Step 4: Start Chatting 💬

1. Click **Chat** tab
2. Select a conversation
3. Send messages to plan training sessions!

### Step 5: Create or Join Events 📅

1. Click **Events** tab
2. **Create Event**: Click "Create Event" button
   - Fill in: Title, Description, Sport, City, Date/Time, Skill Level, Max Participants
3. **Join Event**: Browse events and click "Join"

## 🎮 Creating Test Users (For Testing)

If you want to see more profiles and test the matching system:

### Option 1: Use the Seed Script (Recommended)

```bash
# First, get your JWT token by logging in to the app
# Then run:
ADMIN_TOKEN=your-jwt-token ./scripts/create-dummy-users.sh
```

### Option 2: Manual Creation via Admin API

1. Log in as admin
2. Go to `/admin/users`
3. Create new users manually

### Option 3: Ask Others to Join

Share the app with friends and have them create profiles!

## 💡 Pro Tips

1. **Complete profiles get more matches**: Add photos, detailed bio, and multiple sports
2. **Be active**: Like profiles regularly to increase your chances
3. **Use Events**: Great way to meet multiple people at once
4. **Be specific in bio**: Helps you find better matches
5. **Upload multiple photos**: Shows different aspects of your fitness journey

## ❓ Common Questions

**Q: Why don't I see any profiles in Discovery?**
A: Either there are no other users yet, or you've already seen all available profiles. Create test users or wait for more people to join.

**Q: What's the difference between Dashboard and Discover?**
A: They're the same! Both routes go to the discovery feed.

**Q: How do I get matches?**
A: Like profiles you're interested in. When they like you back, it's a match!

**Q: Can I change my profile later?**
A: Yes! Go to Profile and update any field, then click Save.

**Q: How do I delete my account?**
A: Contact support or use the admin panel if you have access.

---

**Need Help?** Check the FAQ page or contact support through the Contact page.
