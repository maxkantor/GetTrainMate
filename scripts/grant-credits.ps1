# Grant credits to a user via admin API
# Usage: .\scripts\grant-credits.ps1 -UserId "54e8c4a8-90a1-70f2-e493-79561cdee5d4" -Amount 3 -Reason "REFUND_AI_FAILED"
# Requires: ADMIN_TOKEN env or -AdminToken param; API_URL env or -ApiUrl param

param(
    [Parameter(Mandatory=$true)] [string]$UserId,
    [Parameter(Mandatory=$true)] [int]$Amount,
    [string]$Reason = "REFUND_AI_FAILED",
    [string]$AdminToken = $env:ADMIN_TOKEN,
    [string]$ApiUrl = $env:API_URL
)

if (-not $AdminToken) {
    Write-Error "ADMIN_TOKEN env or -AdminToken required. Get from admin login."
    exit 1
}
if (-not $ApiUrl) {
    $ApiUrl = "https://goskwzjzjg.execute-api.us-east-1.amazonaws.com"
    Write-Host "Using default API: $ApiUrl"
}

$uri = "$ApiUrl/api/admin/credits/grant"
$body = @{ userId = $UserId; amount = $Amount; reason = $Reason } | ConvertTo-Json

try {
    $r = Invoke-RestMethod -Uri $uri -Method Post -Body $body -ContentType "application/json" -Headers @{ "X-Admin-Token" = $AdminToken }
    Write-Host "OK: $($r.message) Balance: $($r.balance)"
} catch {
    Write-Error $_.Exception.Message
    if ($_.Exception.Response) {
        $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
        Write-Host $reader.ReadToEnd()
    }
    exit 1
}
