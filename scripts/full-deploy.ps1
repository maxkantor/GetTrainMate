# Full pipeline: tests → API publish → CDK deploy → Lambda zip → optional git commit + push
# Usage (from repo root):
#   powershell -ExecutionPolicy Bypass -File scripts/full-deploy.ps1
#   powershell -ExecutionPolicy Bypass -File scripts/full-deploy.ps1 -SkipTests
#   powershell -ExecutionPolicy Bypass -File scripts/full-deploy.ps1 -CommitMessage "Deploy CRM fixes"
#   powershell -ExecutionPolicy Bypass -File scripts/full-deploy.ps1 -SkipTests -AutoCommit   # deploy+zip+push, default commit msg if dirty
param(
    [switch] $SkipTests,
    [switch] $SkipPush,
    [switch] $AutoCommit,
    [string] $CommitMessage = ""
)

$ErrorActionPreference = "Stop"
# scripts/full-deploy.ps1 → repo root is parent of scripts/
$ROOT = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path (Join-Path $ROOT "apps\api\GetTrainMate.Api.csproj"))) {
    Write-Error "Could not find API project under $ROOT"
    exit 1
}

Set-Location $ROOT
Write-Host "==> Root: $ROOT"

if (-not $SkipTests) {
    Write-Host "`n==> dotnet test (Debug)..."
    dotnet test (Join-Path $ROOT "apps\api\GetTrainMate.Api.csproj") -c Debug -v minimal
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

    Write-Host "`n==> npm test (web vitest)..."
    Push-Location (Join-Path $ROOT "apps\web")
    if (-not (Test-Path "node_modules")) { npm install }
    npm run test
    if ($LASTEXITCODE -ne 0) { Pop-Location; exit $LASTEXITCODE }
    Pop-Location
} else {
    Write-Host "`n==> Skipping tests (-SkipTests)"
}

Write-Host "`n==> dotnet publish API (Release) → apps\api\publish..."
dotnet publish (Join-Path $ROOT "apps\api\GetTrainMate.Api.csproj") -c Release -o (Join-Path $ROOT "apps\api\publish")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`n==> CDK deploy..."
Push-Location (Join-Path $ROOT "infra")
if (-not (Test-Path "node_modules")) { npm install }
npm run deploy
if ($LASTEXITCODE -ne 0) { Pop-Location; exit $LASTEXITCODE }
Pop-Location

Write-Host "`n==> Lambda zip → deploy\gettrainmate-api-lambda.zip..."
Push-Location $ROOT
npm run zip
if ($LASTEXITCODE -ne 0) { Pop-Location; exit $LASTEXITCODE }
Pop-Location

if (-not $SkipPush) {
    $dirty = git -C $ROOT status --porcelain
    if ($dirty) {
        $msg = $CommitMessage
        if ([string]::IsNullOrWhiteSpace($msg)) {
            if ($AutoCommit) {
                $msg = "chore: deploy $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
            } else {
                Write-Host "`n!! Git has uncommitted changes. Use -CommitMessage '...' or -AutoCommit"
                exit 1
            }
        }
        Write-Host "`n==> git add / commit..."
        git -C $ROOT add -A
        git -C $ROOT commit -m $msg
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    }
    Write-Host "`n==> git push..."
    git -C $ROOT push
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} else {
    Write-Host "`n==> Skipping git push (-SkipPush)"
}

Write-Host "`nDone."
