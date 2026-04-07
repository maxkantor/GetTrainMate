#!/usr/bin/env bash
# Zip existing apps/api/publish → deploy/gettrainmate-api-lambda.zip (no dotnet publish)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PUBLISH="$ROOT/apps/api/publish"
DEPLOY="$ROOT/deploy"
ZIP_PATH="$DEPLOY/gettrainmate-api-lambda.zip"

if [[ ! -f "$PUBLISH/GetTrainMate.Api.dll" ]]; then
  echo "Missing publish output. Run: dotnet publish apps/api/GetTrainMate.Api.csproj -c Release -o apps/api/publish" >&2
  exit 1
fi
mkdir -p "$DEPLOY"
rm -f "$ZIP_PATH"
cd "$PUBLISH"
find . -type f \( -name '*.pdb' -o -name '*.xml' \) -delete 2>/dev/null || true
zip -q -r "$ZIP_PATH" . -x "*.pdb" -x "*.xml"
echo "Built: $ZIP_PATH"
ls -la "$ZIP_PATH"
