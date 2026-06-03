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
| GET | `/health`, `/openapi.json`, `/docs` | — | health · spec · docs UI |
| POST | `/v1/auth/register`, `/v1/auth/login` | — | developer signup / login → JWT |
| GET | `/v1/auth/me` | Bearer JWT | current developer |
| POST/GET | `/v1/keys`, `POST /v1/keys/{id}/revoke` | Bearer JWT | manage your API keys |
| GET | `/v1/product/{barcode}` | `X-Api-Key` | resolve a barcode (crowd → OFF → 404) |
| GET | `/v1/search?q=&limit=` | `X-Api-Key` | search products by name |
| GET | `/v1/brands?limit=` | `X-Api-Key` | list brands |
| GET | `/v1/brand/{slug}?limit=` | `X-Api-Key` | products for a brand |
| POST | `/v1/products`, `/v1/products/bulk` | `X-Admin-Key` | create / bulk-seed products |
| GET | `/v1/admin/developers`, `/v1/admin/keys` | `X-Admin-Key` | super-admin |

- **Reads** require a developer **`X-Api-Key`** (register → create a key). Rate-limited
  per key (60/min) → `429` + `RateLimit-*` headers.
- **Developer session**: `Authorization: Bearer <JWT>` from register/login.
- **Admin / super-admin**: `X-Admin-Key`.
- Validation failures → `422 { error: "validation_failed", details: [...] }`.

Local read access: `npm run db:seed-dev-key` seeds a fixed dev key
(`omrp_live_devkeyprefix.dev0…`) so the site/tests can call reads.

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
