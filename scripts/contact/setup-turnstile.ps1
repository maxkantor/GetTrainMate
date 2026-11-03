<#
.SYNOPSIS
  Create Cloudflare Turnstile widget (via Wrangler) and store keys in AWS SSM + Amplify.

.DESCRIPTION
  Prerequisites:
    1. Cloudflare login:  npx wrangler login
    2. AWS credentials that can ssm:PutParameter
    3. Optional Amplify app id for VITE_TURNSTILE_SITE_KEY

.EXAMPLE
  .\scripts\contact\setup-turnstile.ps1
  .\scripts\contact\setup-turnstile.ps1 -SiteKey "0x..." -Secret "0x..."
#>

[CmdletBinding()]
param(
  [string]$SiteKey = "",
  [string]$Secret = "",
  [string]$Domain = "gettrainmate.com",
  [string]$WidgetName = "GetTrainMate contact form",
  [string]$AmplifyAppId = "",
  [string]$AmplifyBranch = "main",
  [string]$Region = "us-east-1"
)

$ErrorActionPreference = "Stop"
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")

function Write-Ssm([string]$Name, [string]$Value, [string]$Type) {
  aws ssm put-parameter --name $Name --value $Value --type $Type --overwrite --region $Region | Out-Null
  Write-Host "OK SSM $Name ($Type)" -ForegroundColor Green
}

if (-not $SiteKey -or -not $Secret) {
  Write-Host "Creating Turnstile widget with Wrangler..." -ForegroundColor Cyan
  Push-Location $RepoRoot
  try {
    $out = npx --yes wrangler turnstile widget create $WidgetName `
      --domain $Domain `
      --domain "www.$Domain" `
      --domain localhost `
      --domain 127.0.0.1 `
      --mode managed 2>&1 | Out-String
    Write-Host $out
    if ($out -match 'sitekey["\s:=]+([0-9A-Za-z_-]+)') { $SiteKey = $Matches[1] }
    if ($out -match 'secret["\s:=]+([0-9A-Za-z_-]+)') { $Secret = $Matches[1] }
    # Wrangler often prints labeled lines
    if (-not $SiteKey -and $out -match '(?im)Site\s*Key[:\s]+(\S+)') { $SiteKey = $Matches[1].Trim() }
    if (-not $Secret -and $out -match '(?im)Secret(?:\s*Key)?[:\s]+(\S+)') { $Secret = $Matches[1].Trim() }
  } finally {
    Pop-Location
  }
}

if (-not $SiteKey -or -not $Secret) {
  Write-Error @"
Could not obtain Turnstile site key + secret automatically.

1) Run: npx wrangler login
2) Create a widget at https://dash.cloudflare.com/?to=/:account/turnstile
   Domains: gettrainmate.com, www.gettrainmate.com
3) Re-run:
   .\scripts\contact\setup-turnstile.ps1 -SiteKey '0x...' -Secret '0x...'
"@
}

Write-Ssm -Name "/gettrainmate/contact/turnstile-site-key" -Value $SiteKey -Type "String"
Write-Ssm -Name "/gettrainmate/contact/turnstile-secret" -Value $Secret -Type "SecureString"
Write-Ssm -Name "/gettrainmate/contact/turnstile-host" -Value $Domain -Type "String"

# Persist site key for local builds (public value)
$envExample = Join-Path $RepoRoot "apps\web\.env.local"
$line = "VITE_TURNSTILE_SITE_KEY=$SiteKey"
if (Test-Path $envExample) {
  $existing = Get-Content $envExample -Raw
  if ($existing -match 'VITE_TURNSTILE_SITE_KEY=') {
    $existing = [regex]::Replace($existing, 'VITE_TURNSTILE_SITE_KEY=.*', $line)
    Set-Content -Path $envExample -Value $existing.TrimEnd() -Encoding utf8
  } else {
    Add-Content -Path $envExample -Value $line
  }
} else {
  Set-Content -Path $envExample -Value $line -Encoding utf8
}
Write-Host "OK wrote $envExample (gitignored if configured)" -ForegroundColor Green

if (-not $AmplifyAppId) {
  $apps = aws amplify list-apps --region $Region --query "apps[?contains(name, 'GetTrainMate') || contains(name, 'gettrainmate')].{id:appId,name:name}" --output json 2>$null
  if ($apps) {
    $parsed = $apps | ConvertFrom-Json
    if ($parsed -is [array] -and $parsed.Count -ge 1) { $AmplifyAppId = $parsed[0].id }
    elseif ($parsed.id) { $AmplifyAppId = $parsed.id }
  }
}

if ($AmplifyAppId) {
  Write-Host "Updating Amplify env VITE_TURNSTILE_SITE_KEY on $AmplifyAppId/$AmplifyBranch ..." -ForegroundColor Cyan
  $branch = aws amplify get-branch --app-id $AmplifyAppId --branch-name $AmplifyBranch --region $Region --output json | ConvertFrom-Json
  $envMap = @{}
  if ($branch.branch.environmentVariables) {
    $branch.branch.environmentVariables.PSObject.Properties | ForEach-Object { $envMap[$_.Name] = $_.Value }
  }
  $envMap["VITE_TURNSTILE_SITE_KEY"] = $SiteKey
  $pairs = ($envMap.GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" }) -join ','
  aws amplify update-branch --app-id $AmplifyAppId --branch-name $AmplifyBranch --environment-variables $pairs --region $Region | Out-Null
  Write-Host "OK Amplify env updated. Trigger a web redeploy for the site key to ship." -ForegroundColor Green
} else {
  Write-Host "Amplify app not auto-detected. Set VITE_TURNSTILE_SITE_KEY=$SiteKey in Amplify Console." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Site key (public): $SiteKey" -ForegroundColor Cyan
Write-Host "Secret stored in SSM /gettrainmate/contact/turnstile-secret (SecureString)" -ForegroundColor Cyan
Write-Host "Next: redeploy API (Lambda reads SSM) and redeploy web (Amplify)." -ForegroundColor Yellow
