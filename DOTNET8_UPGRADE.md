# .NET 8.0 Upgrade Complete

## Changes Made

### 1. Project File (`apps/api/GetTrainMate.Api.csproj`)
- ✅ Updated `TargetFramework` from `net6.0` to `net8.0`
- ✅ Updated `Microsoft.AspNetCore.Authentication.JwtBearer` from `6.0.35` to `8.0.0`

### 2. CDK Stack (`infra/stacks/main-stack.ts`)
- ✅ Updated runtime from `lambda.Runtime.DOTNET_6` to `lambda.Runtime.DOTNET_8`
- ✅ Updated code path from `net6.0/publish` to `net8.0/publish`

## Deployment Steps

1. **Build the .NET 8 project:**
   ```bash
   cd apps/api
   dotnet publish -c Release -o ./publish
   ```

2. **Create Lambda zip:**
   ```bash
   cd publish
   zip -r ../../../deploy/gettrainmate-api-lambda.zip . -x "*.pdb" "*.xml"
   ```

3. **Update Lambda function code:**
   ```bash
   aws lambda update-function-code \
     --function-name GetTrainMateStack-ApiFunctionCE271BD4-nktpjXfuOe0u \
     --zip-file fileb://deploy/gettrainmate-api-lambda.zip
   ```

4. **Update Lambda runtime to .NET 8:**
   ```bash
   aws lambda update-function-configuration \
     --function-name GetTrainMateStack-ApiFunctionCE271BD4-nktpjXfuOe0u \
     --runtime dotnet8 \
     --handler GetTrainMate.Api::GetTrainMate.Api.LambdaEntryPoint::FunctionHandlerAsync
   ```

5. **Or deploy via CDK:**
   ```bash
   cd infra
   npx cdk deploy --context userPoolId=us-east-1_MRv5xL2l5 --context userPoolClientId=7phu8vk1o9s4nmmqofvcfmbntq
   ```

## Verification

After deployment, test the health endpoint:
```bash
curl https://goskwzjzjg.execute-api.us-east-1.amazonaws.com/api/health
```

Should return: `{"status":"healthy","timestamp":"..."}`

## Notes

- .NET 8 managed runtime is now available on AWS Lambda
- All packages are compatible with .NET 8
- The handler remains the same: `GetTrainMate.Api::GetTrainMate.Api.LambdaEntryPoint::FunctionHandlerAsync`
