import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { persistPreference, PreferencesProvider, usePreferences } from "./preferences-provider";

let systemDark = false;
let listener: (() => void) | undefined;
beforeEach(() => {
  localStorage.clear(); systemDark = false; listener = undefined;
  Object.defineProperty(window, "matchMedia", { configurable: true, value: vi.fn(() => ({ matches: systemDark, addEventListener: (_: string, next: () => void) => { listener = next; }, removeEventListener: vi.fn() })) });
  global.fetch = vi.fn(async () => new Response(null, { status: 200 })) as typeof fetch;
});
afterEach(cleanup);
function Harness() { const preferences = usePreferences(); return <><span>{preferences.locale}:{preferences.theme}</span><button onClick={() => void preferences.setTheme("light")}>light</button><button onClick={() => void preferences.setTheme("dark")}>dark</button><button onClick={() => void preferences.setTheme("system")}>system</button></>; }
function renderProvider(theme: "system" | "light" | "dark" = "system") { return render(<PreferencesProvider initialLocale="sv" initialTheme={theme} authenticated={false}><Harness /></PreferencesProvider>); }
describe("PreferencesProvider", () => {
  it("applies and persists manual overrides", async () => { renderProvider(); await act(async () => screen.getByText("dark").click()); expect(document.documentElement.dataset.theme).toBe("dark"); expect(localStorage.getItem("trejder_theme")).toBe("dark"); await act(async () => screen.getByText("light").click()); expect(document.documentElement.dataset.theme).toBe("light"); });
  it("restores the supplied preference", () => { renderProvider("dark"); expect(document.documentElement.dataset.theme).toBe("dark"); });
  it("persists a language choice for reloads", () => { persistPreference("trejder_locale", "en"); expect(localStorage.getItem("trejder_locale")).toBe("en"); expect(document.cookie).toContain("trejder_locale=en"); });
  it("reacts to OS changes only in system mode", async () => { renderProvider(); systemDark = true; act(() => listener?.()); expect(document.documentElement.dataset.theme).toBe("dark"); await act(async () => screen.getByText("light").click()); systemDark = false; act(() => listener?.()); expect(document.documentElement.dataset.theme).toBe("light"); });
});
