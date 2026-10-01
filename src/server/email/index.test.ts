import { afterEach, describe, expect, it, vi } from "vitest";
import { ResendEmailTransport } from "./index";

describe("ResendEmailTransport", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends transactional mail from the configured Trejder identity", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);
    const transport = new ResendEmailTransport("test-key");

    await transport.send({ to: "dealer@example.test", subject: "Inbjudan", text: "Hemlig länk" });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect(options.headers).toMatchObject({ Authorization: "Bearer test-key" });
    expect(JSON.parse(String(options.body))).toEqual({
      from: "Trejder <konto@trejder.se>",
      to: ["dealer@example.test"],
      subject: "Inbjudan",
      text: "Hemlig länk",
    });
  });

  it("does not expose the provider response body on failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("provider secret detail", { status: 403 })));
    const transport = new ResendEmailTransport("test-key");

    await expect(transport.send({ to: "dealer@example.test", subject: "Inbjudan", text: "Hemlig länk" }))
      .rejects.toThrow("Transactional email delivery failed with status 403");
  });
});
