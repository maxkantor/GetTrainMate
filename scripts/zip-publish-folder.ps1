# Zip existing apps\api\publish → deploy\gettrainmate-api-lambda.zip (no dotnet publish)
$ErrorActionPreference = "Stop"
$ROOT = Split-Path -Parent $PSScriptRoot
$PUBLISH = Join-Path $ROOT "apps\api\publish"
$DEPLOY = Join-Path $ROOT "deploy"
$ZIP_PATH = Join-Path $DEPLOY "gettrainmate-api-lambda.zip"

if (-not (Test-Path (Join-Path $PUBLISH "GetTrainMate.Api.dll"))) {
    Write-Error "Missing publish output. Run: dotnet publish apps\api\GetTrainMate.Api.csproj -c Release -o apps\api\publish"
    exit 1
}
if (-not (Test-Path $DEPLOY)) { New-Item -ItemType Directory -Path $DEPLOY | Out-Null }
if (Test-Path $ZIP_PATH) { Remove-Item $ZIP_PATH -Force }

Push-Location $PUBLISH
Get-ChildItem -Path . -Recurse -Include *.pdb,*.xml -File -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
Compress-Archive -Path * -DestinationPath $ZIP_PATH -CompressionLevel Optimal
Pop-Location

Write-Host "Built: $ZIP_PATH"
Get-Item $ZIP_PATH | Format-List FullName, Length
