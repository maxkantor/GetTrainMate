# 🚀 GetTrainMate Quick Start

## ✅ You're Logged In - What's Next?

### Step 1: Understand the Navigation

**Dashboard / Discover** (Same thing!)
- This is where you **discover new people** to train with
- Swipe through profiles and like/pass
- When someone likes you back → **It's a Match!** 🎉

**Match Tab**
- Shows all your **mutual matches**
- Click "Start Chat" to begin conversations

**Chat Tab**
- All your conversations with matched users
- Only appears after you have matches

**Events Tab**
- Browse and create group training events

### Step 2: Complete Your Profile

1. Click your **avatar** (top right) → **Profile**
2. Fill in:
   - ✅ Name, City, Bio
   - ✅ Sports (select multiple)
   - ✅ Level, Goals, Schedule
   - ✅ Upload at least 1 photo
3. Click **Save Profile**

### Step 3: Create Test Users (So You Can See Profiles)

**Easiest Method:**

1. **Get your admin token**:
   - Go to `/admin/login` and log in
   - Open DevTools (F12) → Application → Local Storage
   - Copy the `adminToken` value

2. **Run the seed script**:
   ```bash
   ADMIN_TOKEN=your-token-here ./scripts/seed-users-simple.sh
   ```

This creates 8 test users:
- Sarah Runner (Running, Yoga, Hiking)
- Mike Cyclist (Cycling, Gym, CrossFit)
- Emma Yoga (Yoga, Pilates)
- Alex Hyrox (Hyrox, CrossFit, Running)
- Jordan Pickleball (Pickleball, Tennis)
- Chris Fisher (Fishing, Hiking, Kayaking)
- Maria Soccer (Soccer, Running)
- David Swimmer (Swimming, Cycling, Triathlon)

### Step 4: Start Discovering!

1. Go to **Dashboard** (`/app/discover`)
2. You'll now see the dummy user profiles
3. **Like** profiles you're interested in
4. **Pass** on profiles you're not interested in
5. Check **Match** tab for mutual likes
6. **Start Chatting** with your matches!

## 📚 More Help

- **Full Guide**: See `QUICK_START.md` for detailed instructions
- **User Guide**: See `USER_GUIDE.md` for comprehensive documentation
- **Create Users**: See `CREATE_TEST_USERS.md` for all methods

---

**Need help?** Check the FAQ page or contact support.
