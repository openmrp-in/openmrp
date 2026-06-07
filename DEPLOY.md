# Deploying OpenMRP to Cloudflare

OpenMRP runs entirely on Cloudflare's free tier: the **backend** is a Worker (D1 +
R2), the **frontend** is an Astro app on Pages. This is the end-to-end runbook for a
production deploy at `openmrp.in`. Steps that need your Cloudflare account are marked
**[you]**; the rest are plain commands.

Prereqs: a Cloudflare account, `npm i -g wrangler` (or use `npx wrangler`), and
`wrangler login` **[you]**.

---

## 1. Backend (Worker + D1 + R2)

```bash
cd backend
npm ci

# 1a. Create the D1 database  [you]
wrangler d1 create openmrp
#   → copy the printed database_id into wrangler.toml ([[d1_databases]].database_id)

# 1b. Create the R2 bucket for the open-data dump  [you]
wrangler r2 bucket create openmrp-dump

# 1c. Apply migrations to the remote D1
npm run db:migrate:remote

# 1d. Secrets  [you]  (generate strong random values)
wrangler secret put ADMIN_KEY     # super-admin / seeder key — keep private
wrangler secret put JWT_SECRET    # HMAC secret for developer session tokens
#   GEPIR_BASE_URL stays "" (manual claim review) until you have a GS1 proxy — see below.

# 1e. Deploy
npm run deploy        # wrangler deploy
```

The Worker is now live at `https://openmrp.<your-subdomain>.workers.dev`. The cron
trigger (`[triggers] crons` in `wrangler.toml`) will regenerate the dump weekly; you
can also trigger it any time with `POST /v1/admin/dump` (admin key).

### Custom domain **[you]**

Point the API at `api.openmrp.in`: in the Cloudflare dashboard → Workers → your worker
→ Triggers → Custom Domains → add `api.openmrp.in`. (DNS is managed automatically when
the domain is on Cloudflare.)

---

## 2. Issue the site's read API key

Reads require an API key. Create one dedicated to the public site:

```bash
API=https://api.openmrp.in            # or the workers.dev URL

# Register a "site" account, then issue a key:
curl -s -XPOST $API/v1/auth/register \
  -H 'content-type: application/json' \
  -d '{"email":"site@openmrp.in","password":"<long-random>","name":"site"}'
#   → copy the returned token

curl -s -XPOST $API/v1/keys \
  -H "authorization: Bearer <token>" -H 'content-type: application/json' \
  -d '{"name":"public-site"}'
#   → copy the one-time "key" value: omrp_live_xxxx.xxxx   (shown once)
```

Keep that key — it goes into the frontend build as `OPENMRP_API_KEY`.

---

## 3. Seed the catalog from Open Food Facts

The seeder POSTs to the live Worker, so it targets production directly:

```bash
cd backend
# smoke test first (200 products):
npm run seed -- --url $API --admin-key <ADMIN_KEY> --limit 200
# then the full run (be polite to OFF — 1s delay, it takes a while):
npm run seed -- --url $API --admin-key <ADMIN_KEY> --page-size 100 --delay 1000 --limit 0
```

Then publish the first data dump: `curl -XPOST $API/v1/admin/dump -H "x-admin-key: <ADMIN_KEY>"`.

---

## 4. Frontend (Astro on Pages) **[you]**

```bash
cd frontend
npm ci
npm run build        # outputs ./dist (Cloudflare adapter)
```

Deploy with Pages (dashboard or `wrangler pages deploy ./dist`). Set these **Pages
environment variables / secrets**:

| Var | Value |
|---|---|
| `PUBLIC_API_BASE` | `https://api.openmrp.in` |
| `OPENMRP_API_KEY` | the `omrp_live_…` key from step 2 |

Point `openmrp.in` (and `www`) at the Pages project in the dashboard → Pages → Custom
domains.

---

## 5. Smoke test

```bash
curl -s $API/health                                   # {"status":"ok",...}
curl -s "$API/v1/search?q=biscuit&limit=3" -H "x-api-key: <site-key>"
curl -s $API/v1/dump/manifest | head                  # published dataset manifest
open https://openmrp.in                               # site loads
open https://openmrp.in/downloads                     # dataset listed
```

Then visit `/admin` with the `ADMIN_KEY`, grant yourself the `admin`/`contributor`
roles, and confirm `/contribute`, `/review`, `/brand-owner` work end-to-end.

---

## Optional: GEPIR brand auto-verification

Brand-ownership claims auto-verify when `GEPIR_BASE_URL` points at a resolver exposing
`GET {base}/gtin/{gtin} → { "company_name": "…" }` (404 if unknown). Until you have a
GS1 GEPIR proxy with usable India coverage, leave it unset — claims simply go to the
manual admin review queue (`/admin` → Brand-ownership claims). Set it later with
`wrangler secret put GEPIR_BASE_URL` and redeploy; no code change needed.

---

## Rollback

- **Worker:** `wrangler rollback` (or redeploy a previous commit).
- **Data:** every curated edit is versioned — revert a product in `/admin` → Product
  versions. The dump in R2 is regenerated weekly; prior objects can be restored from
  R2 versioning if enabled.
