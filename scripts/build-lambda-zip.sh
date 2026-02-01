#!/usr/bin/env bash
# Build API and create Lambda zip in deploy/

set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOY="$ROOT/deploy"
ZIP_NAME="gettrainmate-api-lambda.zip"
ZIP_PATH="$DEPLOY/$ZIP_NAME"
PUBLISH="$ROOT/apps/api/publish"

cd "$ROOT/apps/api"
rm -rf publish
dotnet publish -c Release -o publish

cd "$PUBLISH"
zip -r "$ZIP_PATH" . -x "*.pdb" -x "*.xml"

echo "Built: $ZIP_PATH"
ls -la "$ZIP_PATH"
