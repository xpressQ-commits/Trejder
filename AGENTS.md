# Agent map

This repository is a Swedish B2B vehicle marketplace for one company type: **car dealer**. A dealer can both sell and buy. Keep the product fast and narrow: `reg/model -> mileage -> comment -> VAT -> 3–5 checked images -> publish`.

## Sources of truth

- Product and non-goals: `docs/PRODUCT.md`
- Architecture and boundaries: `docs/ARCHITECTURE.md`
- Domain model and transitions: `docs/DOMAIN.md`
- Security invariants: `docs/SECURITY.md`
- Delivery sequence: `docs/ROADMAP.md`
- Specialist instructions: `docs/agents/{backend,frontend,qa}.md`

## Repository map

- `src/app`: Next.js routes and presentation
- `src/domain`: framework-independent policies and types
- `src/server`: authentication, database and future server-only use cases
- `src/server/db/schema`: Drizzle source of truth
- `drizzle`: generated SQL migrations

## Rules for every change

1. Do not expand scope beyond the current approved roadmap phase.
2. Enforce tenant ownership and roles on the server; UI visibility is never authorization.
3. Never expose bidder identity before acceptance, directly or indirectly.
4. Derive company, ownership, state and fees from the authenticated server context and database.
5. Represent money as integer öre. Do not use floating point for stored or computed money.
6. Important state changes are transactional, auditable and concurrency-safe.
7. Update the relevant source-of-truth document when a decision changes.
8. Run `npm run check` before handing work back.

The lead agent owns cross-cutting decisions and integration. Specialists may recommend changes to core rules but must not redefine them independently.
