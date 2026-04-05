# Build API and create Lambda zip in <repo>/deploy/ (e.g. C:\Apps\GetTrainMate\deploy\gettrainmate-api-lambda.zip)
$ErrorActionPreference = "Stop"
$ROOT = Split-Path -Parent $PSScriptRoot
$DEPLOY = Join-Path $ROOT "deploy"
$ZIP_NAME = "gettrainmate-api-lambda.zip"
$ZIP_PATH = Join-Path $DEPLOY $ZIP_NAME
$PUBLISH = Join-Path $ROOT "apps\api\publish"

Set-Location (Join-Path $ROOT "apps\api")
if (Test-Path publish) { Remove-Item -Recurse -Force publish }
dotnet publish -c Release -o publish

if (-not (Test-Path $DEPLOY)) { New-Item -ItemType Directory -Path $DEPLOY | Out-Null }
if (Test-Path $ZIP_PATH) { Remove-Item $ZIP_PATH -Force }

Set-Location $PUBLISH
# Match build-lambda-zip.sh: omit debug symbols and XML docs from the Lambda package.
Get-ChildItem -Path . -Recurse -Include *.pdb,*.xml -File -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue

Compress-Archive -Path * -DestinationPath $ZIP_PATH -CompressionLevel Optimal

Write-Host "Built: $ZIP_PATH"
Get-Item $ZIP_PATH | Format-List Name, Length
