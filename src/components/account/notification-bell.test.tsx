import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NotificationBell } from "./notification-bell";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    onClick,
    ...props
  }: React.ComponentProps<"a">) => (
    <a
      href={href}
      {...props}
      onClick={(event) => {
        event.preventDefault();
        onClick?.(event);
      }}
    >
      {children}
    </a>
  ),
}));
vi.mock("@/components/preferences/preferences-provider", () => ({
  usePreferences: () => ({ locale: "sv" }),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const item = {
  id: "notification-1",
  type: "bid.accepted",
  body: "Ditt bud har accepterats",
  resourceType: "match",
  resourceId: "deal-1",
  readAt: null,
  createdAt: "2026-10-05T10:00:00.000Z",
};

describe("NotificationBell", () => {
  it("opens inside the viewport contract with an internally scrolling list", () => {
    render(<NotificationBell initialItems={[item]} />);
    fireEvent.click(screen.getByRole("button", { name: /notiser/i }));
    const dialog = screen.getByRole("dialog", { name: "Notiser" });
    expect(dialog.className).toContain("fixed");
    expect(dialog.className).toContain("right-4");
    expect(dialog.className).toContain("left-4");
    expect(dialog.className).toContain("lg:left-0");
    expect(dialog.className).toContain("lg:right-auto");
    expect(dialog.className).toContain("max-h-[min(70vh,37.5rem)]");
    expect(dialog.className).toContain("z-50");
    expect(dialog.querySelector("ul")?.className).toContain("overflow-y-auto");
  });

  it("closes with Escape and an outside click", () => {
    render(<NotificationBell initialItems={[item]} />);
    const button = screen.getByRole("button", { name: /notiser/i });
    fireEvent.click(button);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(button);
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("links accepted-bid notifications directly to the deal and closes", () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    render(<NotificationBell initialItems={[item]} />);
    fireEvent.click(screen.getByRole("button", { name: /notiser/i }));
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/app/affarer/deal-1");
    fireEvent.click(link);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens downward when placed in the desktop page header", () => {
    render(
      <NotificationBell initialItems={[item]} desktopPlacement="header" />,
    );
    fireEvent.click(screen.getByRole("button", { name: /notiser/i }));
    const dialog = screen.getByRole("dialog", { name: "Notiser" });
    expect(dialog.className).toContain("lg:top-full");
    expect(dialog.className).toContain("lg:right-0");
    expect(dialog.className).toContain("lg:bottom-auto");
    expect(dialog.className).toContain("lg:mt-2");
  });
});
