import { and, count, eq } from "drizzle-orm";
import type { Role } from "@/domain/authorization";
import {
  canTransitionMembershipState,
  wouldRemoveLastActiveAdmin,
  type MembershipState,
} from "@/domain/membership";
import { getDb } from "@/server/db";
import { auditLog, company, companyMembership, user } from "@/server/db/schema";
import { AccessError } from "@/server/security";
import { markSeatSyncPending } from "@/server/billing";

export async function listCompanyMembers(companyId: string) {
  return getDb()
    .select({
      id: companyMembership.id,
      userId: user.id,
      name: user.name,
      email: user.email,
      phone: companyMembership.phone,
      role: companyMembership.role,
      status: companyMembership.status,
      createdAt: companyMembership.createdAt,
    })
    .from(companyMembership)
    .innerJoin(user, eq(user.id, companyMembership.userId))
    .where(eq(companyMembership.companyId, companyId));
}

export async function updateCompanyMembership(input: {
  companyId: string;
  membershipId: string;
  actorUserId: string;
  role?: Role;
  status?: MembershipState;
  phone?: string;
}): Promise<void> {
  await getDb().transaction(async (tx) => {
    // The company row is the per-tenant mutex for all admin-count-changing mutations.
    const lockedCompany = await tx
      .select({ id: company.id })
      .from(company)
      .where(eq(company.id, input.companyId))
      .for("update");
    if (lockedCompany.length !== 1)
      throw new AccessError(404, "MEMBERSHIP_NOT_FOUND");
    const [target] = await tx
      .select()
      .from(companyMembership)
      .where(
        and(
          eq(companyMembership.id, input.membershipId),
          eq(companyMembership.companyId, input.companyId),
        ),
      )
      .for("update");
    if (!target) throw new AccessError(404, "MEMBERSHIP_NOT_FOUND");
    const nextRole = input.role ?? target.role;
    const nextStatus = input.status ?? target.status;
    const nextPhone =
      input.phone === undefined ? target.phone : input.phone.trim() || null;
    if (!canTransitionMembershipState(target.status, nextStatus)) {
      throw new AccessError(409, "MEMBERSHIP_REVOKED");
    }
    const [adminCount] = await tx
      .select({ value: count() })
      .from(companyMembership)
      .where(
        and(
          eq(companyMembership.companyId, input.companyId),
          eq(companyMembership.role, "admin"),
          eq(companyMembership.status, "active"),
        ),
      );
    if (
      wouldRemoveLastActiveAdmin({
        targetRole: target.role,
        targetStatus: target.status,
        nextRole,
        nextStatus,
        activeAdminCount: adminCount.value,
      })
    )
      throw new AccessError(409, "LAST_ACTIVE_ADMIN");
    await tx
      .update(companyMembership)
      .set({
        role: nextRole,
        status: nextStatus,
        phone: nextPhone,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(companyMembership.id, target.id),
          eq(companyMembership.companyId, input.companyId),
        ),
      );
    await tx.insert(auditLog).values({
      actorUserId: input.actorUserId,
      actorCompanyId: input.companyId,
      action: "company_membership.updated",
      aggregateType: "company_membership",
      aggregateId: target.id,
      metadata: {
        previousRole: target.role,
        previousStatus: target.status,
        role: nextRole,
        status: nextStatus,
        phoneChanged: target.phone !== nextPhone,
      },
    });
    if (target.status !== nextStatus)
      await markSeatSyncPending(input.companyId, tx);
  });
}
