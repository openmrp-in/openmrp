# OpenMRP — Frontend

The public website for [openmrp.in](https://openmrp.in). **Astro** (SSR on Cloudflare
Pages), zero client JS by default — SEO + Core Web Vitals first, since OpenMRP is a
canonical *indexed* product reference.

## Built
- **`/p/{barcode}`** — the canonical product page: name, pack sizes + MRP, veg/non-veg,
  multilingual names, OFF/ODbL attribution, plus `<meta>` SEO + JSON-LD `Product`.
- **`/`** — barcode-lookup homepage.

Reads the backend at `PUBLIC_API_BASE` (defaults to the local `wrangler dev` backend,
`http://127.0.0.1:8787`).

## Dev
```bash
# 1) run the backend (../backend): npm run dev   (seed it first — see backend/scripts/seed.ts)
# 2) here:
npm install
npm run dev          # http://localhost:4321 ; try /p/8901719134845
```

## Status / next
🚧 Early. Product page + home are live (SSR, verified against a seeded backend).
**Next:** search + brand/category browse (need new public API endpoints), the 22-language
tab UI, an automated test suite (Playwright E2E + unit), and deploy to Cloudflare Pages.
