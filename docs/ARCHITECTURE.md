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

## Authentication choice

Better Auth was chosen because it is TypeScript-native, supports database-backed sessions and credentials, and has a maintained Drizzle/PostgreSQL adapter. It supplies authentication, not marketplace authorization.

Company, membership, invitation and role records are application-owned. This keeps the domain model explicit and avoids coupling authorization to an authentication plugin. Every sensitive request must reload the current active membership; a session or selected company is never sufficient proof of authority.

Better Auth exposes email/password login with a 12-character minimum, database-backed sessions, verified-email enforcement and password reset. Public sign-up is disabled. Account creation is only performed by the application-owned, one-time invitation acceptance transaction. Transactional email is behind a small adapter; development may use the isolated console transport while production fails closed until a provider adapter is configured.

The active company is stored as an opaque HttpOnly, SameSite=Strict cookie for UX continuity. It is never authorization proof: every dealer request reloads the session, active membership and active company and verifies the selected company belongs to the user. Users with several memberships must explicitly select one; a sole membership may be selected automatically by the UI.

Dealer company creation is an internal service operation (`provisionDealerCompany`) with no public route or UI. It creates the company and initial ADMIN invitation atomically. A production operator interface or CLI remains an operational follow-up, not a public onboarding path.

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

Authorized image reads go through a tenant-scoped application route. DTOs contain that route, never the underlying object key. Object keys are opaque values with 256 random bits and contain no tenant or listing identifier; the bucket remains private.

Marketplace reads use dedicated allow-listed DTOs and fresh active-company authorization. Queries expose only active listings owned by other companies, use bounded cursor pagination, and never select seller identity. Marketplace image routes repeat the same active/non-owner predicate at read time.

## Configuration

See `.env.example`. Runtime secrets are never committed. `DATABASE_URL` and a minimum 32-character `BETTER_AUTH_SECRET` are required when the auth/database path is invoked.
