export type AcceptedDealChat = {
  acceptedBidId: string;
  sellerCompanyId: string;
  buyerCompanyId: string;
};

export function canAccessAcceptedDealChat(input: {
  companyId: string;
  bidId: string;
  deal: AcceptedDealChat | null;
}) {
  return Boolean(
    input.deal &&
    input.deal.acceptedBidId === input.bidId &&
    (input.companyId === input.deal.sellerCompanyId ||
      input.companyId === input.deal.buyerCompanyId),
  );
}
