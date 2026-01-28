# Fix Amplify SPA Routing - Manual Steps Required

## Problem
The `customRedirects` in `amplify.yml` may not be automatically applied. You need to manually configure redirects in the Amplify Console.

## Solution: Manual Configuration in Amplify Console

### Step 1: Go to Amplify Console
1. Open AWS Console → Amplify
2. Select your app: `GetTrainMate`
3. Go to **App settings** → **Rewrites and redirects**

### Step 2: Add Redirects
Click **Add rewrite/redirect** and add these rules (in order):

**Rule 1:**
- Source address: `/app/<*>`
- Target address: `/index.html`
- Type: **200 (Rewrite)**
- Country code: (leave empty)

**Rule 2:**
- Source address: `/app/<*>/`
- Target address: `/index.html`
- Type: **200 (Rewrite)**
- Country code: (leave empty)

**Rule 3:**
- Source address: `/admin/<*>`
- Target address: `/index.html`
- Type: **200 (Rewrite)**
- Country code: (leave empty)

**Rule 4:**
- Source address: `/admin/<*>/`
- Target address: `/index.html`
- Type: **200 (Rewrite)**
- Country code: (leave empty)

**Rule 5:**
- Source address: `/<*>`
- Target address: `/index.html`
- Type: **200 (Rewrite)**
- Country code: (leave empty)
- Condition: **404 (Not Found)**

### Step 3: Save and Wait
- Click **Save**
- Wait for the deployment to complete (usually 1-2 minutes)
- Refresh your browser

## Why This Is Needed

Amplify's `customRedirects` in `amplify.yml` should work, but sometimes they need to be manually configured in the console, especially for existing apps.

The redirects tell Amplify:
- When someone visits `/app/discover`, serve `/index.html` (not try to find a file)
- React Router will then handle the routing on the client side
- This is essential for SPAs (Single Page Applications)

## Verification

After adding the redirects:
1. Visit `/app/discover` - should load the React app
2. Visit `/app/matches` - should load the React app
3. Visit `/app/chat` - should load the React app
4. Visit `/app/events` - should load the React app

All should work without "Page not found" errors.
