export function selectActiveCompany<T extends { companyId: string }>(
  available: readonly T[],
  requestedCompanyId: string | null,
): T | undefined {
  if (requestedCompanyId) return available.find((candidate) => candidate.companyId === requestedCompanyId);
  return available.length === 1 ? available[0] : undefined;
}
