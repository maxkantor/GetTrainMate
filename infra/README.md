# GetTrainMate Infrastructure

AWS CDK infrastructure for GetTrainMate platform.

## Prerequisites

1. AWS CLI configured with credentials
2. Node.js 18+ and npm
3. .NET 8 SDK
4. AWS CDK CLI: `npm install -g aws-cdk`

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Build the .NET API for Lambda:**
   ```bash
   cd ../apps/api
   dotnet publish -c Release
   cd ../../infra
   ```

3. **Bootstrap CDK (first time only):**
   ```bash
   cdk bootstrap
   ```

## Configuration

### Using Existing Cognito User Pool

If you already have a Cognito User Pool (like in your case), pass it as context:

```bash
cdk deploy --context userPoolId=us-east-1_MRv5xL215 --context userPoolClientId=7phu8vk1o9s4nmmqofvcfmbntq
```

Or set environment variables:
```bash
export COGNITO_USER_POOL_ID=us-east-1_MRv5xL215
export COGNITO_CLIENT_ID=7phu8vk1o9s4nmmqofvcfmbntq
cdk deploy
```

### Creating New Cognito User Pool

If you don't have a User Pool, the CDK will create one automatically.

### Why do I have so many user pools?

Each time the stack is deployed **without** `userPoolId` context (e.g. plain `npm run deploy` or `cdk deploy`), and the stack is being **created** (first deploy) or **recreated** (after `cdk destroy`), CDK creates a **new** User Pool named `gettrainmate-users`. The old pool is left in the account (CloudFormation deletes it only when the stack is destroyed, and sometimes the resource is replaced so a new one is created). So:

- **First deploy** without context → 1 new pool  
- **Destroy stack** then **deploy** again → another new pool (old one may remain)  
- **Deploy from another branch/machine** without context → can create or update depending on stack state  

**To avoid creating more pools:** always pass your existing pool when deploying:

```bash
cdk deploy --context userPoolId=us-east-1_YOUR_POOL_ID --context userPoolClientId=YOUR_CLIENT_ID
```

**To clean up:** In AWS Console → Cognito → User pools, delete the pools you don’t use. Keep the one that matches `VITE_COGNITO_USER_POOL_ID` in your app’s `.env` (e.g. `us-east-1_MRv5xL215`).

## Deployment

1. **Synthesize CloudFormation template:**
   ```bash
   npm run synth
   ```

2. **Deploy the stack:**
   ```bash
   npm run deploy
   ```

   Or with Cognito context:
   ```bash
   cdk deploy --context userPoolId=us-east-1_MRv5xL215 --context userPoolClientId=7phu8vk1o9s4nmmqofvcfmbntq
   ```

3. **Get the API URL:**
   After deployment, the stack will output the API Gateway URL. Use this as `VITE_API_URL` in your Amplify environment variables.

## What Gets Created

- **API Gateway HTTP API** - REST API endpoint
- **Lambda Function** - .NET 8 API handler
- **DynamoDB Tables** - 10 tables for users, profiles, matches, messages, events, content, translations, entitlements, leads, audit logs
- **S3 Bucket** - For media storage
- **IAM Roles** - Permissions for Lambda to access AWS services
- **Cognito User Pool** (optional) - If not provided

## Outputs

After deployment, you'll get:
- `ApiUrl` - API Gateway URL (use this for `VITE_API_URL`)
- `UserPoolId` - Cognito User Pool ID
- `MediaBucketName` - S3 bucket name

## Troubleshooting

### Lambda Deployment Issues

If Lambda deployment fails, make sure you've built the .NET API:
```bash
cd ../apps/api
dotnet publish -c Release
```

### Missing Permissions

If you get permission errors, make sure your AWS credentials have permissions for:
- Lambda
- API Gateway
- DynamoDB
- S3
- IAM
- Cognito (if creating new pool)
