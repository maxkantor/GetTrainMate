#!/usr/bin/env bash
# Delete Cognito User Pools in us-east-1 except the one in apps/web/.env (VITE_COGNITO_USER_POOL_ID).
# Requires: AWS CLI configured with cognito-idp:ListUserPools, DeleteUserPool.
# Usage: ./scripts/delete-obsolete-cognito-pools.sh [--dry-run]
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$ROOT/apps/web/.env"
REGION="${AWS_REGION:-us-east-1}"
DRY_RUN=false
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=true

if [[ -f "$ENV_FILE" ]]; then
  KEEP_POOL_ID=$(grep -E '^VITE_COGNITO_USER_POOL_ID=' "$ENV_FILE" | cut -d= -f2- | tr -d '\r' | xargs)
fi
if [[ -z "$KEEP_POOL_ID" ]]; then
  echo "Missing VITE_COGNITO_USER_POOL_ID in $ENV_FILE. Set KEEP_POOL_ID=us-east-1_XXX to override."
  exit 1
fi

echo "Region: $REGION | Keep: $KEEP_POOL_ID"
[[ "$DRY_RUN" == "true" ]] && echo "DRY RUN - no pools will be deleted"
echo ""

# List all pool IDs (paginate)
all_ids=""
NEXT=""
while true; do
  if [[ -n "$NEXT" ]]; then
    resp=$(aws cognito-idp list-user-pools --max-results 10 --region "$REGION" --starting-token "$NEXT")
  else
    resp=$(aws cognito-idp list-user-pools --max-results 10 --region "$REGION")
  fi
  ids=$(echo "$resp" | grep -oE 'us-east-1_[A-Za-z0-9]+' | sort -u)
  all_ids="$all_ids $ids"
  NEXT=$(echo "$resp" | grep -oE '"NextToken"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed -n 's/.*"\([^"]*\)"$/\1/p')
  [[ -z "$NEXT" ]] && break
done

for pool_id in $all_ids; do
  [[ -z "$pool_id" ]] && continue
  if [[ "$pool_id" == "$KEEP_POOL_ID" ]]; then
    echo "Keep: $pool_id"
  else
    echo "Delete: $pool_id"
    if [[ "$DRY_RUN" != "true" ]]; then
      aws cognito-idp delete-user-pool --user-pool-id "$pool_id" --region "$REGION" || echo "  failed"
    fi
  fi
done
echo "Done."
