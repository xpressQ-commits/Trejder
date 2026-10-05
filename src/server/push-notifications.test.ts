import { describe, expect, it } from "vitest";
import { isTrustedPushEndpoint, notificationUrl } from "./push-notifications";

describe("push notifications", () => {
  it("only permits known HTTPS browser push services", () => {
    expect(
      isTrustedPushEndpoint("https://fcm.googleapis.com/fcm/send/abc"),
    ).toBe(true);
    expect(isTrustedPushEndpoint("https://web.push.apple.com/Q123/abc")).toBe(
      true,
    );
    expect(
      isTrustedPushEndpoint("http://fcm.googleapis.com/fcm/send/abc"),
    ).toBe(false);
    expect(isTrustedPushEndpoint("https://attacker.example/internal")).toBe(
      false,
    );
    expect(
      isTrustedPushEndpoint("https://fcm.googleapis.com.attacker.example/x"),
    ).toBe(false);
  });

  it("deep-links without exposing participant identity", () => {
    expect(
      notificationUrl({
        type: "bid.received",
        resourceType: "listing",
        resourceId: "listing-1",
      }),
    ).toBe("/app/bilar/listing-1");
    expect(
      notificationUrl({
        type: "bid.accepted",
        resourceType: "match",
        resourceId: "match-1",
      }),
    ).toBe("/app/affarer/match-1");
    expect(
      notificationUrl({
        type: "unknown",
        resourceType: "unknown",
        resourceId: "unknown",
      }),
    ).toBe("/app");
  });
});
