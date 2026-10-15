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
          registrationNumber: null,
          publisher: null,
          modelYear: 2026,
          mileageMil: 1450,
          shortComment: "Fin bil",
          county: null,
          deviations: [],
          wantedComment: null,
          damageImages: [],
          documents: [],
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

  it("shows registration and publisher details only when the server supplies them", () => {
    render(
      <MarketplaceDetail
        listing={{
          id: "11111111-1111-4111-8111-111111111111",
          identifier: { kind: "model", value: "Volvo XC60" },
          registrationNumber: "ABC123",
          publisher: {
            kind: "private",
            companyName: "Privatkonto",
            organizationNumber: "PRIVATE-123",
            contactName: "Anna Andersson",
            email: "anna@example.test",
            phone: "+46701234567",
          },
          modelYear: 2025,
          mileageMil: 1200,
          shortComment: "Fin bil",
          county: "Stockholms län",
          deviations: [],
          wantedComment: null,
          damageImages: [],
          documents: [],
          equipment: [],
          otherEquipment: null,
          deductibleVat: false,
          publishedAt: "2026-10-09T12:00:00.000Z",
          expiresAt: null,
          isOwnListing: false,
          images: [],
        }}
        canBid
        hasSubscriptionAccess
      />,
    );

    expect(screen.getByText("ABC 123")).toBeInTheDocument();
    expect(screen.getByText("Privatkund")).toBeInTheDocument();
    expect(screen.getByText("Anna Andersson")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "anna@example.test" })).toHaveAttribute(
      "href",
      "mailto:anna@example.test",
    );
  });

  it("hides an empty description and shows deviation details and county", () => {
    render(
      <MarketplaceDetail
        listing={{
          id: "11111111-1111-4111-8111-111111111111",
          identifier: { kind: "model", value: "Volvo XC60" },
          registrationNumber: null,
          publisher: null,
          modelYear: 2025,
          mileageMil: 1200,
          shortComment: "",
          county: "Stockholms län",
          deviations: ["WAS_WANTED", "REPAIRED"],
          wantedComment: "Återfunnen oskadad.",
          damageImages: [],
          documents: [],
          equipment: [],
          otherEquipment: null,
          deductibleVat: false,
          publishedAt: "2026-10-09T12:00:00.000Z",
          expiresAt: null,
          isOwnListing: false,
          images: [],
        }}
        canBid
        hasSubscriptionAccess
      />,
    );
    expect(screen.queryByText("Beskrivning")).not.toBeInTheDocument();
    expect(screen.getByText("Avvikelser 2")).toBeInTheDocument();
    expect(screen.getByText("Återfunnen oskadad.")).toBeInTheDocument();
    expect(screen.getByText(/Stockholms län/)).toBeInTheDocument();
  });
});
