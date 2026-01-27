# 🚀 Admin Portal Deployment & Testing Guide

## ✅ Deployment Status

**Infrastructure**: ✅ DEPLOYED  
**Stack Status**: `UPDATE_COMPLETE`  
**API URL**: `https://goskwzjzjg.execute-api.us-east-1.amazonaws.com/`  
**Lambda Environment Variables**: ✅ SET

## 📋 Step-by-Step Setup

### Step 1: Set Amplify Environment Variables

**In AWS Amplify Console:**

1. Go to: https://console.aws.amazon.com/amplify
2. Select your **GetTrainMate** app
3. Click **Environment variables** (left sidebar)
4. Add/Update these variables:

```
VITE_ADMIN_ALLOWLIST=mykantor@bellsouth.net
VITE_API_URL=https://goskwzjzjg.execute-api.us-east-1.amazonaws.com/
```

5. Click **Save**
6. Go to **App settings** → **Build settings**
7. Click **Redeploy this version** or push a new commit to trigger build

### Step 2: Verify SES Setup (For Email Features)

**In AWS SES Console:**

1. Go to: https://console.aws.amazon.com/ses/home?region=us-east-1
2. Click **Verified identities**
3. Click **Create identity**
4. Choose **Email address**
5. Enter: `noreply@gettrainmate.com` (or your verified domain)
6. Click **Create identity**
7. Check your email and verify
8. If in sandbox, click **Request production access**

### Step 3: Test Admin Access

#### Option A: Test API Endpoint

```bash
# Get your ID token (replace PASSWORD with your actual password)
TOKEN=$(aws cognito-idp initiate-auth \
  --auth-flow USER_PASSWORD_AUTH \
  --client-id 7phu8vk1o9s4nmmqofvcfmbntq \
  --auth-parameters USERNAME=mykantor@bellsouth.net,PASSWORD=YOUR_PASSWORD \
  --query 'AuthenticationResult.IdToken' \
  --output text)

# Test admin endpoint
curl -H "Authorization: Bearer $TOKEN" \
  https://goskwzjzjg.execute-api.us-east-1.amazonaws.com/api/admin/me

# Expected response:
# {
#   "sub": "...",
#   "cognitoUsername": "...",
#   "email": "mykantor@bellsouth.net"
# }
```

#### Option B: Use Test Script

```bash
cd /Users/maxkantor/Desktop/GetTrainMate
./scripts/test-admin-access.sh
```

#### Option C: Test in Browser

1. Go to your Amplify app URL: `https://your-app-id.amplifyapp.com`
2. Login as `mykantor@bellsouth.net`
3. Navigate to: `https://your-app-id.amplifyapp.com/admin`
4. Should see admin portal with sidebar navigation

### Step 4: Test All Features

#### ✅ Dashboard
- Navigate to `/admin/dashboard`
- Should see metrics cards (may show 0s until data exists)

#### ✅ Users CRM
- Navigate to `/admin/users`
- Should see users table
- Test search, filter, ban/unban actions

#### ✅ Devices & Tokens
- Navigate to `/admin/devices`
- Enter a user ID
- Click "Load Devices"
- Test "Merge Wallets by Stripe Email" button

#### ✅ Contacts CRM
- Navigate to `/admin/contacts`
- View contacts list
- Click "View" on a contact
- Test "Send Email" button (after SES setup)

#### ✅ Other Pages
- `/admin/chats` - Chat moderation
- `/admin/events` - Events CRM
- `/admin/tickets` - Support tickets
- `/admin/stripe` - Subscriptions
- `/admin/audit` - Audit logs

## 🔍 Verification Checklist

### Backend Verification

- [x] CDK stack deployed successfully
- [x] Lambda function created
- [x] API Gateway created
- [x] DynamoDB tables created
- [x] Lambda environment variables set
- [ ] Test `/api/admin/me` returns 200 for admin user
- [ ] Test `/api/admin/me` returns 403 for non-admin user

### Frontend Verification

- [ ] Amplify environment variables set
- [ ] Amplify build completed successfully
- [ ] `/admin` route loads for admin user
- [ ] `/admin` route redirects for non-admin user
- [ ] All admin pages load without errors

### Feature Verification

- [ ] Dashboard shows metrics
- [ ] Users page loads and filters work
- [ ] Devices page loads
- [ ] Wallet merge functionality works
- [ ] Contacts page loads
- [ ] Email sending works (after SES verification)

## 🐛 Troubleshooting

### Issue: 403 Forbidden on Admin Endpoints

**Check:**
1. `ADMIN_ALLOWLIST` is set in Lambda: `mykantor@bellsouth.net`
2. Your email matches exactly (case-insensitive)
3. JWT token is valid and not expired

**Fix:**
```bash
# Verify Lambda env var
aws lambda get-function-configuration \
  --function-name GetTrainMateStack-ApiFunctionCE271BD4-nktpjXfuOe0u \
  --query 'Environment.Variables.ADMIN_ALLOWLIST'
```

### Issue: Frontend Redirects from /admin

**Check:**
1. `VITE_ADMIN_ALLOWLIST` is set in Amplify
2. User is logged in
3. User's email is in allowlist

**Fix:**
- Set `VITE_ADMIN_ALLOWLIST=mykantor@bellsouth.net` in Amplify
- Trigger new build

### Issue: Email Sending Fails

**Check:**
1. SES sender email is verified
2. `SES_FROM_EMAIL` is set in Lambda
3. Not in SES sandbox (or recipient is verified)

**Fix:**
- Verify email in SES console
- Request production access if needed

### Issue: API Returns 500 Errors

**Check:**
1. Lambda function logs in CloudWatch
2. DynamoDB tables exist
3. IAM permissions are correct

**Fix:**
```bash
# Check Lambda logs
aws logs tail /aws/lambda/GetTrainMateStack-ApiFunctionCE271BD4-nktpjXfuOe0u --follow
```

## 📊 Current Configuration

**API Gateway URL**: `https://goskwzjzjg.execute-api.us-east-1.amazonaws.com/`  
**Lambda Function**: `GetTrainMateStack-ApiFunctionCE271BD4-nktpjXfuOe0u`  
**Region**: `us-east-1`  
**Admin Email**: `mykantor@bellsouth.net`

## 🎯 Quick Test Commands

```bash
# 1. Test admin endpoint
TOKEN=$(aws cognito-idp initiate-auth \
  --auth-flow USER_PASSWORD_AUTH \
  --client-id 7phu8vk1o9s4nmmqofvcfmbntq \
  --auth-parameters USERNAME=mykantor@bellsouth.net,PASSWORD=YOUR_PASSWORD \
  --query 'AuthenticationResult.IdToken' \
  --output text)

curl -H "Authorization: Bearer $TOKEN" \
  https://goskwzjzjg.execute-api.us-east-1.amazonaws.com/api/admin/me

# 2. Test non-admin (should return 403)
# Use token from different user not in allowlist

# 3. Test users endpoint
curl -H "Authorization: Bearer $TOKEN" \
  https://goskwzjzjg.execute-api.us-east-1.amazonaws.com/api/admin/users

# 4. Test metrics endpoint
curl -H "Authorization: Bearer $TOKEN" \
  https://goskwzjzjg.execute-api.us-east-1.amazonaws.com/api/admin/metrics
```

## ✅ Deployment Complete!

Your admin portal is deployed and ready to use. Set the Amplify environment variables and start testing!

---

**Last Updated**: January 27, 2026  
**Status**: ✅ **READY FOR TESTING**
