# Deployment Complete ✅

## Lambda Deployment Status

### Function Updated
- **Function Name:** `GetTrainMateStack-ApiFunctionCE271BD4-nktpjXfuOe0u`
- **Runtime:** `.NET 8`
- **Handler:** `GetTrainMate.Api::GetTrainMate.Api.LambdaEntryPoint::FunctionHandlerAsync`
- **Package:** `deploy/gettrainmate-api-lambda.zip` (4.1 MB)

### New Features Deployed
1. ✅ S3 CORS configuration (via CDK custom resource)
2. ✅ Photo signed URL endpoint (`POST /api/profile/me/photos/url`)
3. ✅ Updated frontend to use signed URLs for photo display

## Testing Instructions

### 1. Test Photo Upload
1. Navigate to `/onboarding/profile` or `/app/profile`
2. Click "CHOOSE PHOTO" and select an image
3. Click "UPLOAD"
4. Verify upload succeeds without CORS errors
5. Check browser console for any errors

### 2. Test Photo Display
1. After uploading, verify photo appears in preview
2. Navigate to profile page
3. Verify photo displays correctly
4. Check browser DevTools Network tab:
   - Should see request to `/api/profile/me/photos/url`
   - Response should contain signed URL
   - Image should load without CORS errors

### 3. Verify CORS Configuration
Open browser DevTools Console and run:
```javascript
fetch('https://getrainmate-media-bucket.s3.amazonaws.com/profiles/test.jpg', {
  method: 'HEAD',
  mode: 'cors'
}).then(r => {
  console.log('CORS Headers:', {
    'Access-Control-Allow-Origin': r.headers.get('Access-Control-Allow-Origin'),
    'Access-Control-Allow-Methods': r.headers.get('Access-Control-Allow-Methods')
  });
});
```

### 4. Test on Different Origins
- ✅ Amplify domain: `https://main.d3tocp1533tn5q.amplifyapp.com`
- ✅ Localhost: `http://localhost:5173` or `http://localhost:3000`

## API Endpoints

### Get Photo Signed URL
```
POST /api/profile/me/photos/url
Authorization: Bearer <token>
Content-Type: application/json

Body:
{
  "key": "profiles/userId/photo.jpg"
}

Response:
{
  "url": "https://getrainmate-media-bucket.s3.amazonaws.com/profiles/userId/photo.jpg?X-Amz-Algorithm=..."
}
```

### Upload Photo (Presigned URL)
```
POST /api/profile/me/photos/upload-url
Authorization: Bearer <token>
Content-Type: application/json

Body:
{
  "contentType": "image/jpeg"
}

Response:
{
  "key": "profiles/userId/guid.jpg",
  "uploadUrl": "https://getrainmate-media-bucket.s3.amazonaws.com/...",
  "publicUrl": "https://getrainmate-media-bucket.s3.amazonaws.com/..."
}
```

## Troubleshooting

### If upload fails:
1. Check Lambda logs: `aws logs tail /aws/lambda/GetTrainMateStack-ApiFunctionCE271BD4-nktpjXfuOe0u --follow`
2. Verify S3 bucket permissions
3. Check CORS configuration: `aws s3api get-bucket-cors --bucket getrainmate-media-bucket`

### If display fails:
1. Verify signed URL endpoint is accessible
2. Check photo key format: `profiles/{userId}/{guid}.{ext}`
3. Verify user owns the photo (endpoint validates ownership)

### If CORS errors persist:
1. Verify CDK custom resource deployed successfully
2. Check S3 CORS configuration: `aws s3api get-bucket-cors --bucket getrainmate-media-bucket`
3. Clear browser cache and retry

## Deployment Commands Reference

### Update Lambda Code
```bash
aws lambda update-function-code \
  --function-name GetTrainMateStack-ApiFunctionCE271BD4-nktpjXfuOe0u \
  --zip-file fileb://deploy/gettrainmate-api-lambda.zip
```

### Update Lambda Runtime
```bash
aws lambda update-function-configuration \
  --function-name GetTrainMateStack-ApiFunctionCE271BD4-nktpjXfuOe0u \
  --runtime dotnet8 \
  --handler GetTrainMate.Api::GetTrainMate.Api.LambdaEntryPoint::FunctionHandlerAsync
```

### Check Lambda Status
```bash
aws lambda get-function \
  --function-name GetTrainMateStack-ApiFunctionCE271BD4-nktpjXfuOe0u \
  --query 'Configuration.{Runtime:Runtime,Handler:Handler,LastModified:LastModified}'
```

### View Lambda Logs
```bash
aws logs tail /aws/lambda/GetTrainMateStack-ApiFunctionCE271BD4-nktpjXfuOe0u --follow
```

## Next Steps
1. ✅ Lambda deployed
2. ✅ Runtime updated to .NET 8
3. ⏳ Test photo upload flow
4. ⏳ Test photo display flow
5. ⏳ Verify CORS headers in browser DevTools
