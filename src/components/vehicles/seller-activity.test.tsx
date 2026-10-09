import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SellerActivity } from "./seller-activity";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/components/preferences/preferences-provider", () => ({
  usePreferences: () => ({ locale: "sv", t: (key: string) => key }),
}));
vi.mock("@/components/chat/start-chat-button", () => ({
  StartChatButton: () => null,
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const bid = (id: string, bidderLabel: string, amountOre: number) => ({
  id,
  bidderLabel,
  amountOre,
  status: "active",
  createdAt: "2026-10-09T12:00:00.000Z",
  updatedAt: "2026-10-09T12:00:00.000Z",
});

describe("SellerActivity", () => {
  it("shows backend-ranked top three, keeps questions below, and loads the next bid after rejection", async () => {
    let bidReads = 0;
    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        if (init?.method === "POST")
          return Response.json({ bid: { status: "rejected" } });
        if (url.endsWith("/questions")) {
          return Response.json({
            questions: [
              {
                id: "q1",
                body: "Servicebok?",
                answerBody: null,
                authorLabel: "Handlare Q",
              },
            ],
          });
        }
        bidReads += 1;
        return Response.json(
          bidReads === 1
            ? {
                bids: [
                  bid("a", "Handlare A", 30_000_000),
                  bid("b", "Handlare B", 29_000_000),
                  bid("c", "Handlare C", 28_000_000),
                ],
                acceptedBid: null,
                totalActiveBidders: 4,
              }
            : {
                bids: [
                  bid("b", "Handlare B", 29_000_000),
                  bid("c", "Handlare C", 28_000_000),
                  bid("d", "Handlare D", 27_000_000),
                ],
                acceptedBid: null,
                totalActiveBidders: 3,
              },
        );
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal(
      "confirm",
      vi.fn(() => true),
    );

    render(<SellerActivity listingId="listing-1" canMutate />);
    expect(
      await screen.findAllByRole("button", { name: "bids.accept" }),
    ).toHaveLength(3);
    expect(screen.getAllByRole("button", { name: "bids.reject" })).toHaveLength(
      3,
    );
    expect(
      screen
        .getByText("bids.title")
        .compareDocumentPosition(screen.getByText("questions.title")) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    fireEvent.click(screen.getAllByRole("button", { name: "bids.reject" })[0]);
    await waitFor(() =>
      expect(screen.getByText("Handlare D")).toBeInTheDocument(),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/company/listings/listing-1/bids/a/reject",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ rejectionConfirmed: true }),
      }),
    );
  });
});
