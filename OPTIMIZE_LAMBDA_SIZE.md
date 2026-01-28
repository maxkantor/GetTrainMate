# Why is the Lambda zip so large (55.53 MB)?

## Common Causes

1. **`runtimes/` folder** - Contains native libraries for multiple platforms (Windows, macOS, Linux, browser)
   - Not needed for Lambda (uses managed runtime)
   - Can be 20-30 MB

2. **Test libraries** - xunit, Moq, etc.
   - Shouldn't be in production builds
   - Can be 5-10 MB

3. **All AWS SDK DLLs** - Full SDK packages
   - Can be 10-15 MB total

4. **ASP.NET Core framework** - Full framework DLLs
   - Can be 10-15 MB

## Solutions

### Option 1: Exclude runtimes folder (Recommended)
Since we're using the managed .NET 8 runtime, we don't need the `runtimes/` folder:

```bash
cd apps/api/publish
zip -r ../../../deploy/gettrainmate-api-lambda.zip . \
  -x "*.pdb" "*.xml" "runtimes/*" "*.so"
```

### Option 2: Use PublishTrimmed
Enable trimming to remove unused code:

```xml
<PublishTrimmed>true</PublishTrimmed>
<TrimMode>link</TrimMode>
```

### Option 3: Exclude test libraries
Test packages (xunit, Moq) shouldn't be in production builds.

### Option 4: Use CDK deployment
CDK automatically handles S3 upload for large files.

## Quick Fix

Rebuild and exclude runtimes:

```bash
cd apps/api
dotnet publish -c Release -o ./publish
cd publish
zip -r ../../../deploy/gettrainmate-api-lambda.zip . \
  -x "*.pdb" "*.xml" "runtimes/*" "*.so" "xunit*" "Moq*"
```

This should reduce the size significantly (likely to 20-30 MB).
