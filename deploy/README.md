# Lambda Deployment Package

This folder contains the Lambda deployment package for the GetTrainMate API.

## Important: two different zip types

| File | What it is | Upload to Lambda? |
|------|------------|---------------------|
| **`gettrainmate-api-lambda.zip`** (~4–6 MB) | Published .NET API + dependencies (`dotnet publish` → zip) | **Yes — this is the API backend.** |
| **`GetTrainMate-*-source.zip`** (~3 MB) | **Git source snapshot only** (`git archive`), no `node_modules`, no compiled DLLs | **No.** Using this as Lambda code will break the API (e.g. profile won’t load). |

Rebuild the Lambda package from repo root: `npm run zip` (or `npm run zip:publish` if `apps/api/publish` is already fresh).

## Files

- `gettrainmate-api-lambda.zip` — .NET API Lambda deployment package (from `npm run zip`).
- `GetTrainMate.Api-backend-YYYYMMDD-HHmm.zip` — optional timestamped copy of the same artifact.
- `gettrainmate-appsync-resolver-lambda.zip` — AppSync GraphQL resolver (Node, includes `node_modules`). Build: `npm install --omit=dev` in `infra/lambdas/appsync-resolver`, then zip `index.js`, `package.json`, `package-lock.json`, `node_modules`. Prefer CDK deploy, which bundles this automatically.

## Building the Package

From repo root:

```bash
npm run zip
```

Creates **`C:\Apps\GetTrainMate\deploy\gettrainmate-api-lambda.zip`** when the repo lives at `C:\Apps\GetTrainMate` (otherwise `<repo>/deploy/...`). Zips under `deploy/*.zip` are gitignored.

If you already ran `dotnet publish` to `apps/api/publish`, only re-zip (fast):

```bash
npm run zip:publish
```

## Deploying

### Option 1: Via AWS CLI

```bash
aws lambda update-function-code \
  --function-name GetTrainMateStack-ApiFunctionCE271BD4-nktpjXfuOe0u \
  --zip-file fileb://deploy/gettrainmate-api-lambda.zip
```

### Option 2: Via CDK

The CDK stack automatically builds and deploys the Lambda function. To update:

```bash
cd infra
npx cdk deploy
```

### Option 3: Via AWS Console

1. Go to Lambda Console
2. Select your function
3. Click "Upload from" → ".zip file"
4. Select `deploy/gettrainmate-api-lambda.zip`
5. Click "Save"

## Package Contents

The zip file contains:
- `GetTrainMate.Api.dll` - Main assembly
- `GetTrainMate.Api.deps.json` - Dependencies manifest
- `GetTrainMate.Api.runtimeconfig.json` - Runtime configuration
- All required NuGet package DLLs
- `LambdaEntryPoint.dll` - Lambda entry point

## Size

The package is typically 5-15 MB depending on dependencies.

## Notes

- Debug symbols (`.pdb`) and XML docs are excluded to reduce size
- The package is built for .NET 8.0 runtime
- Ensure Lambda runtime is set to `provided.al2` or `.NET 8` (depending on your setup)
