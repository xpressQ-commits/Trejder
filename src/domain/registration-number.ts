const SWEDISH_REGISTRATION_NUMBER = /^[A-Z]{3}[0-9]{2}[A-Z0-9]$/;

export function normalizeRegistrationNumber(value: string): string {
  const normalized = value.trim().toUpperCase().replace(/\s+/g, "");
  if (!normalized || normalized.length > 16 || !/^[A-Z0-9-]+$/.test(normalized)) {
    throw new Error("INVALID_REGISTRATION_NUMBER");
  }
  return normalized;
}

export function formatRegistrationNumber(value: string): string {
  let normalized: string;
  try {
    normalized = normalizeRegistrationNumber(value);
  } catch {
    return value.trim().toUpperCase();
  }
  return SWEDISH_REGISTRATION_NUMBER.test(normalized)
    ? `${normalized.slice(0, 3)} ${normalized.slice(3)}`
    : normalized;
}

export function canViewRegistrationNumber(input: {
  isSeller: boolean;
  isPlatformAdmin?: boolean;
  showRegistrationNumber: boolean;
  hasMarketplaceAccess: boolean;
  isAcceptedBuyer?: boolean;
}): boolean {
  if (input.isSeller || input.isPlatformAdmin || input.isAcceptedBuyer) return true;
  return input.showRegistrationNumber && input.hasMarketplaceAccess;
}

export function shouldRedactLicensePlate(showRegistrationNumber: boolean) {
  return !showRegistrationNumber;
}
