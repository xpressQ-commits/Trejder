export type TransactionalMessage = {
  to: string;
  subject: string;
  text: string;
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

let transport: EmailTransport | undefined;

export function setEmailTransport(next: EmailTransport): void {
  transport = next;
}

export function getEmailTransport(): EmailTransport {
  return transport ?? (process.env.NODE_ENV === "production"
    ? new UnconfiguredProductionTransport()
    : new DevelopmentEmailTransport());
}

export async function sendInvitationEmail(input: { email: string; token: string }): Promise<void> {
  const baseUrl = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
  const url = new URL(`/inbjudan/${encodeURIComponent(input.token)}`, baseUrl);
  await getEmailTransport().send({
    to: input.email,
    subject: "Inbjudan till Handlarbörsen",
    text: `Du har blivit inbjuden till Handlarbörsen. Öppna ${url.toString()}`,
  });
}
