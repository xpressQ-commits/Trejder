import type { Role } from "./authorization";

export type MembershipState = "active" | "suspended" | "revoked";

export function canTransitionMembershipState(
  current: MembershipState,
  next: MembershipState,
): boolean {
  return current !== "revoked" || next === "revoked";
}

export function wouldRemoveLastActiveAdmin(input: {
  targetRole: Role;
  targetStatus: MembershipState;
  nextRole: Role;
  nextStatus: MembershipState;
  activeAdminCount: number;
}): boolean {
  const targetIsActiveAdmin = input.targetRole === "admin" && input.targetStatus === "active";
  const remainsActiveAdmin = input.nextRole === "admin" && input.nextStatus === "active";
  return targetIsActiveAdmin && !remainsActiveAdmin && input.activeAdminCount <= 1;
}
