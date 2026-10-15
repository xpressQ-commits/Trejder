export function canViewFullListingImage(input: {
  isSeller: boolean;
  isPrivilegedAdmin: boolean;
  hasActiveMarketplaceAccess: boolean;
}): boolean {
  return (
    input.isSeller ||
    input.isPrivilegedAdmin ||
    input.hasActiveMarketplaceAccess
  );
}
