export const PREMIUM_BASE_MONTHLY_EX_VAT_ORE = 69_900;
export const INCLUDED_ACTIVE_USERS = 2;
export const EXTRA_USER_MONTHLY_EX_VAT_ORE = 19_900;
export type StripeBillingState = "none" | "active" | "past_due" | "unpaid" | "canceled";
export type BillingOverride = "manual_block" | "manual_premium" | null;

export type SubscriptionPolicyInput = Readonly<{
  override: BillingOverride;
  freeAccessEndsAt: Date | null;
  stripeState: StripeBillingState;
}>;

export type EffectiveSubscription = Readonly<{
  status: "GRATIS" | "PREMIUM" | "OBETALD";
  source: "free_access" | "manual_override" | "stripe" | "none";
  canAccess: boolean;
}>;

export function calculateBillableSeats(activeMembershipCount: number) {
  if (!Number.isSafeInteger(activeMembershipCount) || activeMembershipCount < 0) {
    throw new RangeError("activeMembershipCount must be a non-negative integer");
  }
  const extraUsers = Math.max(activeMembershipCount - INCLUDED_ACTIVE_USERS, 0);
  return {
    activeUsers: activeMembershipCount,
    includedUsers: INCLUDED_ACTIVE_USERS,
    extraUsers,
    baseMonthlyExVatOre: PREMIUM_BASE_MONTHLY_EX_VAT_ORE,
    extraMonthlyExVatOre: extraUsers * EXTRA_USER_MONTHLY_EX_VAT_ORE,
    totalMonthlyExVatOre:
      PREMIUM_BASE_MONTHLY_EX_VAT_ORE + extraUsers * EXTRA_USER_MONTHLY_EX_VAT_ORE,
  } as const;
}

/** Deterministic precedence: manual block > manual premium > live free access > Stripe. */
export function resolveSubscriptionAccess(
  input: SubscriptionPolicyInput,
  now = new Date(),
): EffectiveSubscription {
  if (input.override === "manual_block") {
    return { status: "OBETALD", source: "manual_override", canAccess: false };
  }
  if (input.override === "manual_premium") {
    return { status: "PREMIUM", source: "manual_override", canAccess: true };
  }
  if (input.freeAccessEndsAt && input.freeAccessEndsAt.getTime() > now.getTime()) {
    return { status: "GRATIS", source: "free_access", canAccess: true };
  }
  if (input.stripeState === "active" || input.stripeState === "past_due") {
    return { status: "PREMIUM", source: "stripe", canAccess: true };
  }
  return { status: "OBETALD", source: input.stripeState === "none" ? "none" : "stripe", canAccess: false };
}

export function stripeExtraUserQuantity(activeMembershipCount: number): number {
  return calculateBillableSeats(activeMembershipCount).extraUsers;
}
