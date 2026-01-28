#!/bin/bash
# Rebuild Lambda with correct exclusions - should be 15-25 MB

set -e

echo "🔨 Rebuilding .NET 8 Lambda package..."
echo ""

cd "$(dirname "$0")/apps/api"

# Clean
echo "🧹 Cleaning..."
rm -rf bin obj publish

# Build
echo "📦 Publishing Release build..."
dotnet publish -c Release -o ./publish

# Check what we have
cd publish
echo ""
echo "📊 Files in publish directory:"
ls -lh *.dll 2>/dev/null | head -10 || echo "No DLLs found!"
echo ""
echo "📊 Total size:"
du -sh .

# Create zip - ONLY exclude debug/test files, keep everything else
echo ""
echo "📦 Creating zip (excluding only .pdb, .xml, and test libs)..."
rm -f ../../../deploy/gettrainmate-api-lambda.zip

zip -r ../../../deploy/gettrainmate-api-lambda.zip . \
  -x "*.pdb" \
  -x "*.xml" \
  -x "*xunit*" \
  -x "*Moq*" \
  -x "*Test*.dll" \
  -x "*Tests*.dll"

# Verify critical files
echo ""
echo "🔍 Verifying critical files in zip:"
unzip -l ../../../deploy/gettrainmate-api-lambda.zip | grep -E "(GetTrainMate|LambdaEntryPoint|appsettings|\.dll)" | head -20

# Show size
SIZE=$(du -sh ../../../deploy/gettrainmate-api-lambda.zip | cut -f1)
SIZE_BYTES=$(du -b ../../../deploy/gettrainmate-api-lambda.zip | cut -f1)
SIZE_MB=$(awk "BEGIN {printf \"%.2f\", $SIZE_BYTES / 1024 / 1024}")

echo ""
echo "✅ Lambda zip created!"
echo "📊 Size: $SIZE ($SIZE_MB MB)"
echo "📍 Location: deploy/gettrainmate-api-lambda.zip"
echo ""

if (( $(echo "$SIZE_MB < 5" | bc -l) )); then
  echo "⚠️  WARNING: Size is too small! Missing files?"
  echo "   Check that all DLLs are included."
elif (( $(echo "$SIZE_MB > 50" | bc -l) )); then
  echo "⚠️  Size exceeds 50 MB. Deploy via S3."
else
  echo "✅ Size looks good! Can upload directly."
fi
