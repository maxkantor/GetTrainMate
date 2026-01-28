#!/bin/bash
# Check what's in the Lambda zip

ZIP_FILE="/Users/maxkantor/Desktop/GetTrainMate/deploy/gettrainmate-api-lambda.zip"

if [ ! -f "$ZIP_FILE" ]; then
    echo "❌ Zip file not found: $ZIP_FILE"
    exit 1
fi

echo "📦 Checking zip contents..."
echo "Size: $(du -sh "$ZIP_FILE" | cut -f1)"
echo ""
echo "Top 20 files by size:"
unzip -l "$ZIP_FILE" | sort -k1 -n -r | head -20
echo ""
echo "Checking for critical files:"
unzip -l "$ZIP_FILE" | grep -E "(GetTrainMate.Api.dll|LambdaEntryPoint|bootstrap|appsettings)" || echo "⚠️  Missing critical files!"
