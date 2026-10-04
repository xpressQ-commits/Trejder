import { afterEach, describe, expect, it } from "vitest";
import { renderAccountApplicationNotification, renderAccountApplicationReceipt, renderAccountApplicationRejection } from "./account-application";

describe("account application emails", () => {
  afterEach(() => { delete process.env.BETTER_AUTH_URL; });

  it("renders the application details for the review inbox and escapes HTML", () => {
    process.env.BETTER_AUTH_URL = "https://trejder.se";
    const message = renderAccountApplicationNotification({
      firstName: "Anna", lastName: "Andersson", companyName: "Bil & <Co>",
      organizationNumber: "556000-0000", phone: "070-123 45 67", email: "anna@example.com",
    });
    expect(message.subject).toContain("Bil & <Co>");
    expect(message.html).toContain("Bil &amp; &lt;Co&gt;");
    expect(message.html).toContain("https://trejder.se/brand/trejder-email.png");
  });

  it("confirms the 48-hour review without exposing an invitation link", () => {
    const message = renderAccountApplicationReceipt({ firstName: "Anna" });
    expect(message.text).toContain("inom 48 timmar");
    expect(message.text).toContain("inbjudningslänk");
    expect(message.html).not.toContain("/inbjudan/");
  });

  it("renders the rejection message with the support address", () => {
    const message = renderAccountApplicationRejection({ firstName: "Anna" });
    expect(message.text).toContain("kan vi inte godkänna er ansökan");
    expect(message.text).toContain("info@trejder.se");
    expect(message.html).toContain("mailto:info@trejder.se");
  });
});
