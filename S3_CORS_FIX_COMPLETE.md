# S3 CORS Fix - Implementation Complete ✅

## Summary
Fixed S3 CORS configuration and implemented signed URLs for profile photo display to resolve CORS errors.

## Changes Made

### 1. S3 CORS Configuration (CDK)
**File:** `infra/stacks/main-stack.ts`

- Added `addS3CorsConfiguration()` method
- Created custom resource Lambda (Python) to configure CORS on existing bucket
- CORS allows:
  - Origins: `https://main.d3tocp1533tn5q.amplifyapp.com`, `http://localhost:3000`, `http://localhost:5173`, `http://localhost:5174`
  - Methods: `GET`, `PUT`, `POST`, `HEAD`
  - Headers: `*` (all)
  - ExposeHeaders: `ETag`
  - MaxAgeSeconds: `3000`

### 2. Backend: Signed URL Endpoint
**Files:**
- `apps/api/Services/IStorageService.cs` - Added `GetPresignedDownloadUrl()` interface
- `apps/api/Services/S3StorageService.cs` - Implemented signed URL generation
- `apps/api/Controllers/ProfileController.cs` - Added `POST /api/profile/me/photos/url` endpoint

**New Endpoint:**
```
POST /api/profile/me/photos/url
Body: { "key": "profiles/userId/photo.jpg" }
Response: { "url": "https://bucket.s3.amazonaws.com/...?signature=..." }
```

### 3. Frontend: Use Signed URLs
**Files:**
- `apps/web/src/services/profileService.ts` - Added `getPhotoUrl()` method
- `apps/web/src/pages/app/Profile.tsx` - Updated to use signed URLs
- `apps/web/src/pages/onboarding/ProfileOnboarding.tsx` - Updated to use signed URLs

## Deployment Status

### ✅ Lambda Zip Built
- **Location:** `deploy/gettrainmate-api-lambda.zip`
- **Size:** 4.1 MB (under 50 MB limit)
- **Status:** Ready for deployment

### ✅ CDK Stack Deployed
- S3 CORS configuration custom resource created
- CORS rules applied to `getrainmate-media-bucket`

## Testing Checklist

### Upload Test
- [ ] Upload profile photo via onboarding flow
- [ ] Verify upload succeeds without CORS errors
- [ ] Check photo appears in profile preview

### Display Test
- [ ] View profile page with uploaded photo
- [ ] Verify photo displays without CORS errors
- [ ] Check signed URL is generated correctly
- [ ] Verify signed URL expires after 1 hour

### Cross-Origin Test
- [ ] Test on Amplify domain (`main.d3tocp1533tn5q.amplifyapp.com`)
- [ ] Test on localhost (`http://localhost:5173` or `http://localhost:3000`)
- [ ] Verify CORS headers present in browser DevTools

## How It Works

### Before Fix
- Frontend tried to fetch `https://bucket.s3.amazonaws.com/photo.jpg` directly
- Browser blocked request due to missing CORS headers

### After Fix
1. **Upload:** Frontend gets presigned PUT URL → uploads directly to S3 (CORS allows PUT)
2. **Display:** Frontend calls `/api/profile/me/photos/url` → gets signed GET URL → displays image (no CORS issues)

## Deployment Commands

### Update Lambda Function
```bash
# Direct upload (recommended - zip is under 50MB)
aws lambda update-function-code \
  --function-name GetTrainMateStack-ApiFunctionCE271BD4-nktpjXfuOe0u \
  --zip-file fileb://deploy/gettrainmate-api-lambda.zip

# Update runtime to .NET 8
aws lambda update-function-configuration \
  --function-name GetTrainMateStack-ApiFunctionCE271BD4-nktpjXfuOe0u \
  --runtime dotnet8 \
  --handler GetTrainMate.Api::GetTrainMate.Api.LambdaEntryPoint::FunctionHandlerAsync
```

### Verify S3 CORS Configuration
```bash
aws s3api get-bucket-cors --bucket getrainmate-media-bucket
```

## Files Changed
1. `infra/stacks/main-stack.ts` - Added S3 CORS custom resource
2. `apps/api/Services/IStorageService.cs` - Added interface method
3. `apps/api/Services/S3StorageService.cs` - Implemented signed URL generation
4. `apps/api/Controllers/ProfileController.cs` - Added photo URL endpoint
5. `apps/web/src/services/profileService.ts` - Added `getPhotoUrl()` method
6. `apps/web/src/pages/app/Profile.tsx` - Use signed URLs for display
7. `apps/web/src/pages/onboarding/ProfileOnboarding.tsx` - Use signed URLs for preview

## Next Steps
1. ✅ CDK stack deployed (CORS configured)
2. ⏳ Deploy Lambda zip with new endpoint
3. ⏳ Test photo upload and display
4. ⏳ Verify CORS headers in browser DevTools
