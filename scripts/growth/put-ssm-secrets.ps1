# Create or update GetTrainMate growth secrets in SSM Parameter Store.
# Run from repo root. Reads env vars only — never echoes values.
$ErrorActionPreference = "Stop"
$Region = if ($env:AWS_REGION) { $env:AWS_REGION } else { "us-east-1" }

$Pairs = @(
    @{ Env = "GA4_PROPERTY_ID"; Param = "/gettrainmate/growth/ga4-property-id"; Secure = $false },
    @{ Env = "GOOGLE_ANALYTICS_CREDENTIALS_JSON"; Param = "/gettrainmate/growth/google-analytics-credentials-json"; Secure = $true },
    @{ Env = "STRIPE_RESTRICTED_READ_KEY"; Param = "/gettrainmate/growth/stripe-restricted-read-key"; Secure = $true }
)

Write-Host "GetTrainMate growth SSM setup ($Region)" -ForegroundColor Cyan

foreach ($p in $Pairs) {
    $val = [Environment]::GetEnvironmentVariable($p.Env)
    if ([string]::IsNullOrWhiteSpace($val)) {
        Write-Host "SKIP $($p.Env) (not set in this shell)" -ForegroundColor Yellow
        continue
    }
    $type = if ($p.Secure) { "SecureString" } else { "String" }
    $tmp = $null
    try {
        if ($p.Env -eq "GOOGLE_ANALYTICS_CREDENTIALS_JSON") {
            $tmp = Join-Path $env:TEMP ("gtm-growth-sa-" + [guid]::NewGuid().ToString() + ".json")
            Set-Content -Path $tmp -Value $val -Encoding UTF8 -NoNewline
            aws ssm put-parameter --name $p.Param --value "file://$($tmp.Replace('\','/'))" --type $type --overwrite --region $Region | Out-Null
        } else {
            aws ssm put-parameter --name $p.Param --value $val --type $type --overwrite --region $Region | Out-Null
        }
        Write-Host "OK $($p.Param) ($type)" -ForegroundColor Green
    } finally {
        if ($tmp -and (Test-Path $tmp)) { Remove-Item $tmp -Force -ErrorAction SilentlyContinue }
    }
}

Write-Host "Done. Verify with: node scripts/growth/verify-secrets.mjs" -ForegroundColor Cyan
