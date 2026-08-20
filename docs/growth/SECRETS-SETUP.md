# Growth secrets setup (SSM + GA4 Viewer)

Never commit credential files or paste secrets into git, chat logs, or experiment JSON.

## SSM parameter names

| Env var (Cursor Automation / shell) | SSM path | Type |
|-------------------------------------|----------|------|
| `GA4_PROPERTY_ID` | `/gettrainmate/growth/ga4-property-id` | String |
| `GOOGLE_ANALYTICS_CREDENTIALS_JSON` | `/gettrainmate/growth/google-analytics-credentials-json` | SecureString |
| `STRIPE_RESTRICTED_READ_KEY` | `/gettrainmate/growth/stripe-restricted-read-key` | SecureString |
| `GROWTH_METRO_READ_TOKEN` | `/gettrainmate/growth/metro-read-token` | SecureString (optional; preferred metro path) |
| `GROWTH_CRM_ADMIN_EMAIL` | `/gettrainmate/growth/crm-admin-email` | String (optional fallback) |
| `GROWTH_CRM_ADMIN_PASSWORD` | `/gettrainmate/growth/crm-admin-password` | SecureString (optional fallback) |
| `META_PAGE_ACCESS_TOKEN` | `/gettrainmate/growth/meta-page-access-token` | SecureString (Page token; Facebook + Instagram publish) |
| `FACEBOOK_PAGE_ID` | `/gettrainmate/growth/facebook-page-id` | String |
| `INSTAGRAM_GRAPH_ACCESS_TOKEN` | `/gettrainmate/growth/instagram-graph-access-token` | SecureString (optional if Page token already covers IG) |
| `INSTAGRAM_BUSINESS_ACCOUNT_ID` | `/gettrainmate/growth/instagram-business-account-id` | String |
| `INSTAGRAM_USERNAME` | `/gettrainmate/growth/instagram-username` | String (`gettrainmate`; documentation only) |
| `AWS_ACCESS_KEY_ID` | `/gettrainmate/growth/aws-access-key-id` | String |
| `AWS_SECRET_ACCESS_KEY` | `/gettrainmate/growth/aws-secret-access-key` | SecureString |

Measurement ID on the site remains **`G-C29M8NWNY4`** (set as `VITE_GA_MEASUREMENT_ID` in Amplify — not a secret). **Property ID** is the numeric GA4 property (Admin → Property settings).

Existing app SES paths (used by growth email scripts):

| Purpose | SSM path |
|---------|----------|
| Admin inbox | `/gettrainmate/ses-admin-email` (comma-separated allowed) |
| SES from | `/gettrainmate/ses-from-email` |

## One-time put (from your machine)

```powershell
# Set env vars in THIS shell only (do not echo them):
$env:GA4_PROPERTY_ID = "123456789"   # numeric property id
$env:GOOGLE_ANALYTICS_CREDENTIALS_JSON = Get-Content -Raw path\to\ga4-sa.json
$env:STRIPE_RESTRICTED_READ_KEY = "rk_live_..."  # restricted read-only key
$env:AWS_ACCESS_KEY_ID = "AKIA..."
$env:AWS_SECRET_ACCESS_KEY = "..."

cd C:\Apps\GetTrainMate
.\scripts\growth\put-ssm-secrets.ps1
node .\scripts\growth\verify-secrets.mjs
```

**Note:** `ssm:PutParameter` requires an admin or deployer IAM user. The read-only growth user (`cursor-gettrainmate-growth`) can **read** these params but cannot create them. If `put-ssm-secrets.ps1` fails with AccessDenied, run it from a shell using your admin AWS profile, or paste the keys into [Cursor Cloud Agents → Environment → Secrets](https://cursor.com/dashboard/cloud-agents) instead.

## Stripe restricted key (read-only)

1. Stripe Dashboard → Developers → API keys → Restricted keys → Create.
2. Allow **read** only for: Checkout Sessions, Payment Intents, Charges, Customers, Prices, Products, Balance transactions (as needed for reporting).
3. Deny all write / webhook / payout permissions.
4. Use `rk_live_…` for production reporting (never store full `sk_live` in growth SSM).

## Google service account + GA4 Viewer

1. Google Cloud Console → create (or reuse) a service account for analytics read.
2. Create a JSON key; keep it only in SSM / Automation secrets.
3. Enable [Google Analytics Data API](https://console.cloud.google.com/apis/library/analyticsdata.googleapis.com) for the GCP project.
4. GA4 Admin → **Property access management** for GetTrainMate (`G-C29M8NWNY4`):
   - Add the service account email (`…@….iam.gserviceaccount.com`)
   - Role: **Viewer**
5. Confirm `GA4_PROPERTY_ID` matches the numeric property tied to `G-C29M8NWNY4`.

## Cursor Cloud Agent secrets (required for weekday Automation)

Secrets do **not** live on the Automations Settings page alone. They live here:

1. Open [cursor.com/dashboard/cloud-agents](https://cursor.com/dashboard/cloud-agents)
2. Open the **Environment** for `maxkantor/GetTrainMate` (must be **Ready**)
3. **Secrets** → ensure these names exist:

| Name | Required |
|------|----------|
| `AWS_ACCESS_KEY_ID` | Yes (SES + SSM) |
| `AWS_SECRET_ACCESS_KEY` | Yes |
| `AWS_REGION` | Yes → `us-east-1` |
| `GA4_PROPERTY_ID` | Yes (or load via SSM with AWS) |
| `GOOGLE_ANALYTICS_CREDENTIALS_JSON` | Yes (or via SSM) |
| `STRIPE_RESTRICTED_READ_KEY` | Yes (`rk_…` only) |
| `STRIPE_GTM_PRICE_IDS` | Optional comma-separated Price IDs allowlist |
| `STRIPE_GTM_PRODUCT_IDS` | Optional Product IDs allowlist |
| `STRIPE_GTM_PAYMENT_LINK_IDS` | Optional Payment Link IDs allowlist |
| `STRIPE_GTM_EXCLUDE_CUSTOMER_IDS` | Optional owner/self/smoke customer ids to exclude |
| `GROWTH_METRO_READ_TOKEN` | Recommended — same value as API Lambda `GROWTH_METRO_READ_TOKEN` / SSM `/gettrainmate/growth/metro-read-token` |
| `GROWTH_CRM_ADMIN_EMAIL` / `GROWTH_CRM_ADMIN_PASSWORD` | Optional fallback if metro read token not set |
| `ADMIN_EMAIL` or `SES_ADMIN_EMAIL` | Optional (else SSM `/gettrainmate/ses-admin-email`) |
| `SES_FROM_EMAIL` | Optional (else SSM `/gettrainmate/ses-from-email`) |
| `META_PAGE_ACCESS_TOKEN` | Required for weekday Facebook+Instagram publish (Page token) |
| `FACEBOOK_PAGE_ID` | Required for Facebook Page posts |
| `INSTAGRAM_BUSINESS_ACCOUNT_ID` | Required for Instagram Graph publish |
| `INSTAGRAM_GRAPH_ACCESS_TOKEN` | Optional if the Page token already covers IG |

4. On the Automation (**GetTrainMate Customer Growth**, weekdays 10:00 AM Eastern):
   - Repo must be **GetTrainMate** / `main`
   - Instructions must call `compose-and-send-growth-email.mjs`

5. **Test:**
   ```bash
   npm i --prefix scripts/growth
   node scripts/growth/print-env-secret-presence.mjs
   node scripts/growth/verify-secrets.mjs
   node scripts/growth/check-production-health.mjs
   node scripts/growth/compose-and-send-growth-email.mjs --dry-run
   node scripts/growth/compose-and-send-growth-email.mjs --notes "Manual setup smoke test"
   ```

### IAM permissions (growth automation user `cursor-gettrainmate-growth`)

- `ses:SendEmail` / `ses:SendRawEmail`
- `ssm:GetParameter` / `ssm:GetParameters` on `/gettrainmate/growth/*`, `/gettrainmate/ses-admin-email`, `/gettrainmate/ses-from-email`
- `kms:Decrypt` via `ssm.us-east-1.amazonaws.com` for SecureString params

If Admin email fails in Automations with “SSM get failed”, either fix that IAM policy or add Cursor Environment secrets `SES_FROM_EMAIL` and `SES_ADMIN_EMAIL` (same values as the SSM params).

## Metro density (approved separate CRM path)

Do **not** grant DynamoDB/Cognito/SSM app-data read to the SES growth IAM user.

Preferred path:

1. Generate a long random token (e.g. `openssl rand -hex 32`).
2. Store as SecureString `/gettrainmate/growth/metro-read-token`.
3. Set API Lambda environment `GROWTH_METRO_READ_TOKEN` to the same value (Console or CDK).
4. Put the same value in Cursor Cloud Agent secrets as `GROWTH_METRO_READ_TOKEN`.
5. Growth scripts call `GET /api/admin/metrics/metro` with header `X-Growth-Metro-Token`.

Fallback: `GROWTH_CRM_ADMIN_EMAIL` + `GROWTH_CRM_ADMIN_PASSWORD` (Admin login → `X-Admin-Token`). Prefer the scoped metro token.

## Meta Graph (Facebook Page + Instagram)

Owned channels: https://www.facebook.com/gettrainmate and https://www.instagram.com/gettrainmate/

**Canonical SSM (us-east-1 only under `/gettrainmate/growth/*`):**

| Purpose | SSM path | Type |
|---------|----------|------|
| Page access token | `/gettrainmate/growth/meta-page-access-token` | SecureString |
| Facebook Page id | `/gettrainmate/growth/facebook-page-id` | String (`1138684902641972`) |
| IG business account id | `/gettrainmate/growth/instagram-business-account-id` | String (`17841434503711452`) |
| IG username | `/gettrainmate/growth/instagram-username` | String (`gettrainmate`) |
| Meta App id | `/gettrainmate/growth/meta-app-id` | String |
| Meta App secret | `/gettrainmate/growth/meta-app-secret` | SecureString |
| Token metadata | `meta-token-installed-at`, `meta-token-expires-at`, `meta-token-last-validated-at`, `meta-token-type` | String (no secrets) |

Leftover `/prod/gettrainmate/meta/*` parameters were deleted. Growth never reads `/prod`.

### One-time / renewal (do not paste Page tokens manually)

Short-lived Graph Explorer **User** tokens expire in ~1–2 hours. Always exchange via the setup script:

```powershell
# One-time: store Meta App ID + App Secret (admin AWS profile)
$env:META_APP_ID = "<app_id>"
$env:META_APP_SECRET = "<app_secret>"
.\scripts\growth\put-ssm-secrets.ps1

# Each renewal: temporary User token only (never paste into chat)
$env:META_TEMP_USER_TOKEN = "<short-lived User token from Graph API Explorer>"
node scripts/growth/setup-meta-token.mjs
Remove-Item Env:META_TEMP_USER_TOKEN
```

The script: long-lived User exchange → `/me/accounts` → GetTrainMate Page token → validate Page + Instagram → SSM SecureString. Daily automation **validates then publishes**; it does **not** mint a new token each day.

Never commit, log, or email the Page token or App Secret.

Partner email stays fail-closed independently.

## Verify SSM from your laptop (safe)

```bash
node scripts/growth/verify-secrets.mjs
```

Prints only `present` / `missing` / `type` — never values.
