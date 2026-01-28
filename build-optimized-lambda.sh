#!/bin/bash
# Optimized Lambda build - reduces package size from 55MB to ~20-30MB

set -e

echo "🔨 Building optimized .NET 8 Lambda package..."
echo ""

cd "$(dirname "$0")/apps/api"

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf bin obj publish

# Build in Release mode (excludes test libraries automatically)
echo "📦 Publishing .NET 8 Release build..."
dotnet publish -c Release -o ./publish

# Create optimized zip
echo "📦 Creating optimized zip (excluding runtimes, test libs, debug files)..."
cd publish
rm -f ../../../deploy/gettrainmate-api-lambda.zip

# For .NET 8 managed runtime, we need ALL DLLs and dependencies
# Only exclude:
# - Debug symbols (.pdb)
# - XML documentation (.xml)
# - Test libraries (xunit, Moq)
# DO NOT exclude runtimes/ - some packages need native libraries
zip -r ../../../deploy/gettrainmate-api-lambda.zip . \
  -x "*.pdb" \
  -x "*.xml" \
  -x "*xunit*" \
  -x "*Moq*" \
  -x "*Test*.dll" \
  -x "*Tests*.dll"

# Show results
SIZE=$(du -sh ../../../deploy/gettrainmate-api-lambda.zip | cut -f1)
SIZE_BYTES=$(du -b ../../../deploy/gettrainmate-api-lambda.zip | cut -f1)
SIZE_MB=$(awk "BEGIN {printf \"%.2f\", $SIZE_BYTES / 1024 / 1024}")

echo ""
echo "✅ Lambda zip created successfully!"
echo "📊 Size: $SIZE ($SIZE_MB MB)"
echo "📍 Location: deploy/gettrainmate-api-lambda.zip"
echo ""

SIZE_MB_INT=${SIZE_MB%.*}
if [ "$SIZE_MB_INT" -gt 50 ]; then
  echo "⚠️  Size exceeds 50 MB limit. Deploy via S3:"
  echo ""
  echo "  aws s3 cp deploy/gettrainmate-api-lambda.zip s3://getrainmate-media-bucket/lambda/gettrainmate-api-lambda.zip"
  echo "  aws lambda update-function-code \\"
  echo "    --function-name GetTrainMateStack-ApiFunctionCE271BD4-nktpjXfuOe0u \\"
  echo "    --s3-bucket getrainmate-media-bucket \\"
  echo "    --s3-key lambda/gettrainmate-api-lambda.zip"
  echo ""
  echo "  aws lambda update-function-configuration \\"
  echo "    --function-name GetTrainMateStack-ApiFunctionCE271BD4-nktpjXfuOe0u \\"
  echo "    --runtime dotnet8 \\"
  echo "    --handler GetTrainMate.Api::GetTrainMate.Api.LambdaEntryPoint::FunctionHandlerAsync"
else
  echo "✅ Size is under 50 MB - you can upload directly via AWS Console!"
fi
