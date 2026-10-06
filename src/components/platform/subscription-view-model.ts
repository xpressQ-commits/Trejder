export type SubscriptionBusinessStatus = "free" | "premium" | "unpaid";
export type SubscriptionSource =
  | "stripe"
  | "manual_override"
  | "free_access"
  | "none";

export type PlatformCompanySubscriptionSummary = {
  status: SubscriptionBusinessStatus;
  source: SubscriptionSource;
  freeUntil: Date | string | null;
  stripeStatus: string | null;
};

export type PlatformCompanyListItem = {
  id: string;
  legalName: string;
  organizationNumber: string;
  contactPhone: string | null;
  activeUserCount: number;
  includedUserCount: number;
  extraBillableUserCount: number;
  subscription: PlatformCompanySubscriptionSummary;
};

export type PlatformCompanyMemberView = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "trader" | "viewer" | "private_customer";
  status: "active" | "suspended" | "revoked";
  isBillableSeat: boolean;
};

export type PlatformCompanyBillingDetail = PlatformCompanyListItem & {
  contactEmail: string;
  createdAt: Date | string;
  subscription: PlatformCompanySubscriptionSummary & {
    periodEnd: Date | string | null;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    monthlyBaseAmountOre: number;
    monthlyExtraUserAmountOre: number;
    monthlyTotalAmountOre: number;
    overrideReason: string | null;
  };
  members: PlatformCompanyMemberView[];
};

const statusLabels: Record<SubscriptionBusinessStatus, string> = {
  free: "Gratis",
  premium: "Premium",
  unpaid: "Obetald",
};

const sourceLabels: Record<SubscriptionSource, string> = {
  stripe: "Stripe",
  manual_override: "Manuell override",
  free_access: "Fri åtkomst",
  none: "Ingen aktiv källa",
};

const roleLabels: Record<PlatformCompanyMemberView["role"], string> = {
  admin: "Administratör",
  trader: "Handlare",
  viewer: "Läsbehörighet",
  private_customer: "Privatkund",
};

const membershipLabels: Record<PlatformCompanyMemberView["status"], string> = {
  active: "Aktiv",
  suspended: "Pausad",
  revoked: "Återkallad",
};

export function subscriptionStatusLabel(status: SubscriptionBusinessStatus) {
  return statusLabels[status];
}

export function subscriptionSourceLabel(source: SubscriptionSource) {
  return sourceLabels[source];
}

export function membershipRoleLabel(role: PlatformCompanyMemberView["role"]) {
  return roleLabels[role];
}

export function membershipStatusLabel(
  status: PlatformCompanyMemberView["status"],
) {
  return membershipLabels[status];
}

export function formatAdminDate(value: Date | string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("sv-SE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Stockholm",
  }).format(new Date(value));
}

export function formatSekFromOre(amountOre: number) {
  return new Intl.NumberFormat("sv-SE", {
    style: "currency",
    currency: "SEK",
    maximumFractionDigits: 0,
  }).format(amountOre / 100);
}
