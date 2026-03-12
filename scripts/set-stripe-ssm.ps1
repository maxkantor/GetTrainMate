# Create or update Stripe keys in SSM Parameter Store.
# Usage: .\scripts\set-stripe-ssm.ps1
# Or with explicit values: $env:STRIPE_SECRET_KEY="sk_live_xxx"; $env:STRIPE_WEBHOOK_SECRET="whsec_xxx"; .\scripts\set-stripe-ssm.ps1

$KeyParam = "/gettrainmate/stripe/secret-key"
$WhParam = "/gettrainmate/stripe/webhook-secret"

Write-Host "Stripe SSM Setup" -ForegroundColor Cyan
Write-Host "===============" -ForegroundColor Cyan

if ($env:STRIPE_SECRET_KEY) {
    Write-Host "Setting secret key from STRIPE_SECRET_KEY env..."
    aws ssm put-parameter --name $KeyParam --value $env:STRIPE_SECRET_KEY --type SecureString --overwrite
    Write-Host "OK $KeyParam" -ForegroundColor Green
} else {
    Write-Host "Skipping secret key (set STRIPE_SECRET_KEY env to create)"
}

if ($env:STRIPE_WEBHOOK_SECRET) {
    Write-Host "Setting webhook secret from STRIPE_WEBHOOK_SECRET env..."
    aws ssm put-parameter --name $WhParam --value $env:STRIPE_WEBHOOK_SECRET --type SecureString --overwrite
    Write-Host "OK $WhParam" -ForegroundColor Green
} else {
    Write-Host "Skipping webhook secret (set STRIPE_WEBHOOK_SECRET env to create)"
}

Write-Host ""
Write-Host "Done. Deploy or restart the API Lambda to pick up changes."
Write-Host "See docs/STRIPE_SSM_SETUP.md for details."
