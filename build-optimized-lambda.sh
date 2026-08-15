#!/bin/bash
# Optimized Lambda build - always creates deploy/gettrainmate-api-lambda.zip

set -e

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
ZIP_PATH="$REPO_ROOT/deploy/gettrainmate-api-lambda.zip"

echo "🔨 Building optimized .NET 10 Lambda package..."
echo ""

cd "$REPO_ROOT/apps/api"

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf bin obj publish

# Build in Release mode (excludes test libraries automatically)
echo "📦 Publishing .NET 10 Release build..."
dotnet publish -c Release -o ./publish

# Always create zip at deploy/gettrainmate-api-lambda.zip
mkdir -p "$REPO_ROOT/deploy"
echo "📦 Creating zip at deploy/gettrainmate-api-lambda.zip..."
cd publish
rm -f "$ZIP_PATH"

# For .NET 10 managed runtime, we need ALL DLLs and dependencies
# Only exclude: .pdb, .xml, test libs
zip -r "$ZIP_PATH" . \
  -x "*.pdb" \
  -x "*.xml" \
  -x "*xunit*" \
  -x "*Moq*" \
  -x "*Test*.dll" \
  -x "*Tests*.dll"

# Show results (macOS: use stat for bytes; Linux: du -b)
if command -v stat >/dev/null 2>&1; then
  SIZE_BYTES=$(stat -f%z "$ZIP_PATH" 2>/dev/null || stat -c%s "$ZIP_PATH" 2>/dev/null || echo 0)
else
  SIZE_BYTES=$(du -b "$ZIP_PATH" 2>/dev/null | cut -f1 || echo 0)
fi
SIZE=$(du -sh "$ZIP_PATH" | cut -f1)
SIZE_MB=$(awk "BEGIN {printf \"%.2f\", $SIZE_BYTES / 1024 / 1024}")

echo ""
echo "✅ Lambda zip created successfully!"
echo "📊 Size: $SIZE ($SIZE_MB MB)"
echo "📍 Location: deploy/gettrainmate-api-lambda.zip"
echo ""

SIZE_MB_INT=${SIZE_MB%.*}
if [ "${SIZE_MB_INT:-0}" -gt 50 ] 2>/dev/null; then
  echo "⚠️  Size exceeds 50 MB limit. Deploy via S3:"
  echo ""
  echo "  aws s3 cp deploy/gettrainmate-api-lambda.zip s3://gettrainmate-media-bucket/lambda/gettrainmate-api-lambda.zip"
  echo "  aws lambda update-function-code \\"
  echo "    --function-name GetTrainMateStack-ApiFunctionCE271BD4-nktpjXfuOe0u \\"
  echo "    --s3-bucket gettrainmate-media-bucket \\"
  echo "    --s3-key lambda/gettrainmate-api-lambda.zip"
  echo ""
  echo "  aws lambda update-function-configuration \\"
  echo "    --function-name GetTrainMateStack-ApiFunctionCE271BD4-nktpjXfuOe0u \\"
  echo "    --runtime dotnet10 \\"
  echo "    --handler GetTrainMate.Api::GetTrainMate.Api.LambdaEntryPoint::HandleAwsEventAsync"
else
  echo "✅ Size is under 50 MB - you can upload directly via AWS Console!"
fi
