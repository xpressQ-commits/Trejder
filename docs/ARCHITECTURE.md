# Architecture

## Shape

A modular monolith in one repository:

- Next.js App Router and React for the responsive web application
- TypeScript in strict mode
- PostgreSQL as the system of record
- Drizzle ORM and generated SQL migrations
- Better Auth with the Drizzle adapter for identity, credentials and database-backed sessions
- Tailwind CSS with small project-owned UI primitives
- Vitest for fast policy and contract tests

Server Components are the default. Client Components are introduced only where browser interaction requires them. Domain policies live outside React. Mutations will pass through server-only use cases that perform authentication, membership/role checks, validation, transactions and audit writes.

No microservices, event bus, global client-state framework or broad UI kit is justified at this stage.

Browser notifications use the Web Push standard. An authenticated user explicitly
subscribes a browser installation; the endpoint and encryption keys are stored per
user, while VAPID private material remains server-only. The service worker displays
identity-safe notification text and deep-links back to an authorized application
route. Expired provider subscriptions are removed after a 404/410 response.

### Theme and localization

- UI colors use semantic CSS variables from `src/app/globals.css`. New components must not introduce light-only literals for surfaces, text, borders or interaction states.
- Theme preference is `system`, `light` or `dark`. The root layout applies it before hydration; browser code follows `prefers-color-scheme` changes only in system mode.
- User-facing text belongs in the typed dictionaries under `src/i18n/messages`. Swedish is the default and fallback language; internal enums and API error codes remain stable and untranslated.
- Dates, numbers and SEK amounts use the locale-aware helpers in `src/i18n`, or equivalent `Intl` formatting with the active locale.
- Locale is a profile/browser preference rather than a URL prefix. Public SEO routing can make a separate decision later.

## Authentication choice

Better Auth was chosen because it is TypeScript-native, supports database-backed sessions and credentials, and has a maintained Drizzle/PostgreSQL adapter. It supplies authentication, not marketplace authorization.

Company, membership, invitation and role records are application-owned. This keeps the domain model explicit and avoids coupling authorization to an authentication plugin. Every sensitive request must reload the current active membership; a session or selected company is never sufficient proof of authority.

Better Auth exposes email/password login with a 12-character minimum, database-backed sessions, verified-email enforcement and password reset. Public sign-up is disabled. Account creation is only performed by the application-owned, one-time invitation acceptance transaction. Transactional email is behind a small adapter; development may use the isolated console transport while production fails closed until a provider adapter is configured.

The active company is stored as an opaque HttpOnly, SameSite=Strict cookie for UX continuity. It is never authorization proof: every dealer request reloads the session, active membership and active company and verifies the selected company belongs to the user. Users with several memberships must explicitly select one; a sole membership may be selected automatically by the UI.

Dealer access remains operator-controlled. Public applications are stored as review-only records and send messages through the transactional-email adapter. The platform-admin user area separates pending, approved and rejected applications. Approval creates the company and initial ADMIN invitation; rejection sends a decision message. The same area may create a standalone verified SUPERADMIN account without a company, or a verified dealer credential account atomically for a selected active company and explicit role.

Internal platform authority is represented independently of dealer membership in `platform_admins`. The one-time `npm run admin:bootstrap` operation creates or promotes a verified credential user from runtime-only environment variables. Dealer `ADMIN` never implies platform authority.

## Layers

1. `src/app`: routes, layouts, server-rendered views and narrow transport adapters.
2. `src/domain`: pure permissions, commercial policies and future state-transition rules.
3. `src/server`: auth context, tenant-scoped use cases, repositories and integrations.
4. `src/server/db`: Drizzle client and schema.

Transport inputs will be validated with Zod and mapped field-by-field. Drizzle rows are not API contracts. Seller-facing bid responses use dedicated anonymous projections.

## Operational boundaries

- Migrations run with a migration owner; runtime should use a less-privileged PostgreSQL role.
- Vehicle originals live in private storage. Development uses an ignored local directory through the same `PrivateImageStorage` contract. Production uses a private Cloudflare R2 bucket through the S3-compatible adapter; objects are never exposed by public bucket URL.
- The application is deployed as one service plus PostgreSQL and object storage.
- Plate detection is synchronous and server-side through a narrow provider adapter. The current provider is Plate Recognizer Snapshot Cloud; Sharp performs EXIF normalization and local blurring. No queue is introduced at the current volume.
- Observability must avoid bidder identity in seller-facing logs, errors, analytics and URLs.
- Stripe is an external billing adapter behind server-only use cases. Checkout, Customer Portal and licensed-seat quantities use dashboard-created Price IDs; no client controls company, customer, price, amount or quantity.
- Checkout creation serializes on the company subscription row. An open unexpired hosted session is reused; expired/completed sessions rotate a persisted server generation used as the Stripe idempotency key. This is the one deliberate external call inside a short billing-only transaction and prevents concurrent duplicate subscriptions.
- The signed `/api/stripe/webhook` reads the raw request body, verifies `STRIPE_WEBHOOK_SECRET`, and inserts the Stripe event ID before applying a business transition. Duplicate deliveries are no-ops. The Stripe endpoint subscribes to `checkout.session.completed`, `checkout.session.expired`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid` and `invoice.payment_failed`.
- Subscription lifecycle events also carry a persisted Stripe creation-time watermark; older deliveries cannot roll back newer state, and terminal cancellation wins ties.
- `company_subscriptions` is the Trejder access projection and retry boundary. Membership transactions only mark seat sync pending; Stripe network calls occur afterwards and failures remain retryable without rolling back membership state.
- A central company policy consumes the protected `is_platform_owner` database flag. Billing, Stripe, publication-duration and match-fee use cases all call this policy; presentation code cannot grant the exemption.
- Each changed desired seat operation increments a persisted sync generation. Stripe idempotency keys use company, generation and desired quantity; retry attempts and error/status timestamps never rotate that key. Membership changes during `past_due` remain queued, and `invoice.paid` queues reconciliation before the account resumes normal billing.
- A Railway cron invokes `POST /api/internal/billing/seat-sync` with `Authorization: Bearer $BILLING_SYNC_SECRET`; the endpoint drains bounded pending/failed sync rows. The random bearer value is separate from Stripe credentials.

Authorized image reads go through a tenant-scoped application route. DTOs contain that route, never the underlying object key. Object keys are opaque values with 256 random bits and contain no tenant or listing identifier; the bucket remains private.

Marketplace reads use dedicated allow-listed DTOs and fresh active-company authorization. Queries expose only active listings owned by other companies, use bounded cursor pagination, and never select seller identity. Marketplace image routes repeat the same active/non-owner predicate at read time.

Vehicle detail activity is split by audience. The public endpoint selects only anonymous alias numbers and timestamps and derives a unique-bidder summary. The seller endpoint applies active/current-round predicates, amount ordering and a three-row limit in PostgreSQL. Questions are fetched once per panel alongside—not once per bid—and no aggressive polling is introduced.

Expiry is query-derived from the database clock boundary (`expires_at`) rather than a background transition. Marketplace and mutation predicates exclude timed-out listings immediately; the seller projection labels them inactive. A nullable expiry is reserved server-side for the platform-owner company. Publication-round numbers isolate bids when the same listing is republished.

## Configuration

### Deployment environments

- `main` is the production release branch and deploys only to Railway `production` at `https://trejder.se`.
- `staging` is the persistent integration branch and deploys only to Railway `staging`. Its canonical fallback URL is `https://trejder-staging.up.railway.app`; `https://staging.trejder.se` may replace it after DNS verification.
- Each Railway environment owns a separate PostgreSQL service and volume. Environment-scoped `DATABASE_URL` and `TEST_DATABASE_URL` references must resolve to that environment's `Postgres` service; production database credentials must never be copied into staging.
- `APP_ENV=staging` enables the visible staging badge. Production omits the variable, so the badge cannot appear there.
- Staging uses its own `BETTER_AUTH_URL`, a clearly named transactional-email sender, and Stripe test-mode credentials. Host-only authentication cookies keep staging and production sessions separate.
- Railway runs committed Drizzle migrations as a pre-deploy command. A release promotes code and migration files through a pull request from `staging` to `main`; it never promotes the staging database or its data.
- Production releases are pull-request merges to `main`. Direct pushes, force pushes and branch deletion should be blocked by the repository ruleset; status checks become required only after stable CI exists.

See `.env.example`. Runtime secrets are never committed. `DATABASE_URL` and a minimum 32-character `BETTER_AUTH_SECRET` are required when the auth/database path is invoked. Billing additionally requires `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PREMIUM_MONTHLY`, `STRIPE_PRICE_EXTRA_USER_MONTHLY` and a separate 32+ character `BILLING_SYNC_SECRET`. Stripe Prices must be recurring monthly, SEK, tax-exclusive, with the extra-user Price configured as licensed quantity. Customer Portal must allow payment methods, invoices and billing details while subscription plan/quantity changes remain disabled so Trejder's server-owned pricing cannot be bypassed.

Before production billing, the Stripe Dashboard must contain two active tax-exclusive monthly SEK Prices: Trejder Premium at 699 SEK and Trejder Extra User at 199 SEK licensed per unit. Configure the Customer Portal for payment methods, invoices and billing details only; customers must not switch Prices or quantities. Register the production webhook URL for `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`, `checkout.session.completed` and `checkout.session.expired`. Stripe Tax is not enabled by this phase; the business must finish its VAT/tax configuration before live charges.

Railway must receive all five billing variables from `.env.example`, expose the webhook route over HTTPS, and run a scheduled authenticated POST to the seat-sync worker. The webhook signing secret and worker bearer secret are different credentials and should be rotated independently.
