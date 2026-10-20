#!/usr/bin/env bash
# Cloud Agent install script for GetTrainMate.
# Idempotent: safe to run repeatedly and against cached/partial state.
set -euo pipefail

cd "$(dirname "$0")/.."

# .NET 8 SDK is required to build/test the API (apps/api) and to publish the
# Lambda artifact consumed by the CDK infra. Prebuilt environment snapshots
# already contain it, so this only downloads when the SDK is missing.
if ! command -v dotnet >/dev/null 2>&1; then
  echo "==> Installing .NET 8 SDK"
  curl -fsSL https://dot.net/v1/dotnet-install.sh -o /tmp/dotnet-install.sh
  chmod +x /tmp/dotnet-install.sh
  sudo /tmp/dotnet-install.sh --channel 8.0 --install-dir /usr/share/dotnet
  sudo ln -sf /usr/share/dotnet/dotnet /usr/local/bin/dotnet
fi
echo "==> dotnet $(dotnet --version)"

# Root + workspace JS dependencies. apps/web and infra are npm workspaces, so a
# single root `npm ci` installs the web app and CDK infra dependencies too.
echo "==> Installing root/workspace npm dependencies"
npm ci

# AppSync resolver Lambda deps — required so `npm run infra:synth` can esbuild-
# bundle infra/lambdas/appsync-resolver/index.js against the AWS SDK v3 packages.
# This package has its own lockfile and is not part of the root workspaces.
echo "==> Installing AppSync resolver Lambda dependencies"
npm ci --prefix infra/lambdas/appsync-resolver

# Restore .NET dependencies for the API so build/test start fast.
echo "==> Restoring .NET API dependencies"
dotnet restore apps/api/GetTrainMate.Api.csproj

echo "==> Install complete"
