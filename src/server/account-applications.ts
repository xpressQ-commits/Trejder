import { getEmailTransport } from "@/server/email";
import { renderAccountApplicationNotification, renderAccountApplicationReceipt, type AccountApplication } from "@/server/email/templates/account-application";

export async function sendAccountApplication(input: AccountApplication): Promise<void> {
  const transport = getEmailTransport();
  const notification = renderAccountApplicationNotification(input);
  await transport.send({
    from: "Trejder kontoansökan <noreply@trejder.se>",
    to: "ansokan@trejder.se",
    ...notification,
  });
  const receipt = renderAccountApplicationReceipt({ firstName: input.firstName });
  await transport.send({
    from: "Trejder <noreply@trejder.se>",
    to: input.email,
    ...receipt,
  });
}
