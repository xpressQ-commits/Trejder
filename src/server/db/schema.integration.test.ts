import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";

const databaseUrl = process.env.TEST_DATABASE_URL;
const integration = describe.skipIf(!databaseUrl);
const client = databaseUrl ? postgres(databaseUrl, { max: 2, prepare: false }) : undefined;

afterAll(async () => {
  await client?.end();
});

integration("PostgreSQL Phase 1 schema", () => {
  it("has the migrated company access tables", async () => {
    const rows = await client!<{ relation: string | null }[]>`
      select to_regclass('public.company_memberships')::text as relation
      union all
      select to_regclass('public.company_invitations')::text as relation
      union all
      select to_regclass('public.audit_logs')::text as relation
    `;

    expect(rows.map((row) => row.relation)).toEqual([
      "company_memberships",
      "company_invitations",
      "audit_logs",
    ]);
  });

  it("has the invitation replay and identity uniqueness indexes", async () => {
    const rows = await client!<{ indexname: string }[]>`
      select indexname
      from pg_indexes
      where schemaname = 'public'
        and indexname in (
          'company_invitations_token_hash_unique',
          'company_invitations_one_pending_email_uq',
          'users_email_ci_uq'
        )
      order by indexname
    `;

    expect(rows.map((row) => row.indexname)).toEqual([
      "company_invitations_one_pending_email_uq",
      "company_invitations_token_hash_unique",
      "users_email_ci_uq",
    ]);
  });
});
