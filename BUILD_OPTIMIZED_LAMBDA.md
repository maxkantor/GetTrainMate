# Build Optimized Lambda Package

Run these commands in your terminal:

```bash
cd /Users/maxkantor/Desktop/GetTrainMate/apps/api

# Clean previous builds
rm -rf bin obj publish

# Build in Release mode (excludes test libraries)
dotnet publish -c Release -o ./publish

# Create optimized zip (excludes runtimes, test libs, debug files)
cd publish
rm -f ../../../deploy/gettrainmate-api-lambda.zip

zip -r ../../../deploy/gettrainmate-api-lambda.zip . \
  -x "*.pdb" \
  -x "*.xml" \
  -x "runtimes/*" \
  -x "*.so" \
  -x "xunit*" \
  -x "Moq*" \
  -x "*.Test*"

# Check size
du -sh ../../../deploy/gettrainmate-api-lambda.zip
```

Expected result: **20-30 MB** (down from 55.53 MB)

## After Building

If size is still > 50 MB, deploy via S3:
```bash
aws s3 cp deploy/gettrainmate-api-lambda.zip s3://getrainmate-media-bucket/lambda/gettrainmate-api-lambda.zip
aws lambda update-function-code \
  --function-name GetTrainMateStack-ApiFunctionCE271BD4-nktpjXfuOe0u \
  --s3-bucket getrainmate-media-bucket \
  --s3-key lambda/gettrainmate-api-lambda.zip
```

If size is < 50 MB, you can upload directly via AWS Console.
