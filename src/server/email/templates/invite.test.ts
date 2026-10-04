import { describe, expect, it } from "vitest";
import { renderInviteEmail } from "./invite";

describe("renderInviteEmail", () => {
  it("renders a branded invitation with the token URL behind the CTA", () => {
    const inviteUrl = "https://trejder.se/inbjudan/secret-token";
    const result = renderInviteEmail({
      inviteUrl,
      logoUrl: "https://trejder.se/brand/trejder-email.png",
      year: 2026,
    });

    expect(result.subject).toBe("Inbjudan till Trejder");
    expect(result.html).toContain('src="https://trejder.se/brand/trejder-email.png"');
    expect(result.html).toContain(`href="${inviteUrl}"`);
    expect(result.html).toContain(">Acceptera inbjudan</a>");
    expect(result.html.replace(/<[^>]+>/g, " ")).not.toContain(inviteUrl);
    expect(result.html).toContain("&copy; 2026 Trejder");
    expect(result.text).toContain(inviteUrl);
  });

  it("escapes URLs before placing them in HTML attributes", () => {
    const result = renderInviteEmail({
      inviteUrl: 'https://trejder.se/inbjudan/a"b&c',
      logoUrl: 'https://trejder.se/logo.png?x=1&y="2"',
    });

    expect(result.html).toContain('href="https://trejder.se/inbjudan/a&quot;b&amp;c"');
    expect(result.html).toContain('src="https://trejder.se/logo.png?x=1&amp;y=&quot;2&quot;"');
  });

  it("can render an English invitation", () => {
    const result = renderInviteEmail({ inviteUrl: "https://trejder.se/invite", logoUrl: "https://trejder.se/logo.png", locale: "en" });
    expect(result.subject).toBe("Invitation to Trejder");
    expect(result.html).toContain(">Accept invitation</a>");
  });
});
