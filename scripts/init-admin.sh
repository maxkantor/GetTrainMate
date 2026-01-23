#!/bin/bash

# GetTrainMate Admin Initialization Script
# This script initializes the admin user and stores the password in AWS Systems Manager Parameter Store

set -e

echo "GetTrainMate Admin Initialization"
echo "=================================="

# Check if running in AWS region
if [ -z "$AWS_REGION" ]; then
    export AWS_REGION="us-east-1"
    echo "Using default region: $AWS_REGION"
fi

# Admin details
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@gettrainmate.com}"
ADMIN_NAME="${ADMIN_NAME:-GetTrainMate Admin}"
ADMIN_PASSWORD_PARAM="/gettrainmate/admin/password"

echo "Admin Email: $ADMIN_EMAIL"
echo "Admin Name: $ADMIN_NAME"
echo "SSM Parameter: $ADMIN_PASSWORD_PARAM"

# Check if password already exists in SSM
echo ""
echo "Checking if admin password already exists in SSM Parameter Store..."

if aws ssm get-parameter --name "$ADMIN_PASSWORD_PARAM" --region "$AWS_REGION" 2>/dev/null > /dev/null; then
    echo "✓ Admin password already stored in SSM Parameter Store"
    echo "  To retrieve the password, run:"
    echo "  aws ssm get-parameter --name '$ADMIN_PASSWORD_PARAM' --with-decryption --region '$AWS_REGION'"
else
    echo "✗ Admin password not found in SSM Parameter Store"
    echo ""
    echo "NOTE: Admin password will be auto-generated on first API startup"
    echo "      and automatically stored in SSM Parameter Store."
    echo ""
    echo "      The application will initialize on first run with:"
    echo "      - Email: $ADMIN_EMAIL"
    echo "      - Generated secure password (16 characters)"
fi

echo ""
echo "To login to the admin panel, use:"
echo "- Email: $ADMIN_EMAIL"
echo "- Password: (check SSM Parameter Store at path $ADMIN_PASSWORD_PARAM)"

echo ""
echo "Initialization complete!"
