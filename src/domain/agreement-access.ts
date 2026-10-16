import type { Role } from "@/domain/authorization";

export const companyProductTiers = ["standard", "pro"] as const;
export type CompanyProductTier = (typeof companyProductTiers)[number];

export const companyEntitlements = ["agreements"] as const;
export type CompanyEntitlement = (typeof companyEntitlements)[number];

export function entitlementsForCompanyTier(
  tier: CompanyProductTier,
): readonly CompanyEntitlement[] {
  return tier === "pro" ? ["agreements"] : [];
}
export function canUseAgreementTool(input: {
  isPlatformAdmin: boolean;
  role: Role;
  companyTier: CompanyProductTier;
}): boolean {
  if (input.isPlatformAdmin) return true;
  if (input.role === "admin") return true;
  if (input.role === "private_customer") return false;
  return entitlementsForCompanyTier(input.companyTier).includes("agreements");
}
