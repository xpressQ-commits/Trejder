import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EquipmentList } from "./equipment-list";

vi.mock("@/components/preferences/preferences-provider", () => ({
  usePreferences: () => ({ locale: "en" }),
}));
afterEach(cleanup);

describe("EquipmentList", () => {
  it("shows translated selected equipment and separate free text", () => {
    render(
      <EquipmentList
        equipment={["SURROUND_VIEW_CAMERA", "HARMAN_KARDON"]}
        otherEquipment="Ceramic brakes"
      />,
    );
    expect(screen.getByText("360° camera")).toBeInTheDocument();
    expect(screen.getByText("Harman/Kardon")).toBeInTheDocument();
    expect(screen.getByText("Ceramic brakes")).toBeInTheDocument();
  });
  it("renders nothing for an older listing without equipment", () => {
    const { container } = render(<EquipmentList equipment={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
