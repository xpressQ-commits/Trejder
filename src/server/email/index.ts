import { renderInviteEmail } from "./templates/invite";

export type TransactionalMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export interface EmailTransport {
  send(message: TransactionalMessage): Promise<void>;
}

class DevelopmentEmailTransport implements EmailTransport {
  async send(message: TransactionalMessage): Promise<void> {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Development email transport cannot run in production");
    }
    // Token-bearing URLs are intentionally visible only in local/test development.
    console.info("[development-email]", message);
  }
}

class UnconfiguredProductionTransport implements EmailTransport {
  async send(): Promise<void> {
    throw new Error("A production transactional email adapter is not configured");
  }
}

const DEFAULT_FROM = "Trejder <konto@trejder.se>";

export class ResendEmailTransport implements EmailTransport {
  constructor(
    private readonly apiKey: string,
    private readonly from = DEFAULT_FROM,
  ) {}

  async send(message: TransactionalMessage): Promise<void> {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: this.from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        ...(message.html ? { html: message.html } : {}),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      throw new Error(`Transactional email delivery failed with status ${response.status}`);
    }
  }
}

let transport: EmailTransport | undefined;

export function setEmailTransport(next: EmailTransport): void {
  transport = next;
}

export function getEmailTransport(): EmailTransport {
  if (transport) return transport;
  if (process.env.NODE_ENV !== "production") return new DevelopmentEmailTransport();
  const apiKey = process.env.RESEND_API_KEY;
  return apiKey
    ? new ResendEmailTransport(apiKey, process.env.TRANSACTIONAL_EMAIL_FROM ?? DEFAULT_FROM)
    : new UnconfiguredProductionTransport();
}

export async function sendInvitationEmail(input: { email: string; token: string }): Promise<void> {
  const baseUrl = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
  const url = new URL(`/inbjudan/${encodeURIComponent(input.token)}`, baseUrl);
  const logoUrl = new URL("/brand/trejder-email.png", baseUrl);
  const message = renderInviteEmail({ inviteUrl: url.toString(), logoUrl: logoUrl.toString() });
  await getEmailTransport().send({
    to: input.email,
    subject: message.subject,
    text: message.text,
    html: message.html,
  });
}
