# Handlarbörsen

Production-oriented Swedish B2B vehicle marketplace. Phase 2 contains secure dealer access and own-company vehicle publishing. Marketplace browsing and bidding are not implemented.

## Local setup

1. Use Node.js 22 or newer and PostgreSQL.
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

Dealer onboarding is closed. `provisionDealerCompany` is an internal service with no public route; a production operations CLI or platform-admin surface remains future operational work. Development email delivery is isolated from production, where an `EmailTransport` adapter must be configured.

## Private image storage

Development stores originals beneath `LOCAL_IMAGE_STORAGE_ROOT` (default `.data/vehicle-images`), outside Next.js public assets and ignored by Git. Reads still pass through authenticated tenant-scoped routes.

Production uses a private Cloudflare R2 bucket through the S3-compatible adapter. Configure `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` and `R2_BUCKET`. Keep public bucket access disabled. Missing production configuration fails uploads and reads; it never reports a fake success.

Start with `AGENTS.md` and the source-of-truth documents under `docs/` before contributing.
