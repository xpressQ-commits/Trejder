import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { VehicleListingForm } from "./vehicle-listing-form";
import type { OwnListing } from "./types";

const router = { push: vi.fn(), refresh: vi.fn() };

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));
vi.mock("@/components/preferences/preferences-provider", () => ({
  usePreferences: () => ({ locale: "sv" }),
}));

beforeAll(() => {
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: vi.fn((file: File) => `blob:${file.name}`),
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: vi.fn(),
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("VehicleListingForm image selection", () => {
  it("shows unlimited publication only for the platform-owner context", () => {
    const ordinary = render(<VehicleListingForm listing={ownListing([])} />);
    expect(
      screen.queryByRole("option", { name: "Obegränsad" }),
    ).not.toBeInTheDocument();
    ordinary.unmount();

    render(
      <VehicleListingForm listing={ownListing([])} allowUnlimitedPublication />,
    );
    expect(
      screen.getByRole("option", { name: "Obegränsad" }),
    ).toBeInTheDocument();
  });

  it("submits a null expiry duration only from the platform-owner option", async () => {
    const listing = ownListing([]);
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        listing: { ...listing, publicationHours: null },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<VehicleListingForm listing={listing} allowUnlimitedPublication />);
    fireEvent.change(screen.getByLabelText("Publiceringstid"), {
      target: { value: "unlimited" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Spara utkast" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.publicationHours).toBeNull();
  });

  it("selects, removes and submits multiple structured equipment values", async () => {
    const listing = ownListing([]);
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        listing: { ...listing, equipment: ["SURROUND_VIEW_CAMERA"] },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<VehicleListingForm listing={listing} />);
    fireEvent.click(screen.getByText("360° kamera"));
    fireEvent.click(screen.getByText("Apple CarPlay"));
    expect(screen.getByText(/2 valda/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("Apple CarPlay"));
    expect(screen.getByText(/1 valda/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Spara utkast" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.equipment).toEqual(["SURROUND_VIEW_CAMERA"]);
  });

  it("restores saved equipment in edit mode and allows it to be removed", () => {
    const listing = {
      ...ownListing([]),
      equipment: ["HEAD_UP_DISPLAY" as const],
    };
    render(<VehicleListingForm listing={listing} />);
    const checkbox = screen.getByRole("checkbox", { name: "Head-up display" });
    expect(checkbox).toBeChecked();
    fireEvent.click(screen.getByText("Head-up display"));
    expect(checkbox).not.toBeChecked();
  });

  it("selects multiple images, previews them, removes one and compacts the order", () => {
    render(<VehicleListingForm />);
    const input = screen.getByLabelText("Lägg till bilder") as HTMLInputElement;
    expect(input.multiple).toBe(true);

    const first = new File(["first"], "front.jpg", { type: "image/jpeg" });
    const second = new File(["second"], "side.jpg", { type: "image/jpeg" });
    fireEvent.change(input, { target: { files: [first, second] } });

    expect(screen.getByText("2 av 5 bilder valda")).toBeInTheDocument();
    expect(screen.getByAltText("Förhandsvisning av bild 1")).toHaveAttribute(
      "src",
      "blob:front.jpg",
    );
    expect(screen.getByAltText("Förhandsvisning av bild 2")).toHaveAttribute(
      "src",
      "blob:side.jpg",
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Ta bort" })[0]);

    expect(screen.getByText("1 av 5 bilder valda")).toBeInTheDocument();
    expect(screen.getByText(/Bild 1 · side\.jpg/)).toBeInTheDocument();
    expect(screen.queryByText(/front\.jpg/)).not.toBeInTheDocument();
  });

  it("keeps only five files and shows a clear limit error", () => {
    render(<VehicleListingForm />);
    const files = Array.from(
      { length: 6 },
      (_, index) =>
        new File([String(index)], `${index}.jpg`, { type: "image/jpeg" }),
    );
    fireEvent.change(screen.getByLabelText("Lägg till bilder"), {
      target: { files },
    });

    expect(screen.getByText("5 av 5 bilder valda")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Max 5 bilder är tillåtna. 1 bild lades inte till.",
    );
    expect(screen.getAllByAltText(/Förhandsvisning av bild/)).toHaveLength(5);
  });

  it("shows publication progress and keeps a successfully uploaded image after publication is blocked", async () => {
    const draft = ownListing([]);
    const uploaded = ownListing([
      {
        id: "22222222-2222-4222-8222-222222222222",
        position: 1,
        mimeType: "image/jpeg",
        byteSize: 5,
        plateRedactionStatus: "FAILED",
        plateConfidence: null,
        url: "/api/company/listings/11111111-1111-4111-8111-111111111111/images/1",
      },
    ]);
    let resolveSave!: (response: Response) => void;
    const saveResponse = new Promise<Response>((resolve) => {
      resolveSave = resolve;
    });
    const fetchMock = vi
      .fn()
      .mockReturnValueOnce(saveResponse)
      .mockResolvedValueOnce(Response.json({ listing: uploaded }))
      .mockResolvedValueOnce(
        Response.json({ error: "IMAGE_REDACTION_FAILED" }, { status: 409 }),
      );
    vi.stubGlobal("fetch", fetchMock);

    render(<VehicleListingForm />);
    fireEvent.change(screen.getByLabelText("Bilmodell"), {
      target: { value: "XC60" },
    });
    fireEvent.change(screen.getByLabelText("Årsmodell"), {
      target: { value: String(new Date().getFullYear()) },
    });
    fireEvent.change(screen.getByLabelText(/Miltal/), {
      target: { value: "1400" },
    });
    fireEvent.change(
      screen.getByPlaceholderText(
        "Svensksåld. M-sport. HUD. Några mindre märken.",
      ),
      { target: { value: "Fin bil" } },
    );
    fireEvent.change(screen.getByLabelText("Lägg till bilder"), {
      target: {
        files: [new File(["image"], "front.jpg", { type: "image/jpeg" })],
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Publicera bil" }));

    expect(
      await screen.findByRole("dialog", { name: "Förbereder publicering" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("progressbar", { name: "Publiceringsförlopp" }),
    ).toHaveAttribute("aria-valuenow", "8");

    resolveSave(Response.json({ listing: draft }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Bildkontrollen kunde inte slutföras",
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(screen.getByAltText("Fordonsbild 1")).toBeInTheDocument();
    expect(
      screen.queryByAltText("Förhandsvisning av bild 1"),
    ).not.toBeInTheDocument();
  });
});

function ownListing(images: OwnListing["images"]): OwnListing {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    identifier: { kind: "model", value: "XC60" },
    mileageMil: 1400,
    modelYear: new Date().getFullYear(),
    shortComment: "Fin bil",
    equipment: [],
    otherEquipment: null,
    deductibleVat: false,
    status: "draft",
    publicationHours: 48,
    createdAt: new Date().toISOString(),
    publishedAt: null,
    expiresAt: null,
    images,
  };
}
