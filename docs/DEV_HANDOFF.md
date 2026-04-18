# Developer handoff — do not regress these fixes

Read this before changing **admin web**, **API/Lambda**, **CDK**, or **S3 media**. Copy this repo (or pull `main`) on a new PC; the file lives at `docs/DEV_HANDOFF.md`.

---

## 1. Admin API CORS (CRM / `gettrainmate.com` → API Gateway)

**What was wrong:** Duplicate CORS layers and/or `OPTIONS` not returning 2xx (e.g. HTTPS redirect inside Lambda) → browser blocked admin fetches (“preflight failed”).

**Current design:**

- **`infra/stacks/main-stack.ts`** — HTTP API (`HttpApi`) has **no** `corsPreflight` block. API Gateway must **not** add its own CORS on top of the Lambda response for this stack.
- **`apps/api/Startup.cs`** — **Always** `UseRouting()` then `UseCors("AllowAll")` (including when `AWS_LAMBDA_FUNCTION_NAME` is set). **`UseHttpsRedirection()`** runs **only when not in Lambda** (TLS is terminated at API Gateway).

**Do not:**

- Re-enable CDK `corsPreflight` on the HTTP API **and** full ASP.NET CORS without verifying the browser (duplicate `Access-Control-Allow-*` or bad `OPTIONS`).
- Enable `UseHttpsRedirection()` inside Lambda without testing admin CRM from the real site.

**Deleted:** `apps/api/Middleware/CorsMiddleware.cs` — CORS is owned by `UseCors` only.

---

## 2. S3 profile media / “wrong bucket” / CRM images

**Symptoms:** CRM image previews broken; CloudWatch logs about pinning a different bucket than `MEDIA_BUCKET_NAME`.

**Relevant code:** `apps/api/Services/S3StorageService.cs`

- ListBuckets discovery **ranks** buckets (prefer `gettrainmate-media-bucket`, short `*-media-bucket`, **last** long `…-{account}-…` Amplify-style names).
- **`_discoveredMediaBucketCache`** — all `train`+`media` matches are tried for reads, not only the pinned bucket.
- Hardcoded fallbacks include **`getrainmate-media-bucket`** (typo) where applicable.

**CDK IAM:** `infra/stacks/main-stack.ts` — Lambda needs access to both `gettrainmate-*` and **`getrainmate-*`** S3 prefixes if that typo bucket exists in the account.

**Production hygiene:** Set Lambda **`MEDIA_BUCKET_NAME`** (and CDK context) to the bucket that **actually** holds `profiles/...` keys so discovery is a safety net, not the source of truth.

---

## 3. Users CRM profile photos + detail panel race

**API:** `apps/api/Controllers/AdminUsersController.cs` — `UserListItem.CoverPhotoUrl` for **`GET /api/admin/users`**: first **`photoUrls`** entry, or legacy **`photoKeys` / `photoKey`** (S3 key) turned into a canonical URL via **`IStorageService.GetPublicUrl`**.

**API:** `apps/api/Services/ProfileService.cs` — **`GetProfileForAdminAsync`** calls **`HydratePhotoUrlsFromLegacyKeys`** so admin **`GET /api/admin/users/{id}`** and **`photos/stream`** see **`PhotoUrls`** even when Dynamo only stored keys (many production profiles).

**Web:** `apps/web/src/pages/admin/UsersPage.tsx`, **`apps/web/src/utils/adminCrmPhotos.ts`**, `apps/web/src/utils/adminApiNormalize.ts`

- Detail load uses a **generation ref** so a slow `GET /api/admin/users/{id}` cannot overwrite a **newer** row click.
- Detail body comes from **`normalizeAdminUserDetail(api)`** only (no `{...row, ...detail}` merge for success path).

**Do not** remove the fetch-generation guard when “optimizing” loads.

---

## 4. Cursor rules (optional automation)

**`.cursor/rules/`**

- `frontend-ts-push.mdc` — after `apps/web/**/*.ts*` changes: build / commit / push as described there.
- `backend-lambda-zip.mdc` — after `apps/api/**` changes: `npm run api:publish` or `npm run zip:publish`; commit source (not ignored `publish/` or `deploy/*.zip`).

---

## 5. Deploy reminders

- **Lambda code in AWS** is updated by **`cdk deploy`** (bundles `apps/api/publish`). Run **`dotnet publish`** (or `npm run api:publish`) first so `publish/` is fresh.
- **`deploy/gettrainmate-api-lambda.zip`** is **gitignored**; it is for manual / scripted uploads, not the Git source of truth.
- **Production web** (`gettrainmate.com`) is usually **Amplify** (or similar): pushing `main` may not update the site until that pipeline runs.

---

## 6. Quick verify after risky edits

| Area        | Check |
|------------|--------|
| CORS       | Open admin CRM, Network tab: `OPTIONS` and `GET` to Execute API return 2xx; no duplicate CORS errors. |
| S3 / photos| Test Users + Users CRM: cover image loads; CloudWatch has no unexpected `NoSuchKey` for the wrong bucket. |
| Users CRM  | Click two users quickly: detail email/ID match the row you clicked last. |

If you add a new doc, link it from here in one line so others can find it.

---

## 7. Chat email “Reply now” link

**`FRONTEND_URL`** on the **API Lambda** and **AppSync resolver Lambda** must be a full URL, e.g. `https://gettrainmate.com`. Values like **`app`** or empty string produce broken `href`s and `DNS_PROBE_FINISHED_NXDOMAIN` in the browser. CDK defaults to `https://gettrainmate.com` when unset; resolver + `ChatNotificationService` validate `http(s)://` at runtime.
