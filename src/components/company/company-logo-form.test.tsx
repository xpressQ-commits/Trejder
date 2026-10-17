import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CompanyLogoForm } from "./company-logo-form";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("CompanyLogoForm", () => {
  it("uploads a selected logo and notifies the agreement form immediately", async () => {
    const onUploaded = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue(Response.json({
      logoUrl: "/api/company/profile/logo",
    }));
    vi.stubGlobal("fetch", fetchMock);
    render(<CompanyLogoForm hasLogo={false} onUploaded={onUploaded} embedded />);

    const button = screen.getByRole("button", { name: "Ladda upp logotyp" });
    expect(button).toBeDisabled();

    const file = new File(["logo"], "foretag.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText("Välj logotyp"), {
      target: { files: [file] },
    });
    expect(button).toBeEnabled();
    fireEvent.click(button);

    await waitFor(() => expect(onUploaded).toHaveBeenCalledOnce());
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/company/profile/logo",
      expect.objectContaining({ method: "POST", body: expect.any(FormData) }),
    );
    expect(screen.getByAltText("Företagslogotyp")).toBeInTheDocument();
    expect(
      screen.getByText("Företagslogotypen har sparats och används i nya avtal."),
    ).toBeInTheDocument();
  });
});
