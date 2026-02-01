# Lambda Deployment Package

This folder contains the Lambda deployment package for the GetTrainMate API.

## Files

- `gettrainmate-api-lambda.zip` - Lambda deployment package

## Building the Package

From repo root:

```bash
npm run zip
```

Creates `deploy/gettrainmate-api-lambda.zip`.

## Deploying

### Option 1: Via AWS CLI

```bash
aws lambda update-function-code \
  --function-name GetTrainMateStack-ApiFunctionCE271BD4-nktpjXfuOe0u \
  --zip-file fileb://deploy/gettrainmate-api-lambda.zip
```

### Option 2: Via CDK

The CDK stack automatically builds and deploys the Lambda function. To update:

```bash
cd infra
npx cdk deploy
```

### Option 3: Via AWS Console

1. Go to Lambda Console
2. Select your function
3. Click "Upload from" → ".zip file"
4. Select `deploy/gettrainmate-api-lambda.zip`
5. Click "Save"

## Package Contents

The zip file contains:
- `GetTrainMate.Api.dll` - Main assembly
- `GetTrainMate.Api.deps.json` - Dependencies manifest
- `GetTrainMate.Api.runtimeconfig.json` - Runtime configuration
- All required NuGet package DLLs
- `LambdaEntryPoint.dll` - Lambda entry point

## Size

The package is typically 5-15 MB depending on dependencies.

## Notes

- Debug symbols (`.pdb`) and XML docs are excluded to reduce size
- The package is built for .NET 8.0 runtime
- Ensure Lambda runtime is set to `provided.al2` or `.NET 8` (depending on your setup)
