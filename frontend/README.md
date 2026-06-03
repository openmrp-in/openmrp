# OpenMRP — Frontend

The public website for [openmrp.in](https://openmrp.in). **Astro** (SSR on Cloudflare
Pages), zero client JS by default — SEO + Core Web Vitals first, since OpenMRP is a
canonical *indexed* product reference.

## Built
- **`/p/{barcode}`** — the canonical product page: name, pack sizes + MRP, veg/non-veg,
  multilingual names, OFF/ODbL attribution, plus `<meta>` SEO + JSON-LD `Product`.
- **`/`** — search homepage (a bare barcode redirects straight to its product page).
- **`/search?q=`** — name search results (barcode queries redirect to `/p/{barcode}`).
- **`/brands`** + **`/brand/{slug}`** — brand index + per-brand product grid.

Reads the backend at `PUBLIC_API_BASE` (defaults to the local `wrangler dev` backend,
`http://127.0.0.1:8787`).

## Dev
```bash
# 1) run the backend (../backend): npm run dev   (seed it first — see backend/scripts/seed.ts)
# 2) here:
npm install
npm run dev          # http://localhost:4321 ; try /p/8901719134845 or /search?q=parle
```

## Tests
```bash
npm run test:cov     # vitest — api client, 100% coverage
npm run test:e2e     # Playwright — 6 E2E specs across all pages (needs the backend running)
```

## Status / next
🚧 Early but solid: all pages live (SSR), api client 100% unit-tested, 6 Playwright E2E green.
**Next:** the 22-language tab UI, category browse (needs category data in the seed), and
deploy to Cloudflare Pages.
