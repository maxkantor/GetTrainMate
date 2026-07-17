# SEO, Google Search Console, and Google Analytics 4

Production domain (canonical): **https://gettrainmate.com**

## Environment variables (`apps/web`)

| Variable | Purpose |
|----------|---------|
| `VITE_PUBLIC_SITE_URL` | Canonical origin (no trailing slash). Used for OG URLs, JSON-LD, and SPA `page_location` in GA4. Default in code: `https://gettrainmate.com`. |
| `VITE_GA_MEASUREMENT_ID` | GA4 Measurement ID (e.g. `G-xxxxxxxxxx`). **Required** for GA in any build: set in **Amplify → Environment variables** (recommended) or `apps/web/.env`. Not hardcoded in the app — if unset, gtag does not load. |
| `VITE_GSC_VERIFICATION` | **Google Search Console** HTML tag verification: paste the **content** value only (not the full meta tag). Injected at build into `index.html` via `vite.config.ts`. |
| `VITE_THEME_COLOR` | Browser UI theme color (default `#070b1a`). |

## Google Search Console verification

1. In [Search Console](https://search.google.com/search-console), add the **URL prefix** property `https://gettrainmate.com/`.
2. Choose **HTML tag** verification.
3. Copy the **content** attribute value from the meta tag Google shows.
4. Set `VITE_GSC_VERIFICATION` to that string in Amplify (or `.env` for local build) and redeploy the web app.
5. Click **Verify** in Search Console.

## Sitemap

- Generated at build: `scripts/generate-sitemap.mjs` → `apps/web/public/sitemap.xml` (deployed as `/sitemap.xml`).
- In Search Console: **Sitemaps** → submit `https://gettrainmate.com/sitemap.xml`.

## Prerendered HTML for crawlers (critical)

Googlebot often does **not** wait for React. Marketing URLs must ship unique static HTML (title, description, canonical, OG, JSON-LD).

- Plugin: `apps/web/vite-plugin-prerender-seo.ts` writes `dist/<route>/index.html` for pricing, about, FAQ, World Cup hub, team pages, etc.
- Amplify `customRules` (root of `amplify.yml`) must:
  1. Rewrite extensionless paths like `/world-cup` → `/world-cup/index.html`
  2. **Exclude `.html`** from the SPA catch-all, or prerendered shells are overwritten by the homepage

After deploy, verify with curl (or “View page source”) that `https://gettrainmate.com/world-cup` shows canonical `…/world-cup` — not `…/`.

## Request indexing for priority URLs

In Search Console → **URL inspection**, enter a public URL (e.g. `https://gettrainmate.com/pricing` or `/world-cup`), then **Request indexing** if offered. Use for key landing pages after major content changes.

## World Cup retirement (keep marketing SEO at 100%)

Product off (Admin) and SEO off (build/CDN) are **separate**.

### While the tournament is live (now)

- Leave Amplify env `WORLD_CUP_SEO` unset or `true`
- Keep `deploy/amplify-custom-rules.json` / `amplify.yml` WC → nested `index.html` (200)
- Marketing pages (`/`, `/pricing`, `/about`, …) are always prerendered independently of WC

### When you turn the hub off next week

1. **Product (immediate):** Admin → disable `sports_event_layer` and/or `world-cup-2026` `enabled` (hides nav, promo, hub UI).
2. **SEO (required deploy):**
   - Amplify Console → set `WORLD_CUP_SEO=false` (also sets `VITE_WORLD_CUP_SEO` via `amplify.yml`)
   - Apply retired redirects:
     ```bash
     aws amplify update-app --app-id d3tocp1533tn5q --custom-rules file://deploy/amplify-custom-rules-wc-retired.json
     ```
     (301 `/world-cup*`, `/events/world-cup-2026` → `/`; marketing 200s unchanged)
   - Push/redeploy so sitemap + prerender omit WC shells
3. **Search Console:** resubmit `sitemap.xml`; URL Inspection on `/world-cup` should show 301 to `/`
4. Optional: Removals tool for old WC URLs if Google still shows stale snippets

Do **not** rely on Admin toggle alone for SEO — crawlers would still get live WC HTML and sitemap entries until steps 2–3.

### Env reference

| Variable | Effect |
|----------|--------|
| `WORLD_CUP_SEO=true` (default) | Sitemap + prerender include WC hub/teams |
| `WORLD_CUP_SEO=false` | Sitemap + prerender = marketing only; client WC routes get `noindex` |

Marketing SEO (`/pricing`, `/about`, `/faq`, `/contact`, `/platform`, `/privacy`, `/terms`) is **never** gated by this flag.

## Google Analytics 4 — Realtime

**Where SPA tracking runs:** `Ga4Bootstrap` is mounted in `Router.tsx` inside `<BrowserRouter>`. It calls `usePageTracking()` (`apps/web/src/hooks/usePageTracking.ts`), which loads `gtag.js` once (`initGa4` in `apps/web/src/lib/gtag.ts` with `send_page_view: false`) and sends a manual `page_view` on each navigation (pathname + search; `page_location` uses the current `window.location.href`).

1. Deploy the production web build with `VITE_GA_MEASUREMENT_ID` set in Amplify (Vite injects it at build time into the client bundle).
2. Open GA4 → **Reports** → **Realtime** for the property that matches that measurement ID.
3. Visit the site in another window; you should see active users and `page_view` events when you move between routes (SPA client-side navigations are tracked).

**Local testing:** Set `VITE_GA_MEASUREMENT_ID` in `apps/web/.env` to the same value as Amplify, run the dev server, open DevTools → **Network**, filter by `collect` or `google-analytics`, and navigate between routes. You should see requests to `google-analytics.com/g/collect` (or `analytics.google.com`).

Custom events (e.g. `sign_up`, `login`, `begin_checkout`, `purchase`) appear under **Events** after processing; use **Realtime** event count for immediate checks.

## Open Graph image

Place a **1200×630** JPG at `apps/web/public/images/og-image.jpg`, and keep it comfortably below 2MB (recommended: a few hundred KB for chat apps). At build time, `vite.config.ts` injects `og:image` and `twitter:image` with an **absolute** URL (`https://gettrainmate.com/images/og-image.jpg?v=2` by default). Facebook and other scrapers require absolute URLs; if `VITE_PUBLIC_SITE_URL` was missing, older builds used a relative path and previews showed no image.

After deploy, use [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/) → **Scrape Again** to refresh the cache.

## Robots

`apps/web/public/robots.txt` allows all crawlers (`Allow: /`) and references the sitemap. Admin routes still use `noindex` in `seoRoutes.ts` (meta only). Regenerate or extend `sitemap.xml` when you add new public marketing routes.
