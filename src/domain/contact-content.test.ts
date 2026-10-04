import { describe, expect, it } from "vitest";
import { containsContactInformation } from "./contact-content";

describe("contact information filter", () => {
  it.each(["anna@example.se", "anna @ example . se", "firma.se", "@anna", "www.example.se", "+46 70 123 45 67", "070-123 45 67", "skriv på WhatsApp", "kontakta mig"])('blocks %s', (value) => expect(containsContactInformation(value)).toBe(true));
  it.each(["Är kamremmen bytt?", "Har bilen gått 12 000 mil?", "Jag erbjuder 145 000 kronor."])('allows %s', (value) => expect(containsContactInformation(value)).toBe(false));
});
