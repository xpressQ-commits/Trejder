import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { VehicleListingForm } from "./vehicle-listing-form";

const router = { push: vi.fn(), refresh: vi.fn() };

vi.mock("next/navigation", () => ({
  useRouter: () => router,
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
});

describe("VehicleListingForm image selection", () => {
  it("selects multiple images, previews them, removes one and compacts the order", () => {
    render(<VehicleListingForm />);
    const input = screen.getByLabelText("Lägg till bilder") as HTMLInputElement;
    expect(input.multiple).toBe(true);

    const first = new File(["first"], "front.jpg", { type: "image/jpeg" });
    const second = new File(["second"], "side.jpg", { type: "image/jpeg" });
    fireEvent.change(input, { target: { files: [first, second] } });

    expect(screen.getByText("2 av 5 bilder valda")).toBeInTheDocument();
    expect(screen.getByAltText("Förhandsvisning av bild 1")).toHaveAttribute("src", "blob:front.jpg");
    expect(screen.getByAltText("Förhandsvisning av bild 2")).toHaveAttribute("src", "blob:side.jpg");

    fireEvent.click(screen.getAllByRole("button", { name: "Ta bort" })[0]);

    expect(screen.getByText("1 av 5 bilder valda")).toBeInTheDocument();
    expect(screen.getByText(/Bild 1 · side\.jpg/)).toBeInTheDocument();
    expect(screen.queryByText(/front\.jpg/)).not.toBeInTheDocument();
  });

  it("keeps only five files and shows a clear limit error", () => {
    render(<VehicleListingForm />);
    const files = Array.from({ length: 6 }, (_, index) => new File([String(index)], `${index}.jpg`, { type: "image/jpeg" }));
    fireEvent.change(screen.getByLabelText("Lägg till bilder"), { target: { files } });

    expect(screen.getByText("5 av 5 bilder valda")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Max 5 bilder är tillåtna. 1 bild lades inte till.");
    expect(screen.getAllByAltText(/Förhandsvisning av bild/)).toHaveLength(5);
  });
});
