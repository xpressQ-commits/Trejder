import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MarketplaceDetail } from "./marketplace-detail";

vi.mock("@/components/vehicles/vehicle-gallery", () => ({
  VehicleGallery: () => <div data-testid="gallery">Gallery</div>,
}));
vi.mock("@/components/marketplace/marketplace-interactions", () => ({
  MarketplaceInteractions: () => (
    <div data-testid="activity">Budgivare och frågor</div>
  ),
}));
vi.mock("@/components/vehicles/seller-activity", () => ({
  SellerActivity: () => (
    <div data-testid="seller-activity">Säljarbud och frågor</div>
  ),
}));
vi.mock("@/components/vehicles/equipment-list", () => ({
  EquipmentList: () => <div data-testid="equipment">Utrustning</div>,
}));

afterEach(cleanup);

describe("marketplace detail layout", () => {
  it("places VAT beside mileage and orders gallery before the bid/question column", () => {
    render(
      <MarketplaceDetail
        listing={{
          id: "11111111-1111-4111-8111-111111111111",
          identifier: { kind: "model", value: "BMW iX3" },
          modelYear: 2026,
          mileageMil: 1450,
          shortComment: "Fin bil",
          equipment: [],
          otherEquipment: null,
          deductibleVat: true,
          publishedAt: "2026-10-09T12:00:00.000Z",
          expiresAt: "2026-10-11T12:00:00.000Z",
          isOwnListing: false,
          images: [],
        }}
        canBid
        hasSubscriptionAccess
      />,
    );

    expect(
      screen.getByText(/1[\s ]450 mil · Avdragbar moms/),
    ).toBeInTheDocument();
    const gallery = screen.getByTestId("gallery");
    const activity = screen.getByTestId("activity");
    expect(gallery.parentElement).toHaveClass(
      "lg:grid-cols-[minmax(0,2fr)_minmax(20rem,1fr)]",
    );
    expect(
      gallery.compareDocumentPosition(activity) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      activity.compareDocumentPosition(screen.getByText("Beskrivning")) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
