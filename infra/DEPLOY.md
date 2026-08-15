# Deployment Guide

## Quick Start

1. **Build the .NET API and Lambda zip (in deploy/):**
   ```bash
   npm run zip
   ```
   Creates `deploy/gettrainmate-api-lambda.zip`. CDK uses `apps/api/publish`; the zip is for manual Lambda upload.

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
   npx cdk deploy --context userPoolId=us-east-1_XXX --context userPoolClientId=XXX --context frontendUrl=https://gettrainmate.com
   ```
   - `frontendUrl`: Required for Stripe checkout redirects (success/cancel URLs). Use your public app origin (production: `https://gettrainmate.com`).
   - Stripe: Keys loaded from SSM `/gettrainmate/stripe/secret-key` and `/gettrainmate/stripe/webhook-secret` (Lambda has access).

5. **Get the API URL from the output and add it to Amplify:**
   - Go to AWS Amplify Console → Environment variables
   - Add `VITE_API_URL` with the API Gateway URL from the deployment output

## What Gets Deployed

- ✅ API Gateway HTTP API
- ✅ Lambda Function (.NET 10)
- ✅ 10 DynamoDB Tables
- ✅ S3 Bucket for media
- ✅ IAM Roles and Permissions

## After Deployment

1. **Seed billing plans** (Admin CRM → Billing Plans → "Seed default plans", or `POST /api/admin/billing/plans/seed`)
2. **Configure Stripe Price IDs** for Pro and Elite in Admin CRM → Billing Plans
3. **Stripe webhook**: Point to `POST /api/billing/webhook` (see docs/BILLING_SETUP.md)
4. Copy the `ApiUrl` from the CDK output
2. Add it to Amplify environment variables as `VITE_API_URL`
3. Trigger a new build in Amplify
4. Your app should now connect to the API!

Set S3 CORS once on the bucket (Console → Permissions → CORS) if the web app calls S3 from the browser; see README. No Lambda.
