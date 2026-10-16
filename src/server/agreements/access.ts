import { canUseAgreementTool } from "@/domain/agreement-access";
import {
  requireDealerMembershipPermission,
  type ActiveCompanyContext,
} from "@/server/company/context";
import { hasPlatformAdminAuthority } from "@/server/platform-admin";
import { AccessError } from "@/server/security";

export type AgreementAccessContext = ActiveCompanyContext & {
  isPlatformAdmin: boolean;
};

/**
 * PRO is intentionally not persisted yet. The current product has no PRO
 * billing tier, so runtime resolves standard until billing owns that value.
 */
export async function requireAgreementAccess(
  headers: Headers,
  selectedCompanyId: string | null,
): Promise<AgreementAccessContext> {
  const context = await requireDealerMembershipPermission(
    headers,
    selectedCompanyId,
    "company:read",
  );
  const isPlatformAdmin = await hasPlatformAdminAuthority(context.user.id);
  if (
    !canUseAgreementTool({
      isPlatformAdmin,
      role: context.membership.role,
      companyTier: "standard",
    })
  ) {
    throw new AccessError(403, "AGREEMENT_ACCESS_REQUIRED");
  }
  return { ...context, isPlatformAdmin };
}
