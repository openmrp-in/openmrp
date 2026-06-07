# OpenMRP

**Free, open product database for India.** Scan a barcode → product name, brand,
pack size, and the real **MRP** — in all 22 official Indian languages.
Community-built, brand-maintained, openly licensed.

🌐 [openmrp.in](https://openmrp.in) · 📦 Open data under ODbL-1.0 · 🇮🇳 22 languages

---

## What is OpenMRP?

OpenMRP is the **free, open alternative to GS1 DataKart and Smart Consumer** — a
public registry of Indian grocery / FMCG products keyed by barcode. Look up any
product to see its name, brand, image, pack sizes, **MRP**, veg/non-veg mark, HSN
code, and category — in your language.

- **For everyone** — scan a barcode, see the real MRP, know if you're being
  overcharged. Free, no login.
- **For brands** — register and maintain your own products **for free**, and own how
  your product appears across all 22 Indian languages on India's canonical product
  database. (GS1 DataKart charges ₹2.95L/yr; OpenMRP is free.)
- **For developers** — a free, open, ODbL-licensed dataset + public API. Build on it.

## What OpenMRP is — and isn't

We are **not** replacing GS1's barcodes. Brands keep their existing GS1 barcodes (the
global standard). OpenMRP is the **free, open data and verification layer** over those
barcodes — the part GS1 charges for.

| | |
|---|---|
| ✅ Free product-data registry (the "DataKart") | Brands register product info, free |
| ✅ Free consumer lookup (the "Smart Consumer") | Scan → name, brand, MRP, in 22 languages |
| ✅ Free brand verification | Via GS1's own public GEPIR registry |
| ❌ Barcode issuance | Stays with GS1 — brands keep their codes |

## 22 languages

Product names in all 22 languages of the Eighth Schedule of the Indian Constitution —
Hindi, Bengali, Tamil, Telugu, Kannada, Malayalam, Marathi, Gujarati, Punjabi, Odia,
Assamese, Urdu, and more. Brands provide official names; the community fills the rest;
machine translation seeds the gaps (always clearly marked as auto-translated).

## Open data

The whole dataset is published under the **Open Database License (ODbL 1.0)** — free to
use, share, and build on, with attribution and share-alike. Periodic dumps are published
openly (which also satisfies ODbL's share-alike obligation by design).

**Download it** at [openmrp.in/downloads](https://openmrp.in/downloads), or via the
public API:

```bash
curl https://api.openmrp.in/v1/dump/manifest               # files + row counts + sha256
curl -O https://api.openmrp.in/v1/dump/file/products.csv   # per-table CSV
curl -O https://api.openmrp.in/v1/dump/file/openmrp.sql    # full SQL dump
sqlite3 openmrp.db < openmrp.sql                           # load it (schema from migrations)
```

Each table is published as JSON and CSV, plus one combined SQL dump, with a
`manifest.json` (per-file SHA-256 + row counts + generation date). A weekly cron
regenerates it; no API key required to download.

## API

A free, public, OpenAPI-documented API. **Reads require a key** (self-service, free):
register at [openmrp.in/developers](https://openmrp.in/developers) → create a key →
send it as `X-Api-Key`. Interactive docs at `/docs`, spec at `/openapi.json`.

```bash
curl "https://api.openmrp.in/v1/product/8901058000610" -H "x-api-key: omrp_live_…"
curl "https://api.openmrp.in/v1/search?q=biscuit"       -H "x-api-key: omrp_live_…"
```

## Licensing

OpenMRP is openly licensed, in three layers:

| What | License |
|---|---|
| **Code** (this repo) | [Apache-2.0](LICENSE) |
| **Data** (the product database) | [ODbL-1.0](LICENSE-DATA) |
| **Media** (contributed images) | [CC-BY-SA-4.0](LICENSE-MEDIA) |

The ODbL data license is **irrevocable** — the data is, and always will be, open. See
[GOVERNANCE.md](GOVERNANCE.md).

## How edits work

OpenMRP is **curated-open**: anyone can propose, a small trusted team reviews.

- **Everyone** — suggest a product or correct a detail at `/contribute`. Changes from
  non-owners apply after **two independent approvals**.
- **Contributors** — review and approve others' edits at `/review`.
- **Brands** — claim your brand at `/brand-owner` (auto-verified via GS1 GEPIR, or by
  manual review). Verified owners' edits apply **instantly** and authoritatively.
- **Everything is versioned** — any product can be reverted to a prior stable version.

See [CONTRIBUTING.md](CONTRIBUTING.md) for dev setup + the PR/test bar, and
[GOVERNANCE.md](GOVERNANCE.md) for the trust model.

## Run it locally

```bash
# backend (Worker + local D1)  →  http://127.0.0.1:8787
cd backend && npm ci && npm run db:migrate:local && npm run db:seed-dev-key && npm run dev
npm run seed -- --limit 200       # pull 200 products from Open Food Facts (separate shell)

# frontend (Astro)  →  http://127.0.0.1:4321
cd frontend && npm ci && npm run dev
```

Tests: `npm test` (both folders) — **100% coverage** is enforced on the backend and on
the frontend's `src/lib`; `npm run test:e2e` (frontend) drives Playwright against a real
backend. Deploying? See **[DEPLOY.md](DEPLOY.md)**.

## Repository structure

```
openmrp/
├── backend/    # API — Cloudflare Worker + D1 + R2 (TypeScript, Hono, code-first OpenAPI).
│               # Resolve/search, accounts + API keys, moderation (versions, contributions,
│               # GEPIR claims), and the ODbL dump pipeline (D1 → R2, weekly cron).
├── frontend/   # Public site + portal — Astro on Cloudflare Pages. Browse, contribute,
│               # review, brand-owner, super-admin, and the dataset download page.
└── dump/       # Open-data dataset documentation (the export itself is produced by the
                # backend into R2 and served at /v1/dump/*).
```

Each folder is an independent project with its own `package.json`.

## Status

✅ **Built and tested, pre-launch.** The backend (resolve/search + accounts + the full
moderation system: versioning, 2-approval contributions, GEPIR brand claims) and the
frontend (public site, contributor/brand-owner/admin portals, 22-language rendering, and
the open-data download page) are complete, with 100% test coverage and a green Playwright
suite. Next: the production Cloudflare deploy at `openmrp.in` (see [DEPLOY.md](DEPLOY.md))
and a real GS1 GEPIR proxy for brand auto-verification.

## Governance & stewardship

OpenMRP is stewarded by **Abitz Technologies Pvt. Ltd.**, with a commitment to being
irrevocably open — contributors trust the license, not the owner. See
[GOVERNANCE.md](GOVERNANCE.md).

---

_OpenMRP — know the real price._
