# Fix Lambda Build - Zip Too Small (3MB)

## Problem
The zip is only 3MB, which means critical files are missing. The Lambda is returning 500 errors.

## Root Cause
We're using the **managed .NET 8 runtime** in Lambda, which means:
- ✅ We DON'T need the full .NET runtime (saves 20-30MB)
- ✅ We DO need all application DLLs and dependencies
- ❌ We might have excluded too much

## Solution

### 1. Rebuild with correct exclusions

The zip should exclude:
- `*.pdb` (debug symbols)
- `*.xml` (XML docs)
- `runtimes/win-*`, `runtimes/osx-*`, `runtimes/browser-*` (other platforms)
- `xunit*`, `Moq*` (test libraries)

But MUST include:
- All `.dll` files (application and dependencies)
- `appsettings.json`
- `LambdaEntryPoint.dll` or `GetTrainMate.Api.dll`
- Configuration files

### 2. Check what's in the zip

```bash
cd /Users/maxkantor/Desktop/GetTrainMate
unzip -l deploy/gettrainmate-api-lambda.zip | head -30
```

### 3. Rebuild

```bash
cd /Users/maxkantor/Desktop/GetTrainMate/apps/api
rm -rf bin obj publish
dotnet publish -c Release -o ./publish

cd publish
# List what we have
ls -lh *.dll | head -10

# Create zip with minimal exclusions
rm -f ../../../deploy/gettrainmate-api-lambda.zip
zip -r ../../../deploy/gettrainmate-api-lambda.zip . \
  -x "*.pdb" \
  -x "*.xml" \
  -x "runtimes/win-*" \
  -x "runtimes/osx-*" \
  -x "runtimes/browser-*" \
  -x "xunit*" \
  -x "Moq*"

# Check size
du -sh ../../../deploy/gettrainmate-api-lambda.zip
```

Expected size: **15-25 MB** (not 3MB, not 55MB)

### 4. Verify critical files are present

```bash
unzip -l deploy/gettrainmate-api-lambda.zip | grep -E "(GetTrainMate|LambdaEntryPoint|appsettings)"
```

You should see:
- `GetTrainMate.Api.dll` (main assembly)
- `appsettings.json`
- All AWS SDK DLLs
- All other dependency DLLs
