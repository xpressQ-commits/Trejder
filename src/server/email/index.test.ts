import { afterEach, describe, expect, it, vi } from "vitest";
import { ResendEmailTransport, sendInvitationEmail, setEmailTransport, type TransactionalMessage } from "./index";

describe("ResendEmailTransport", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("sends transactional mail from the configured Trejder identity", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);
    const transport = new ResendEmailTransport("test-key");

    await transport.send({ to: "dealer@example.test", subject: "Inbjudan", text: "Hemlig länk", html: "<p>Inbjudan</p>" });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect(options.headers).toMatchObject({ Authorization: "Bearer test-key" });
    expect(JSON.parse(String(options.body))).toEqual({
      from: "Trejder <konto@trejder.se>",
      to: ["dealer@example.test"],
      subject: "Inbjudan",
      text: "Hemlig länk",
      html: "<p>Inbjudan</p>",
    });
  });

  it("does not expose the provider response body on failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("provider secret detail", { status: 403 })));
    const transport = new ResendEmailTransport("test-key");

    await expect(transport.send({ to: "dealer@example.test", subject: "Inbjudan", text: "Hemlig länk" }))
      .rejects.toThrow("Transactional email delivery failed with status 403");
  });

  it("keeps the existing invitation URL generation and passes it to the branded template", async () => {
    let sent: TransactionalMessage | undefined;
    setEmailTransport({
      async send(message) {
        sent = message;
      },
    });
    vi.stubEnv("BETTER_AUTH_URL", "https://trejder.se");

    await sendInvitationEmail({ email: "dealer@example.test", token: "abc/def?ghi" });

    expect(sent?.to).toBe("dealer@example.test");
    expect(sent?.html).toContain('href="https://trejder.se/inbjudan/abc%2Fdef%3Fghi"');
    expect(sent?.html).toContain('src="https://trejder.se/brand/trejder-email.png"');
    expect(sent?.text).toContain("https://trejder.se/inbjudan/abc%2Fdef%3Fghi");
  });
});
