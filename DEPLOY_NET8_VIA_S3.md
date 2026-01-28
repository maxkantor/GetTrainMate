# Deploy .NET 8 Lambda via S3 (File Too Large)

## Problem
The Lambda zip file is **55.53 MB**, which exceeds the **50 MB limit** for direct uploads.

## Solution: Upload via S3

### Step 1: Upload zip to S3
```bash
aws s3 cp deploy/gettrainmate-api-lambda.zip \
  s3://getrainmate-media-bucket/lambda/gettrainmate-api-lambda.zip
```

### Step 2: Update Lambda from S3
```bash
aws lambda update-function-code \
  --function-name GetTrainMateStack-ApiFunctionCE271BD4-nktpjXfuOe0u \
  --s3-bucket getrainmate-media-bucket \
  --s3-key lambda/gettrainmate-api-lambda.zip
```

### Step 3: Update Lambda Runtime to .NET 8
```bash
aws lambda update-function-configuration \
  --function-name GetTrainMateStack-ApiFunctionCE271BD4-nktpjXfuOe0u \
  --runtime dotnet8 \
  --handler GetTrainMate.Api::GetTrainMate.Api.LambdaEntryPoint::FunctionHandlerAsync
```

### Step 4: Verify
```bash
# Check runtime
aws lambda get-function-configuration \
  --function-name GetTrainMateStack-ApiFunctionCE271BD4-nktpjXfuOe0u \
  --query '[Runtime,Handler,LastUpdateStatus]' \
  --output json

# Test health endpoint
curl https://goskwzjzjg.execute-api.us-east-1.amazonaws.com/api/health
```

## Alternative: Reduce Package Size

If you want to reduce the zip size, you can:

1. **Use trimming** (already configured):
   - The project has `<PublishTrimmed>true</PublishTrimmed>` but it's commented out
   - Uncomment it to reduce size

2. **Exclude more files**:
   ```bash
   zip -r deploy/gettrainmate-api-lambda.zip . \
     -x "*.pdb" "*.xml" "*.json" "runtimes/*" "*.so"
   ```

3. **Use CDK deployment** (handles S3 automatically):
   ```bash
   cd infra
   npx cdk deploy --context userPoolId=us-east-1_MRv5xL2l5 --context userPoolClientId=7phu8vk1o9s4nmmqofvcfmbntq
   ```

## Current Status

✅ Code updated to .NET 8.0
✅ CDK stack updated to use .NET 8 runtime
✅ JWT package updated to 8.0.0
⏳ Waiting for deployment via S3
