#!/bin/bash
# Optimized Lambda build script - excludes unnecessary files

set -e

echo "🔨 Building .NET 8 Lambda package (optimized)..."

cd "$(dirname "$0")/../apps/api"

# Clean previous builds
rm -rf bin obj publish

# Build
echo "📦 Publishing..."
dotnet publish -c Release -o ./publish

cd publish

# Create optimized zip (exclude runtimes, test libs, debug files)
echo "📦 Creating optimized zip..."
rm -f ../../../deploy/gettrainmate-api-lambda.zip

zip -r ../../../deploy/gettrainmate-api-lambda.zip . \
  -x "*.pdb" \
  -x "*.xml" \
  -x "runtimes/*" \
  -x "*.so" \
  -x "xunit*" \
  -x "Moq*" \
  -x "*.Test*" \
  -x "publish/*"

SIZE=$(du -sh ../../../deploy/gettrainmate-api-lambda.zip | cut -f1)
echo ""
echo "✅ Lambda zip created: deploy/gettrainmate-api-lambda.zip"
echo "📊 Size: $SIZE"
echo ""
echo "If size > 50 MB, deploy via S3:"
echo "  aws s3 cp deploy/gettrainmate-api-lambda.zip s3://getrainmate-media-bucket/lambda/"
echo "  aws lambda update-function-code --function-name <name> --s3-bucket getrainmate-media-bucket --s3-key lambda/gettrainmate-api-lambda.zip"
