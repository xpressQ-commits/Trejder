import { describe, expect, it } from "vitest";
import { defaultTheme, resolveTheme } from "./config";
describe("theme preferences", () => { it("defaults to system", () => expect(defaultTheme).toBe("system")); it("follows system only in system mode", () => { expect(resolveTheme("system", true)).toBe("dark"); expect(resolveTheme("system", false)).toBe("light"); expect(resolveTheme("light", true)).toBe("light"); expect(resolveTheme("dark", false)).toBe("dark"); }); });
