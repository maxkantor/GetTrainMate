# CI/CD Setup - GetTrainMate

## Overview

GetTrainMate uses AWS Amplify for continuous deployment of the web frontend, with GitHub Actions for build validation.

## Automatic Deployment Flow

### Every Push to `main` or `develop`:

1. **GitHub Actions** (`.github/workflows/web.yml`):
   - Validates code quality
   - Runs lint checks
   - Runs type checking
   - Builds the app to ensure no build errors
   - Runs on Node 18.x and 20.x matrix

2. **AWS Amplify**:
   - Detects push via GitHub webhook
   - Reads `amplify.yml` configuration
   - Installs dependencies: `cd apps/web && npm ci`
   - Builds app: `npm run build`
   - Deploys `apps/web/dist` to CloudFront CDN
   - Updates live site (2-5 minutes)

## Configuration Files

### `amplify.yml`
Located in project root. Defines build commands and artifact location.

```yaml
frontend:
  phases:
    preBuild:
      - cd apps/web && npm ci
    build:
      - npm run build
  artifacts:
    baseDirectory: apps/web/dist
```

### `.github/workflows/web.yml`
Runs on every push to validate build before Amplify deploys.

## Deployment Process

```bash
# 1. Make changes
git add .
git commit -m "feat: your feature"

# 2. Push to main
git push origin main

# 3. Monitor
# - GitHub Actions: Check workflow status
# - AWS Amplify Console: Watch build progress
# - Live site updates automatically
```

## Amplify Console Access

1. Log into AWS Console
2. Navigate to AWS Amplify
3. Select GetTrainMate app
4. View build logs, deployment history, and domain settings

## Environment Variables

Set in Amplify Console:
- `VITE_COGNITO_USER_POOL_ID`
- `VITE_COGNITO_CLIENT_ID`
- `VITE_API_URL`

## Rollback

If a deployment breaks:
1. Go to Amplify Console
2. Select previous successful build
3. Click "Redeploy this version"

Or push a revert commit:
```bash
git revert HEAD
git push origin main
```

## Branch Strategy

- `main` → Production (auto-deploy)
- `develop` → Staging (auto-deploy to different Amplify branch)
- Feature branches → Manual testing locally

## Build Time

Typical build: 2-3 minutes
- Install: 30-60s
- Build: 30-60s
- Deploy: 60-90s

## Monitoring

- GitHub Actions: Build validation status
- Amplify Console: Deployment logs
- CloudWatch: Access logs and metrics
- Sentry: Runtime error tracking (if configured)

## Troubleshooting

**Build fails in Amplify:**
- Check `amplify.yml` paths
- Verify environment variables set
- Check build logs in Amplify Console

**Build succeeds but site broken:**
- Check browser console for errors
- Verify API endpoints configured
- Check Cognito credentials

**CI/CD not triggering:**
- Verify GitHub webhook in Amplify
- Check branch protection rules
- Ensure Amplify connected to correct repo/branch
