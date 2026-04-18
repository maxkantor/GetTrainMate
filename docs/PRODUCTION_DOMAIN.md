# Production domain: https://gettrainmate.com

Canonical public origin is **apex HTTPS** (`https://gettrainmate.com`). SEO static files (`public/robots.txt`, `public/sitemap.xml`) and frontend fallbacks use this host.

## Codebase audit (URLs and environment)

| Area | Location | Notes |
|------|----------|--------|
| Site / SEO origin | `apps/web/src/config/site.ts` | `SITE_ORIGIN` default; set `VITE_PUBLIC_SITE_URL` in Amplify for explicit control. |
| OG / build-time meta | `apps/web/vite.config.ts` | Injects canonical/OG when `VITE_PUBLIC_SITE_URL` is set at build. |
| Per-route SEO | `apps/web/src/components/seo/DocumentSeo.tsx`, `config/seoRoutes.ts` | Uses `SITE_ORIGIN` / `absoluteUrl()`. |
| API base (web) | `apps/web/src/config/api.ts` | `VITE_API_URL` required for real API; CI uses deploy fallback URL if unset. |
| Dev proxy | `apps/web/vite.config.ts` | `localhost:3001` — dev only. |
| Auth (Cognito) | `apps/web/src/services/authService.ts` | Pool IDs from `VITE_COGNITO_*`; **callback URLs** must be set in Cognito for production. |
| Stripe success/cancel | `apps/api/Services/CreditsService.cs` | Built from `BillingController` base URL (`Origin` → `FRONTEND_URL` / `Frontend:BaseUrl`). |
| Subscriptions checkout | `apps/api/Services/PaymentService.cs` | Requires `FRONTEND_URL` env. |
| Email deep links | `apps/api/Services/ChatNotificationService.cs` | `FRONTEND_URL` → `Frontend:BaseUrl` → production default. |
| AppSync resolver links | `infra/lambdas/appsync-resolver/index.js` | `FRONTEND_URL` env on Lambda; fallback in code is last resort only. |
| Backend default frontend | `apps/api/appsettings.json`, `appsettings.Development.json` | Production default apex; Development overrides localhost. |
| Amplify SPA rewrites | `amplify.yml` | `customRedirects` → `index.html` for client routes. |
| Robots / sitemap | `apps/web/public/robots.txt`, `sitemap.xml` | Apex URLs and sitemap reference. |

## Required environment (production)

### AWS Amplify (hosting build)

Set in **Amplify Console → App → Environment variables** (branch that builds production):

| Variable | Example | Purpose |
|----------|---------|---------|
| `VITE_PUBLIC_SITE_URL` | `https://gettrainmate.com` | Canonical origin, OG image URLs, JSON-LD. |
| `VITE_API_URL` | `https://YOUR_API_ID.execute-api.us-east-1.amazonaws.com` | REST API base (must match deployed API). |
| `VITE_COGNITO_USER_POOL_ID` | `us-east-1_xxx` | Same pool as production users. |
| `VITE_COGNITO_CLIENT_ID` | `xxx` | App client for hosted UI / SDK. |
| `VITE_COGNITO_REGION` | `us-east-1` | Optional; default us-east-1. |
| `VITE_APPSYNC_GRAPHQL_URL` | (if using GraphQL) | AppSync endpoint. |

### API / Lambda (or wherever the .NET API runs)

| Variable / config | Example | Purpose |
|-------------------|---------|---------|
| `FRONTEND_URL` | `https://gettrainmate.com` | Must be a full `https://…` URL (never `app` or a path only). Used for Stripe checkout, chat “Reply now” links (API + AppSync resolver), payment flows. |
| `Frontend:BaseUrl` in appsettings / env | Same | Chat email links, notification URLs, fallback for billing base URL. |

Stripe keys remain in SSM / env as documented in `docs/STRIPE_SSM_SETUP.md` (no change to pricing logic).

## Manual steps outside the repo

1. **DNS**  
   - Point apex `gettrainmate.com` to Amplify (or your host) per Amplify custom domain wizard.  
   - Add `www` if you use it, then configure redirect (see below).

2. **Amplify custom domain**  
   - Attach `gettrainmate.com` (and optionally `www.gettrainmate.com`).  
   - **www → apex:** Amplify Console → *Domain management* → enable “Redirect www to root” (or equivalent), **or** configure at DNS/registrar. `amplify.yml` path redirects **cannot** match hostnames; domain redirects are console/DNS.

3. **Amazon Cognito**  
   - App client **Callback URLs** and **Sign out URLs**: include `https://gettrainmate.com/...` paths you use (e.g. `/`, `/login`, OAuth return paths).  
   - Remove localhost URLs from **production** app client if you use a separate client for prod.

4. **Stripe Dashboard**  
   - **Customer email** links and **Checkout** allowed domains: allow `gettrainmate.com`.  
   - Webhook endpoint URL is your **API** URL (API Gateway / custom API domain), not the marketing domain — ensure it still matches deployed Lambda.

5. **API Gateway / CORS**  
   - Current API middleware allows any origin (`*`). If you tighten CORS later, allow `https://gettrainmate.com` (and `https://www.gettrainmate.com` only if you serve traffic there before redirect).

6. **Google Search Console / Analytics**  
   - Add property for `https://gettrainmate.com` (and migrate from www if you previously used www).  
   - Submit sitemap: `https://gettrainmate.com/sitemap.xml`.

## Post-deploy verification checklist

- [ ] Homepage loads at `https://gettrainmate.com/`
- [ ] Direct URL refresh works on nested routes (e.g. `/pricing`, `/app/discover`) — SPA rewrite returns `index.html`
- [ ] `www` redirects to apex (if configured) with 301/302
- [ ] Login / signup / Google OAuth complete without redirect errors
- [ ] Credits checkout returns to `/billing/success` or cancel on **gettrainmate.com**
- [ ] Images and static assets load (no mixed `http://` on HTTPS page)
- [ ] View source or DevTools: canonical and `og:url` use `https://gettrainmate.com`
- [ ] `robots.txt` and `sitemap.xml` use apex host
- [ ] Production build does not **require** localhost (Amplify env vars set)
- [ ] API calls succeed from production origin (no CORS errors if policy tightened later)
- [ ] Chat notification emails (if enabled) link to `https://gettrainmate.com/...`
