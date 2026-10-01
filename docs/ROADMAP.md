# Roadmap

Each phase requires explicit approval. Security, auditability, accessibility and tests are part of every phase.

## Phase 0 — Foundation (complete)

Application/tooling scaffold, PostgreSQL/Drizzle schema and migration, Better Auth foundation, role and commercial policies, documentation, agent instructions, smoke/policy tests and a clean build. No marketplace workflows.

## Phase 1 — Secure company access (complete in code)

Implement sign-in, verified-email delivery, password reset, closed company onboarding, ADMIN invitations, membership management, active company selection, fresh server authorization guards, role-aware shell and session revocation. Include permission-matrix and cross-tenant integration tests against PostgreSQL.

The implementation and non-database quality gate are complete. Migrations and gated integration tests still require execution against a disposable PostgreSQL database before deployment.

## Phase 2 — Fast vehicle publishing (complete in code)

One-page reg/model → mileage → comment → VAT → exactly three private images flow, drafts, publish transition and own active listing management. Add storage provider, file safety, tenant isolation and publish constraint tests.

The non-database implementation and local storage tests are complete. Migration `0004` and the gated Phase 2 PostgreSQL adversarial suite still require a disposable migrated PostgreSQL database before deployment.

## Phase 3 — Marketplace browsing (implemented in code)

Authenticated active dealer members browse bounded pages of active listings from other companies. Dedicated projections and image routes keep seller identity and private storage metadata hidden. Filtering is limited to registration/model text and deductible VAT. Bidding remains out of scope.

Authenticated dealer browsing and listing details with minimal filters. Prevent own-company confusion while preserving the single dealer account model.

The implementation and adversarial test coverage are complete in code. Migration `0005`, the full quality gate and the PostgreSQL integration suites still require execution in an environment with npm registry and disposable PostgreSQL access.

## Operational platform administration (implemented in code)

An explicitly bootstrapped platform administrator has a separate `/admin` surface for global company operations. It can create and edit dealer companies, suspend or reactivate company access, and change existing company memberships. All mutations require fresh platform authority, same-origin requests and audit records. Company removal is deliberately implemented as reversible suspension rather than destructive deletion.

## Phase 4 — Anonymous bidding

Create/update/withdraw bid, listing-scoped bidder aliases and seller bid view. Ship only with anonymity contracts, IDOR tests, fee/amount mass-assignment tests and audit coverage.

## Phase 5 — Acceptance and completed matches

Transactional acceptance of any valid bid, concurrency/idempotency tests, immutable commercial snapshots and bilateral identity reveal. Payments remain out of scope.

## Later, separately approved

Billing operations and, after discovery, private sellers. Do not pre-build either.
