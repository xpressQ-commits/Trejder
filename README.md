# Trejder

Production-oriented Swedish B2B vehicle marketplace. Phase 3 adds authenticated browsing of active vehicles from other dealer companies. Bidding is not implemented.

## Local setup

1. Use Node.js 22 or newer, the npm version pinned by `packageManager`, and PostgreSQL.
2. Copy `.env.example` to `.env` and replace secrets.
3. Run `npm install`.
4. Run `npm run db:migrate` against a dedicated local database.
5. Run `npm run dev`.

Quality gate: `npm run check`.

PostgreSQL-specific Phase 1 tests are deliberately opt-in and require a disposable, already migrated database:

```powershell
$env:DATABASE_URL=$env:TEST_DATABASE_URL
npm run db:migrate
npm run test:integration
```

Set `TEST_DATABASE_URL` to that database before running the commands. The tests create isolated UUID-keyed records and clean them up; never point it at production.

Dealer onboarding is closed. `provisionDealerCompany` is an internal service with no public route. Development email delivery is isolated from production, where an `EmailTransport` adapter must be configured.

## Platform administrator bootstrap

After migrations, an operator may run `npm run admin:bootstrap` with `DATABASE_URL`, `TREJDER_ADMIN_EMAIL` and `TREJDER_ADMIN_PASSWORD` supplied through the runtime environment. The password must contain 12–128 characters, is hashed with Better Auth's credential hasher and is never printed or stored as plaintext. The command creates a verified credential user or promotes an existing user. Supplying `TREJDER_ADMIN_COMPANY_NAME`, `TREJDER_ADMIN_COMPANY_ORGANIZATION_NUMBER`, and optionally `TREJDER_ADMIN_COMPANY_CONTACT_EMAIL` also attaches the platform administrator as the active administrator of that dealer company. The operation is idempotent; remove the bootstrap password from the runtime environment after the first successful run.

Production invitation, verification and password-reset email is delivered through Resend. Verify `trejder.se` as a sending domain, set `RESEND_API_KEY`, and optionally override `TRANSACTIONAL_EMAIL_FROM` (defaults to `Trejder <konto@trejder.se>`). Token-bearing message content and provider response bodies must not be logged.

Platform authority is separate from dealer membership: a dealer-company `ADMIN` manages only that company and is not an internal Trejder platform administrator. Never commit bootstrap credentials or run the command against the wrong database.

## Private image storage

Development stores originals beneath `LOCAL_IMAGE_STORAGE_ROOT` (default `.data/vehicle-images`), outside Next.js public assets and ignored by Git. Reads still pass through authenticated tenant-scoped routes.

Production uses a private Cloudflare R2 bucket through the S3-compatible adapter. Configure `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` and `R2_BUCKET`. Keep public bucket access disabled. Missing production configuration fails uploads and reads; it never reports a fake success.

Start with `AGENTS.md` and the source-of-truth documents under `docs/` before contributing.
