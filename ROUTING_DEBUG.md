# Routing Debug Guide

## Current Issue
User seeing "Page not found" on `/app/discover/` (with trailing slash)

## What's Configured

### 1. Router.tsx
- Routes are nested correctly: `<Route path="/app" element={<ProtectedRoute />}>`
- Child routes use relative paths: `<Route path="discover" element={<DiscoverPage />} />`
- Index route added: `<Route index element={<DiscoverPage />} />`

### 2. Amplify Redirects
- `customRedirects` in `amplify.yml`:
  - `/app/<*>` → `/index.html` (200)
  - `/admin/<*>` → `/index.html` (200)
  - `/<*>` → `/index.html` (200)

### 3. ProtectedRoute
- Checks `isAuthenticated`
- If not authenticated → redirects to `/login`
- If authenticated → renders `<Outlet />`

## Possible Issues

1. **Trailing Slash**: URL is `/app/discover/` but route is `/app/discover`
   - Solution: Add route with trailing slash OR normalize URLs

2. **Authentication**: User might not be authenticated
   - Check: Browser console for auth errors
   - Check: Network tab for redirects to `/login`

3. **Amplify Redirects Not Applied**: 
   - Check: Amplify console → App settings → Rewrites and redirects
   - May need to manually add redirects in Amplify console

4. **Build Not Complete**: 
   - Wait for Amplify build to finish
   - Check Amplify console for build status

## Debug Steps

1. Open browser console
2. Check Network tab when navigating to `/app/discover`
3. Look for:
   - 404 errors
   - Redirects to `/login`
   - Authentication errors
4. Check if `isAuthenticated` is `true` in React DevTools

## Manual Fix in Amplify Console

If redirects aren't working, manually add in Amplify Console:

1. Go to Amplify Console → Your App → Rewrites and redirects
2. Add:
   - Source: `/app/<*>`
   - Target: `/index.html`
   - Type: 200 (Rewrite)
   - Country code: (leave empty)
