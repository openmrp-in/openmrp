# OpenMRP — Backend API

Cloudflare Workers + D1 (TypeScript, [Hono](https://hono.dev) +
[`@hono/zod-openapi`](https://github.com/honojs/middleware/tree/main/packages/zod-openapi)).

## Interactive docs
- **`/docs`** — Scalar API reference (try-it-out).
- **`/openapi.json`** — the OpenAPI **3.1** spec.

The spec is **code-first / zero-drift**: the Zod schemas in `src/openapi/schemas.ts`
are simultaneously the request validators, the TypeScript types, and the OpenAPI
document — they cannot drift from the implementation.

## Endpoints
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/health` | — | health check |
| GET | `/v1/product/{barcode}` | — | resolve a barcode (crowd → OFF → 404) |
| GET | `/v1/search?q=&limit=` | — | search products by name |
| GET | `/v1/brands?limit=` | — | list brands |
| GET | `/v1/brand/{slug}?limit=` | — | products for a brand |
| POST | `/v1/products` | `X-Admin-Key` | create a product (+ translations) |
| POST | `/v1/products/bulk` | `X-Admin-Key` | bulk-upsert (seed) |

Write endpoints require the `X-Admin-Key` header. Validation failures return `422`
`{ error: "validation_failed", details: [...] }`.

## Develop
```bash
npm install
npm run db:migrate:local     # apply migrations to a local D1
npm run dev                  # http://127.0.0.1:8787  (see /docs)
npm test                     # vitest (unit + workers-pool integration), 100% coverage
npm run typecheck
npm run seed -- --source off # fill from Open Food Facts (see scripts/seed.ts)
```

## Layout
```
src/
  index.ts          app + /openapi.json + /docs
  openapi/          Zod schemas (source of truth) + app factory + admin guard
  routes/           product · products(+bulk) · discover(search/brands/brand)
  db/               D1 store + row types
  resolve/          barcode resolve chain + OFF client
  lib/              ulid · slug · errors · seed · offsearch
migrations/         D1 SQL migrations
```
