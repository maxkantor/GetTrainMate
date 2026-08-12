# Growth secrets setup (SSM + GA4 Viewer)

Never commit credential files or paste secrets into git, chat logs, or experiment JSON.

## SSM parameter names

| Env var (Cursor Automation / shell) | SSM path | Type |
|-------------------------------------|----------|------|
| `GA4_PROPERTY_ID` | `/gettrainmate/growth/ga4-property-id` | String |
| `GOOGLE_ANALYTICS_CREDENTIALS_JSON` | `/gettrainmate/growth/google-analytics-credentials-json` | SecureString |
| `STRIPE_RESTRICTED_READ_KEY` | `/gettrainmate/growth/stripe-restricted-read-key` | SecureString |

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

cd C:\Apps\GetTrainMate
.\scripts\growth\put-ssm-secrets.ps1
node .\scripts\growth\verify-secrets.mjs
```

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

## Cursor Cloud Agent secrets (required for Wednesday Automation)

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
| `ADMIN_EMAIL` or `SES_ADMIN_EMAIL` | Optional (else SSM `/gettrainmate/ses-admin-email`) |
| `SES_FROM_EMAIL` | Optional (else SSM `/gettrainmate/ses-from-email`) |

4. On the Automation (**GetTrainMate Wednesday Customer Growth**):
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

### IAM permissions (growth automation user)

- `ssm:GetParameter` on `/gettrainmate/growth/*`, `/gettrainmate/ses-admin-email`, `/gettrainmate/ses-from-email`
- `ses:SendEmail` for verified `gettrainmate.com` identity
- `kms:Decrypt` via SSM for SecureString params

## Verify SSM from your laptop (safe)

```bash
node scripts/growth/verify-secrets.mjs
```

Prints only `present` / `missing` / `type` — never values.
