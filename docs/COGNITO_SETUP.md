# Cognito User Pool Configuration Guide

## Required Attributes Configuration

To ensure that `given_name` is required during signup but not during sign-in or password reset:

### 1. In AWS Cognito Console

1. Go to **AWS Cognito Console** → Your User Pool
2. Navigate to **Sign-up experience** → **Attributes**
3. Under **Required attributes**, ensure:
   - ✅ `email` is checked (required)
   - ✅ `given_name` is checked (required for signup)
   - ❌ Do NOT check `name` (we use `given_name` instead)

### 2. Attribute Settings

- **`email`**: Required, Mutable, Verified
- **`given_name`**: Required, Mutable, Not verified

### 3. Why This Works

- **During Signup**: User must provide `given_name` (enforced by Cognito)
- **During Sign-In**: No attributes required (just email/password)
- **During Password Reset**: We send a default `given_name: 'User'` value to satisfy Cognito's requirement without asking the user

### 4. Code Implementation

- **Signup**: Sends `given_name` from the name field
- **Password Reset**: Sends default `given_name: 'User'` automatically
- **Sign-In**: No attributes sent

## Alternative: Making `given_name` Optional

If you want to make `given_name` optional in Cognito:

1. Uncheck `given_name` from **Required attributes**
2. Update signup code to make name field optional
3. During password reset, you won't need to send `given_name` at all

**Note**: This means users can sign up without providing a name, which may not be desired.

## Local login: "Works on Amplify, not on localhost"

If you get **"No account found with this email"** on localhost but the same account works on the deployed Amplify app, localhost is using a **different Cognito User Pool** than Amplify.

### Fix: use the same pool as Amplify

1. **Find which pool has your user**
   - AWS Console → **Cognito** → **User pools**
   - Open each pool → **Users** → search for your email (e.g. `mykantor@bellsouth.net`)
   - Note the **User pool ID** (e.g. `us-east-1_XXXXXXXXX`) of the pool where the user exists

2. **Get the App client ID for that pool**
   - In that same User Pool → **App integration** → **App client list**
   - Copy the **Client ID** of the app client your app uses (e.g. the one named like `gettrainmate-web-client` or the one Amplify uses)

3. **Set localhost to use that pool**
   - Edit **`apps/web/.env`** and set:
     ```bash
     VITE_COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX   # from step 1
     VITE_COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxx   # from step 2
     VITE_COGNITO_REGION=us-east-1
     ```
   - Or copy **the same values** from Amplify: **Amplify Console** → your app → **Environment variables** → copy `VITE_COGNITO_USER_POOL_ID`, `VITE_COGNITO_CLIENT_ID`, `VITE_COGNITO_REGION` into `apps/web/.env`

4. **Restart the dev server**
   - Stop it (Ctrl+C), then run `npm run web:dev` again so Vite reloads `.env`

On the Login page in dev you’ll see **"Local Cognito pool: us-east-1_••••XXXX"**. That must match the pool where your user exists (and the one Amplify uses).

### 401 after login (Discover / profile / feed)

If login works but you then see **"We couldn't load your profile"** or **401** in the console when loading `/app/discover`, localhost is using a **different backend** than Amplify. The API/AppSync only accepts tokens from the User Pool they were configured with.

**Fix:** Use the **same full config as Amplify**. In **Amplify Console** → your app → **Environment variables**, copy **all** of these into `apps/web/.env`:

- `VITE_COGNITO_USER_POOL_ID`
- `VITE_COGNITO_CLIENT_ID`
- `VITE_COGNITO_REGION`
- `VITE_API_URL`
- `VITE_APPSYNC_GRAPHQL_URL` (if present)
- `VITE_APPSYNC_REGION` (if present)

Restart the dev server. Then localhost uses the same Cognito pool **and** the same API/AppSync as Amplify, so the backend will accept your token.

### 403 Forbidden

- **API calls**: Check the backend CORS configuration allows your origin (e.g. `localhost:5173`, `*.amplifyapp.com`). API Gateway and Lambda must allow `Access-Control-Allow-Origin` for the requesting domain.
- **Profile images / S3**: 403 on image URLs often means presigned URLs expired (typically 15–60 min) or the bucket policy denies access. Refresh the page to get new URLs.

### Console errors (ip-xxx, gos..., execute-api)

If you see `Failed to load resource: 403/401` in the browser console for URLs containing `ip-`, `gos`, or `execute-api`:

- **ip-xxx**: AWS internal hostnames; may be health checks or internal calls. Usually benign.
- **gos... / execute-api**: Your API Gateway domain. 401 = token invalid/expired or wrong User Pool (see "401 after login" above). 403 = CORS or backend authorization. Ensure `VITE_API_URL` matches the deployed API and env vars align with Amplify.

## Current Implementation

The current code:
- ✅ Requires name during signup (sends as `given_name`)
- ✅ Doesn't require name during sign-in
- ✅ Sends default `given_name: 'User'` during password reset (satisfies Cognito requirement without user input)
