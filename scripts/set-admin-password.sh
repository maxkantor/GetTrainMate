#!/bin/bash

# Script to set admin password in AWS Systems Manager Parameter Store

set -e

PASSWORD="${1:-Maxang11@@}"
SSM_PATH="/gettrainmate/admin/password"

echo "Setting admin password in SSM Parameter Store..."
echo "Path: $SSM_PATH"
echo ""

# Check if parameter exists
if aws ssm get-parameter --name "$SSM_PATH" --with-decryption &>/dev/null; then
  echo "Parameter exists. Updating..."
  aws ssm put-parameter \
    --name "$SSM_PATH" \
    --value "$PASSWORD" \
    --type "SecureString" \
    --overwrite \
    --description "Admin portal password for GetTrainMate"
else
  echo "Parameter does not exist. Creating..."
  aws ssm put-parameter \
    --name "$SSM_PATH" \
    --value "$PASSWORD" \
    --type "SecureString" \
    --description "Admin portal password for GetTrainMate"
fi

echo ""
echo "✅ Password set successfully!"
echo ""
echo "To retrieve the password later:"
echo "  aws ssm get-parameter --name $SSM_PATH --with-decryption --query 'Parameter.Value' --output text"
echo ""
echo "To update the password:"
echo "  ./scripts/set-admin-password.sh 'YourNewPassword'"
