# SEO, Google Search Console, and Google Analytics 4

Production domain (canonical): **https://gettrainmate.com**

## Environment variables (`apps/web`)

| Variable | Purpose |
|----------|---------|
| `VITE_PUBLIC_SITE_URL` | Canonical origin (no trailing slash). Used for OG URLs, JSON-LD, and SPA `page_location` in GA4. Default in code: `https://gettrainmate.com`. |
| `VITE_GA_MEASUREMENT_ID` | GA4 Measurement ID. **Production builds** default to `G-VRYT23K2D4` if unset. In local dev, gtag stays off unless you set this in `.env`. |
| `VITE_GSC_VERIFICATION` | **Google Search Console** HTML tag verification: paste the **content** value only (not the full meta tag). Injected at build into `index.html` via `vite.config.ts`. |
| `VITE_THEME_COLOR` | Browser UI theme color (default `#070b1a`). |

## Google Search Console verification

1. In [Search Console](https://search.google.com/search-console), add the **URL prefix** property `https://gettrainmate.com/`.
2. Choose **HTML tag** verification.
3. Copy the **content** attribute value from the meta tag Google shows.
4. Set `VITE_GSC_VERIFICATION` to that string in Amplify (or `.env` for local build) and redeploy the web app.
5. Click **Verify** in Search Console.

## Sitemap

- Static file: `apps/web/public/sitemap.xml` (deployed as `/sitemap.xml`).
- In Search Console: **Sitemaps** → submit `https://gettrainmate.com/sitemap.xml`.

## Request indexing for priority URLs

In Search Console → **URL inspection**, enter a public URL (e.g. `https://gettrainmate.com/pricing`), then **Request indexing** if offered. Use for key landing pages after major content changes.

## Google Analytics 4 — Realtime

1. Deploy the production web build (measurement ID `G-VRYT23K2D4` is baked in unless you override `VITE_GA_MEASUREMENT_ID`).
2. Open GA4 → **Reports** → **Realtime**.
3. Visit the site in another window; you should see active users and `page_view` events for SPA navigations.

Custom events (e.g. `sign_up`, `login`, `begin_checkout`, `purchase`) appear under **Events** after processing; use **Realtime** event count for immediate checks.

## Open Graph image

Place a **1200×630** PNG at `apps/web/public/images/og-image.png`. Until it exists, crawlers still receive an absolute image URL that may 404 — add the asset before launch marketing.

## Robots

`apps/web/public/robots.txt` references the sitemap and disallows private areas (`/app`, `/admin`, auth, `/billing`, etc.). Adjust if you add new public marketing routes and regenerate `sitemap.xml` to match.
