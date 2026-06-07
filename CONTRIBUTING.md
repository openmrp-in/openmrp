# Contributing to OpenMRP

Thanks for helping build India's free, open product database. There are two ways to
contribute: **to the data** (no code) and **to the code**.

## Contributing data

No setup needed — just use the site:

- **Suggest / correct a product** → [openmrp.in/contribute](https://openmrp.in/contribute).
  Edits from non-owners apply after **two independent approvals**.
- **Review the queue** (contributors) → `/review`. You can't approve your own edit.
- **Claim your brand** (brands) → `/brand-owner`. Verified owners' edits apply instantly.

All data you contribute is published under the **ODbL** (data) / **CC-BY-SA-4.0**
(images). Don't paste data from a source whose license forbids it.

## Contributing code

### Setup

```bash
# backend  (Cloudflare Worker + local D1)
cd backend && npm ci
npm run db:migrate:local && npm run db:seed-dev-key && npm run dev   # :8787

# frontend (Astro)
cd frontend && npm ci && npm run dev                                  # :4321
```

### The bar (non-negotiable)

- **100% test coverage.** The backend (`src/**`) and the frontend's `src/lib/**` are at
  100% lines/branches/functions/statements, enforced in CI config. New code ships with
  tests or it doesn't ship.
  - Backend tests run in real `workerd` + D1 via `@cloudflare/vitest-pool-workers`
    (istanbul coverage). `npm run test:cov`.
  - Frontend logic lives in `src/lib/**` (unit-tested with vitest); Astro page scripts
    are covered by **Playwright** E2E against a real backend. `npm test` + `npm run test:e2e`.
- **Typecheck clean.** `npm run typecheck` (backend) / `npm run build` (frontend).
- **Code-first OpenAPI.** Backend routes use `@hono/zod-openapi` — the Zod schema *is*
  the validator *and* the API spec, so docs can't drift. Add new endpoints the same way.
- **Tenancy/trust invariants.** Reads are API-key gated; writes are admin- or
  role-gated; brand-owner edits auto-apply, everyone else needs two approvals. Keep
  these intact and add a test that locks the rule.

### Pull requests

1. Branch from `main`.
2. Keep the diff focused; match the surrounding style.
3. `npm run typecheck && npm run test:cov` (backend) and `npm test && npm run build`
   (frontend) must pass.
4. Describe what changed and why. A maintainer reviews and merges.

### Architecture notes

- `backend/src/db/*` — D1 stores (one per concern). `backend/src/routes/*` — HTTP.
  `backend/src/dump/*` — the ODbL export engine. `backend/migrations/*` — schema.
- `frontend/src/lib/*` — pure, tested helpers. `frontend/src/pages/*` — Astro pages.
  `frontend/src/client/portal.ts` — browser auth/fetch helpers.

By contributing you agree your contributions are licensed under this repo's licenses
(Apache-2.0 code · ODbL data · CC-BY-SA media). See [GOVERNANCE.md](GOVERNANCE.md).
