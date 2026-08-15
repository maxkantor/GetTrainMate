#!/bin/bash
# Optimized Lambda build - always creates deploy/gettrainmate-api-lambda.zip

set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ZIP_PATH="$REPO_ROOT/deploy/gettrainmate-api-lambda.zip"

echo "🔨 Building .NET 10 Lambda package (optimized)..."

cd "$REPO_ROOT/apps/api"

# Clean previous builds
rm -rf bin obj publish

# Build
echo "📦 Publishing..."
dotnet publish -c Release -o ./publish

cd publish

# Always create zip at deploy/gettrainmate-api-lambda.zip
mkdir -p "$REPO_ROOT/deploy"
echo "📦 Creating zip at deploy/gettrainmate-api-lambda.zip..."
rm -f "$ZIP_PATH"

zip -r "$ZIP_PATH" . \
  -x "*.pdb" \
  -x "*.xml" \
  -x "runtimes/*" \
  -x "*.so" \
  -x "xunit*" \
  -x "Moq*" \
  -x "*.Test*" \
  -x "publish/*"

SIZE=$(du -sh "$ZIP_PATH" | cut -f1)
echo ""
echo "✅ Lambda zip created: deploy/gettrainmate-api-lambda.zip"
echo "📊 Size: $SIZE"
echo ""
echo "If size > 50 MB, deploy via S3:"
echo "  aws s3 cp deploy/gettrainmate-api-lambda.zip s3://gettrainmate-media-bucket/lambda/"
echo "  aws lambda update-function-code --function-name <name> --s3-bucket gettrainmate-media-bucket --s3-key lambda/gettrainmate-api-lambda.zip"
