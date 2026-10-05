export type DealStatus = "accepted" | "in_progress" | "completed";

export function confirmDealParty(input: {
  viewerIsSeller: boolean;
  sellerCompletedAt: Date | null;
  buyerCompletedAt: Date | null;
  now: Date;
}) {
  const sellerCompletedAt = input.viewerIsSeller
    ? (input.sellerCompletedAt ?? input.now)
    : input.sellerCompletedAt;
  const buyerCompletedAt = input.viewerIsSeller
    ? input.buyerCompletedAt
    : (input.buyerCompletedAt ?? input.now);
  const completed = Boolean(sellerCompletedAt && buyerCompletedAt);
  return {
    sellerCompletedAt,
    buyerCompletedAt,
    status: (completed ? "completed" : "in_progress") as DealStatus,
    completedAt: completed ? input.now : null,
  };
}
