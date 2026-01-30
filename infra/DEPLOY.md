# Deployment Guide

## Quick Start

1. **Build the .NET API:**
   ```bash
   cd apps/api
   dotnet publish -c Release
   cd ../../infra
   ```

2. **Install CDK dependencies:**
   ```bash
   npm install
   ```

3. **Bootstrap CDK (first time only):**
   ```bash
   npx cdk bootstrap
   ```

4. **Deploy with your existing Cognito User Pool:**
   ```bash
   npx cdk deploy --context userPoolId=us-east-1_MRv5xL215 --context userPoolClientId=7phu8vk1o9s4nmmqofvcfmbntq
   ```

5. **Get the API URL from the output and add it to Amplify:**
   - Go to AWS Amplify Console → Environment variables
   - Add `VITE_API_URL` with the API Gateway URL from the deployment output

## What Gets Deployed

- ✅ API Gateway HTTP API
- ✅ Lambda Function (.NET 8)
- ✅ 10 DynamoDB Tables
- ✅ S3 Bucket for media
- ✅ IAM Roles and Permissions

## After Deployment

1. Copy the `ApiUrl` from the CDK output
2. Add it to Amplify environment variables as `VITE_API_URL`
3. Trigger a new build in Amplify
4. Your app should now connect to the API!

Set S3 CORS once on the bucket (Console → Permissions → CORS) if the web app calls S3 from the browser; see README. No Lambda.
