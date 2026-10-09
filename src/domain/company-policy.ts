export type CompanyPolicySubject = Readonly<{
  isPlatformOwner: boolean;
}>;

export function isBillingExempt(company: CompanyPolicySubject): boolean {
  return company.isPlatformOwner;
}

export function canUseUnlimitedListings(
  company: CompanyPolicySubject,
): boolean {
  return company.isPlatformOwner;
}
