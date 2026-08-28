# Admin API — CORS errors (what they really mean)

## Symptom

Browser DevTools shows:

```text
Access to fetch at 'https://….execute-api.us-east-1.amazonaws.com/api/admin/…'
from origin 'https://gettrainmate.com' has been blocked by CORS policy:
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

Admin UI may show **Failed to fetch** even though you are logged in.

## Root cause (most common)

**API Gateway HTTP API has a ~30 second integration timeout.** If the Lambda does not return a response in time, API Gateway returns **504/503 with no CORS headers**. The browser labels that as a CORS failure — it is usually a **timeout**, not a misconfigured `Allow-Origin`.

Partner discovery (Overpass + many HTTP email checks) can exceed 30s in one request.

## What we did in code

- **Admin Partner Outreach** runs **one seed org per API call** (`onlyPartnerCode`) so each request stays under the limit.
- ASP.NET returns **503 with JSON** (and CORS) if the server-side budget is exceeded before API Gateway kills the request (`Startup.cs` → `UseCors("AllowAll")`).
- CORS is owned **only in Lambda** (`apps/api/Startup.cs`). CDK `HttpApi` `corsPreflight` was removed because it duplicated headers on successful responses.

## Manual checks

### 1. Confirm API is up and CORS works (fast endpoint)

```bash
curl -sS -D - -o /dev/null \
  -H "Origin: https://gettrainmate.com" \
  "https://goskwzjzjg.execute-api.us-east-1.amazonaws.com/api/health"
```

Expect `HTTP/2 200` and `access-control-allow-origin: *` (or your origin).

### 2. Confirm discovery timeout vs CORS

```bash
curl -sS -D - -o /tmp/out.json \
  -H "Origin: https://gettrainmate.com" \
  -H "Content-Type: application/json" \
  -H "X-Admin-Token: YOUR_ADMIN_TOKEN" \
  -X POST \
  -d '{"seedsOnly":true,"onlyCampaignId":"us_atlanta_train_partners","onlyPartnerCode":"atl-track-club","prepareDrafts":true}' \
  "https://goskwzjzjg.execute-api.us-east-1.amazonaws.com/api/admin/partner-outreach/discover/automated"
```

- **200/503 with JSON** → CORS is fine; read `out.json` for results or `discovery_timeout`.
- **504 with no `access-control-allow-origin`** → request still too slow or API not deployed with latest timeout fixes.

### 3. Run discovery outside the browser (no CORS)

```bash
export GROWTH_CRM_ADMIN_EMAIL=you@example.com
export GROWTH_CRM_ADMIN_PASSWORD='…'
export DISCOVERY_CAMPAIGN_ID=us_atlanta_train_partners
node scripts/growth/run-market-discovery.mjs
```

CLI uses the same API but is not subject to browser CORS.

## If you need to change CORS yourself

| Layer | File | Notes |
|-------|------|--------|
| ASP.NET CORS policy | `apps/api/Startup.cs` | `AddCors` → `AllowAll` policy; `UseCors` before auth middleware |
| Do **not** duplicate | `infra/stacks/main-stack.ts` | Avoid `HttpApi` `corsPreflight` + Lambda CORS together (double `Access-Control-Allow-Origin`) |
| HTTPS redirect in Lambda | `Startup.cs` | Disabled when `AWS_LAMBDA_FUNCTION_NAME` is set — redirects break OPTIONS |
| Admin preflight | `AdminAuthorizationMiddleware.cs` | Skips `OPTIONS` |

To allow a new frontend origin, update the CORS policy in `Startup.cs` (replace `AllowAnyOrigin()` with `WithOrigins("https://gettrainmate.com", "https://www.gettrainmate.com")` if you need credentials later).

Redeploy API after any `Startup.cs` change:

```bash
# Commit triggers CI, or locally:
npm run zip   # rebuilds deploy/gettrainmate-api-lambda.zip
# then deploy Lambda via your usual CDK/GitHub Actions pipeline
```

## Operational rule

**Any admin POST that can run longer than ~25s** must be split (batch/job), run via CLI, or invoked on a schedule (EventBridge → Lambda directly, 60s timeout) — not a single browser `fetch` through API Gateway.
