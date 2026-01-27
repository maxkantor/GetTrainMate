#!/bin/bash

# Script to set admin environment variables in Lambda and Amplify

set -e

echo "Setting Admin Environment Variables..."
echo ""

# Get stack outputs
STACK_NAME="GetTrainMateStack"
API_URL=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
  --output text 2>/dev/null || echo "")

LAMBDA_FUNCTION_NAME=$(aws cloudformation describe-stack-resources \
  --stack-name $STACK_NAME \
  --query 'StackResources[?ResourceType==`AWS::Lambda::Function`].PhysicalResourceId' \
  --output text 2>/dev/null || echo "")

if [ -z "$LAMBDA_FUNCTION_NAME" ]; then
  echo "⚠️  Lambda function not found. Deployment may still be in progress."
  echo "   Please run this script again after deployment completes."
  exit 1
fi

echo "Lambda Function: $LAMBDA_FUNCTION_NAME"
echo "API URL: $API_URL"
echo ""

# Set Lambda environment variables
echo "Setting Lambda environment variables..."
aws lambda update-function-configuration \
  --function-name "$LAMBDA_FUNCTION_NAME" \
  --environment "Variables={
    ADMIN_ALLOWLIST=mykantor@bellsouth.net,
    SES_FROM_EMAIL=noreply@gettrainmate.com,
    SES_REGION=us-east-1
  }" \
  --query 'FunctionName' \
  --output text

echo "✅ Lambda environment variables set"
echo ""

# Instructions for Amplify
echo "📋 To set Amplify environment variables:"
echo "   1. Go to AWS Amplify Console"
echo "   2. Select your app"
echo "   3. Go to Environment variables"
echo "   4. Add the following:"
echo ""
echo "   VITE_ADMIN_ALLOWLIST=mykantor@bellsouth.net"
echo "   VITE_API_URL=$API_URL"
echo ""
echo "   5. Save and trigger a new build"
echo ""

echo "✅ Environment variable setup complete!"
echo ""
echo "Next steps:"
echo "1. Set VITE_ADMIN_ALLOWLIST and VITE_API_URL in Amplify console"
echo "2. Verify SES sender email is verified in AWS SES console"
echo "3. Test admin access at: https://your-amplify-url/admin"
