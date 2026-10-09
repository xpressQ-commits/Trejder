# Roadmap

Each phase requires explicit approval. Security, auditability, accessibility and tests are part of every phase.

## Phase 0 — Foundation (complete)

Application/tooling scaffold, PostgreSQL/Drizzle schema and migration, Better Auth foundation, role and commercial policies, documentation, agent instructions, smoke/policy tests and a clean build. No marketplace workflows.

## Phase 1 — Secure company access (complete in code)

Implement sign-in, verified-email delivery, password reset, closed company onboarding, ADMIN invitations, membership management, active company selection, fresh server authorization guards, role-aware shell and session revocation. Include permission-matrix and cross-tenant integration tests against PostgreSQL.

The implementation and non-database quality gate are complete. Migrations and gated integration tests still require execution against a disposable PostgreSQL database before deployment.

## Phase 2 — Fast vehicle publishing (complete in code)

One-page reg/model → mileage → comment → VAT → three to five private, plate-checked images flow, drafts, publish transition and own active listing management. Add storage provider, file safety, tenant isolation and publish constraint tests.

The non-database implementation and local storage tests are complete. Migration `0004` and the gated Phase 2 PostgreSQL adversarial suite still require a disposable migrated PostgreSQL database before deployment.

## Phase 3 — Marketplace browsing (implemented in code)

Authenticated active dealer members browse bounded pages of active listings from other companies. Dedicated projections and image routes keep seller identity and private storage metadata hidden. Filtering is limited to registration/model text and deductible VAT. Bidding remains out of scope.

Authenticated dealer browsing and listing details with minimal filters. Prevent own-company confusion while preserving the single dealer account model.

The implementation and adversarial test coverage are complete in code. Migration `0005`, the full quality gate and the PostgreSQL integration suites still require execution in an environment with npm registry and disposable PostgreSQL access.

## Operational platform administration (implemented in code)

An explicitly bootstrapped platform administrator has a separate `/admin` surface for global company operations. It can create and edit dealer companies, suspend or reactivate company access, change existing company memberships, review public dealer applications, and create an immediately active credential user for a selected company and explicit dealer role. Application approval creates a company and initial ADMIN invitation; rejection records and emails the decision. All mutations require fresh platform authority, same-origin requests and audit records. Company removal is deliberately implemented as reversible suspension rather than destructive deletion. Public dealer applications never create application access on submission.

## Phase 3.5 — Platform subscriptions and Stripe foundation (implemented in code)

Server-owned Gratis/Premium/Obetald access state, deterministic manual overrides, paginated platform company search, canonical active-seat pricing, Stripe Checkout/Customer Portal, signed idempotent webhooks and retryable licensed-seat synchronization. Premium is 699 SEK/month excluding VAT including two active users, then 199 SEK/month excluding VAT per additional active membership. An unpaid active dealer can sign in, browse the marketplace and reach consolidated company/subscription settings; dealer mutations remain server-gated and billing remediation remains available to ADMIN. Actual future 899 SEK-per-side transaction charging remains out of scope.

## Phase 4 — Anonymous bidding

Create/update/withdraw bid, listing-scoped bidder aliases and seller bid view. Ship only with anonymity contracts, IDOR tests, fee/amount mass-assignment tests and audit coverage.

## Phase 5 — Acceptance and completed matches

Transactional acceptance of any valid bid, concurrency/idempotency tests, immutable commercial snapshots and bilateral identity reveal. Payments remain out of scope.

## Listing lifecycle and platform-owner policy (implemented in code)

Expired listings are separated into the seller's Inaktiva view and may be republished as the same listing into a new bid round. Previous-round bids remain terminal. The protected PWT Invest AB platform-owner company may publish without an expiry and is centrally exempt from subscription, extra-seat and its own side of match fees; a normal counterparty remains unchanged. Migration `0020` backfills the company by normalized organization number and adds the policy and publication-round fields.

## Phase 6 — Private sellers (approved)

Verified private-customer onboarding, seller-only navigation and listings, anonymous public Q&A, dealer bidding, bid-gated anonymous messaging, transactional acceptance, matched-party identity reveal, retained-history deal chat and identity-safe notifications.

## Later, separately approved

Transaction billing, debt-collection policy beyond conservative access restriction, refunds/credits and annual plans.
