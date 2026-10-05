import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { VehicleGallery } from "./vehicle-gallery";

vi.mock("next/image", () => ({
  default: () => <span data-testid="mock-image" />,
}));
afterEach(cleanup);

describe("VehicleGallery", () => {
  it("opens, navigates and closes the lightbox with keyboard controls", () => {
    render(
      <VehicleGallery
        label="Volvo XC60"
        images={[
          { position: 1, url: "/one.jpg" },
          { position: 2, url: "/two.jpg" },
        ]}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: /visa större bild av/i }),
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText("1 / 2")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(within(dialog).getByText("2 / 2")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
