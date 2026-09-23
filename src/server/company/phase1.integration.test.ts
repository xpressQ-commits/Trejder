import { createHash, randomBytes, randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { account, auditLog, company, companyInvitation, companyMembership, user } from "@/server/db/schema";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const integration = describe.runIf(Boolean(testDatabaseUrl));

integration("Phase 1 PostgreSQL authorization", () => {
  const companyA = randomUUID();
  const companyB = randomUUID();
  const adminUser = randomUUID();
  const invitedEmail = `invite-${randomUUID()}@example.test`;
  let adminMembership = "";

  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl;
    const { getDb } = await import("@/server/db");
    const db = getDb();
    await db.insert(user).values({ id: adminUser, name: "Integration Admin", email: `admin-${randomUUID()}@example.test`, emailVerified: true });
    await db.insert(company).values([
      { id: companyA, legalName: "Integration A", organizationNumber: `A${randomUUID().slice(0, 12)}`, contactEmail: invitedEmail },
      { id: companyB, legalName: "Integration B", organizationNumber: `B${randomUUID().slice(0, 12)}`, contactEmail: invitedEmail },
    ]);
    const [createdMembership] = await db.insert(companyMembership)
      .values({ companyId: companyA, userId: adminUser, role: "admin" })
      .returning({ id: companyMembership.id });
    adminMembership = createdMembership.id;
  });

  afterAll(async () => {
    const { getDb } = await import("@/server/db");
    const db = getDb();
    const createdUsers = await db.select({ id: user.id }).from(user).where(eq(user.email, invitedEmail));
    const userIds = [adminUser, ...createdUsers.map((item) => item.id)];
    await db.delete(auditLog).where(inArray(auditLog.actorCompanyId, [companyA, companyB]));
    await db.delete(companyInvitation).where(inArray(companyInvitation.companyId, [companyA, companyB]));
    await db.delete(companyMembership).where(inArray(companyMembership.companyId, [companyA, companyB]));
    await db.delete(account).where(inArray(account.userId, userIds));
    await db.delete(company).where(inArray(company.id, [companyA, companyB]));
    await db.delete(user).where(inArray(user.id, userIds));
  });

  it("does not let a tenant mutate another tenant membership and protects its last admin", async () => {
    const { updateCompanyMembership } = await import("./members");
    await expect(updateCompanyMembership({ companyId: companyB, membershipId: adminMembership, actorUserId: adminUser, role: "viewer" }))
      .rejects.toMatchObject({ status: 404, code: "MEMBERSHIP_NOT_FOUND" });
    await expect(updateCompanyMembership({ companyId: companyA, membershipId: adminMembership, actorUserId: adminUser, role: "viewer" }))
      .rejects.toMatchObject({ status: 409, code: "LAST_ACTIVE_ADMIN" });
  });

  it("consumes an invitation once and ignores client-owned company/role concepts", async () => {
    const token = randomBytes(32).toString("base64url");
    const { getDb } = await import("@/server/db");
    await getDb().insert(companyInvitation).values({
      companyId: companyA,
      email: invitedEmail,
      role: "viewer",
      tokenHash: createHash("sha256").update(token).digest("hex"),
      invitedByUserId: adminUser,
      expiresAt: new Date(Date.now() + 60_000),
    });
    const { acceptCompanyInvitation } = await import("./invitations");
    await expect(acceptCompanyInvitation({ token, authenticatedUser: null, name: "Invited User", password: "a-secure-password-123" }))
      .resolves.toMatchObject({ companyId: companyA, requiresSignIn: true });
    await expect(acceptCompanyInvitation({ token, authenticatedUser: null, name: "Replay", password: "a-secure-password-123" }))
      .rejects.toMatchObject({ status: 404, code: "INVALID_INVITATION" });
  });
});
