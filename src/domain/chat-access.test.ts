import { describe, expect, it } from "vitest";
import { canAccessAcceptedDealChat } from "./chat-access";

const deal = {
  acceptedBidId: "accepted",
  sellerCompanyId: "seller",
  buyerCompanyId: "buyer",
};

describe("accepted-deal chat policy", () => {
  it("denies access without an accepted deal or for a merely placed bid", () => {
    expect(
      canAccessAcceptedDealChat({
        companyId: "seller",
        bidId: "active",
        deal: null,
      }),
    ).toBe(false);
    expect(
      canAccessAcceptedDealChat({ companyId: "seller", bidId: "active", deal }),
    ).toBe(false);
  });
  it("allows only the accepted buyer and seller", () => {
    expect(
      canAccessAcceptedDealChat({
        companyId: "seller",
        bidId: "accepted",
        deal,
      }),
    ).toBe(true);
    expect(
      canAccessAcceptedDealChat({
        companyId: "buyer",
        bidId: "accepted",
        deal,
      }),
    ).toBe(true);
    expect(
      canAccessAcceptedDealChat({
        companyId: "other",
        bidId: "accepted",
        deal,
      }),
    ).toBe(false);
  });
});
