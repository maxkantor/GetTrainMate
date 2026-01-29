# Testing Checklist - Profile Photo Upload & Display

## Pre-Testing Setup
- [x] Lambda deployed with latest fixes
- [x] S3 CORS configured
- [x] JWT issuer validation disabled
- [x] ProfileService error handling improved

## Test 1: Profile Loading (GET /api/profile/me)
**Expected:** Should return empty profile structure if profile doesn't exist, not 500 error

### Steps:
1. Open browser DevTools Console
2. Navigate to `/onboarding/profile` or `/app/profile`
3. Check console for errors

### Expected Results:
- ✅ No 500 errors
- ✅ Profile loads successfully (even if empty)
- ✅ User ID extracted from JWT token
- ✅ Empty profile structure returned if no profile exists

### Check Logs:
```bash
aws logs tail /aws/lambda/GetTrainMateStack-ApiFunctionCE271BD4-nktpjXfuOe0u --since 2m --format short | grep -E "(GetMyProfile|userId|Error)"
```

---

## Test 2: Photo Upload URL Generation (POST /api/profile/me/photos/upload-url)
**Expected:** Should return presigned S3 upload URL

### Steps:
1. Click "CHOOSE PHOTO" button
2. Select an image file (JPG/PNG/WEBP, < 5MB)
3. Click "UPLOAD" button
4. Check console for errors

### Expected Results:
- ✅ No CORS errors
- ✅ Upload URL generated successfully
- ✅ Response contains: `{ key, uploadUrl, publicUrl }`

### Check Logs:
```bash
aws logs tail /aws/lambda/GetTrainMateStack-ApiFunctionCE271BD4-nktpjXfuOe0u --since 2m --format short | grep -E "(upload-url|GetPhotoUploadUrl)"
```

---

## Test 3: Photo Upload to S3
**Expected:** Photo should upload to S3 successfully

### Steps:
1. After upload URL is generated, photo should upload automatically
2. Check Network tab for PUT request to S3
3. Verify response is 200 OK

### Expected Results:
- ✅ PUT request to S3 succeeds
- ✅ No CORS errors
- ✅ Photo appears in S3 bucket at `profiles/{userId}/{guid}.{ext}`

### Verify in S3:
```bash
aws s3 ls s3://getrainmate-media-bucket/profiles/ --recursive | tail -5
```

---

## Test 4: Profile Update with Photo Key
**Expected:** Profile should be updated with photoKey

### Steps:
1. After upload, profile should be updated automatically
2. Check console for errors

### Expected Results:
- ✅ Profile updated successfully
- ✅ `photoKey` field populated in profile
- ✅ No 500 errors

### Check DynamoDB:
```bash
aws dynamodb get-item \
  --table-name gettrainmate-profiles \
  --key '{"userId": {"S": "YOUR_USER_ID"}}' \
  --query 'Item.photoKey'
```

---

## Test 5: Photo Display (GET /api/profile/me/photos/url)
**Expected:** Should return signed URL for photo display

### Steps:
1. Navigate to profile page
2. Photo should display automatically
3. Check Network tab for request to `/api/profile/me/photos/url`

### Expected Results:
- ✅ Signed URL generated successfully
- ✅ Photo displays in browser
- ✅ No CORS errors
- ✅ Signed URL expires after 1 hour

### Check Logs:
```bash
aws logs tail /aws/lambda/GetTrainMateStack-ApiFunctionCE271BD4-nktpjXfuOe0u --since 2m --format short | grep -E "(photos/url|GetPhotoUrl)"
```

---

## Test 6: Cross-Origin Testing
**Expected:** Should work on both Amplify domain and localhost

### Test on Amplify:
- [ ] Navigate to `https://main.d3tocp1533tn5q.amplifyapp.com/onboarding/profile`
- [ ] Upload photo
- [ ] Verify photo displays

### Test on Localhost:
- [ ] Navigate to `http://localhost:5173/onboarding/profile`
- [ ] Upload photo
- [ ] Verify photo displays

---

## Test 7: Error Scenarios

### Invalid Token:
- [ ] Remove token from localStorage
- [ ] Try to access profile
- [ ] Should get 401 Unauthorized

### Expired Token:
- [ ] Wait for token to expire (or manually expire it)
- [ ] Try to access profile
- [ ] Should get 401 Unauthorized

### Invalid Photo Key:
- [ ] Manually set invalid photoKey in profile
- [ ] Try to display photo
- [ ] Should handle gracefully (show placeholder or error)

---

## Debugging Commands

### Check Lambda Logs:
```bash
aws logs tail /aws/lambda/GetTrainMateStack-ApiFunctionCE271BD4-nktpjXfuOe0u --follow
```

### Check S3 CORS:
```bash
aws s3api get-bucket-cors --bucket getrainmate-media-bucket
```

### Check Lambda Environment:
```bash
aws lambda get-function-configuration \
  --function-name GetTrainMateStack-ApiFunctionCE271BD4-nktpjXfuOe0u \
  --query 'Environment.Variables'
```

### Test API Endpoint Directly:
```bash
# Get JWT token from browser localStorage
TOKEN="your-jwt-token-here"

# Test profile endpoint
curl -H "Authorization: Bearer $TOKEN" \
  https://goskwzjzjg.execute-api.us-east-1.amazonaws.com/api/profile/me

# Test upload URL endpoint
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"contentType": "image/jpeg"}' \
  https://goskwzjzjg.execute-api.us-east-1.amazonaws.com/api/profile/me/photos/upload-url
```

---

## Success Criteria
- ✅ No 500 errors in console
- ✅ Profile loads successfully
- ✅ Photo uploads to S3
- ✅ Photo displays correctly
- ✅ Works on Amplify domain
- ✅ Works on localhost
- ✅ CORS headers present
- ✅ Signed URLs work correctly
