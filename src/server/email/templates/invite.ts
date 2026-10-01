import { emailColors, escapeHtml, renderEmailLayout } from "./layout";

type InviteEmailInput = {
  inviteUrl: string;
  logoUrl: string;
  year?: number;
};

export function renderInviteEmail(input: InviteEmailInput): { subject: string; preheader: string; html: string; text: string } {
  const subject = "Inbjudan till Trejder";
  const preheader = "Du har blivit inbjuden att ansluta till Trejder.";
  const inviteUrl = escapeHtml(input.inviteUrl);
  const content = `
    <h1 class="email-heading" style="margin:0 0 18px;color:${emailColors.foreground};font-size:30px;line-height:38px;font-weight:700;letter-spacing:-0.02em;">Du har blivit inbjuden till Trejder</h1>
    <p class="email-copy" style="margin:0 0 28px;color:${emailColors.foreground};font-size:16px;line-height:25px;">Du har fått en inbjudan att skapa ett konto och ansluta till Trejder.</p>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 26px;">
      <tr>
        <td bgcolor="${emailColors.primary}" style="border-radius:10px;background:${emailColors.primary};mso-padding-alt:0;">
          <a class="email-button" href="${inviteUrl}" target="_blank" style="display:inline-block;padding:15px 24px;color:#ffffff;font-size:16px;line-height:20px;font-weight:700;text-decoration:none;border:1px solid ${emailColors.primary};border-radius:10px;">Acceptera inbjudan</a>
        </td>
      </tr>
    </table>
    <p class="email-muted" style="margin:0;color:${emailColors.muted};font-size:13px;line-height:20px;">Inbjudan är personlig. Dela inte länken med någon annan.</p>`;

  return {
    subject,
    preheader,
    html: renderEmailLayout({
      title: subject,
      preheader,
      logoUrl: input.logoUrl,
      content,
      year: input.year,
    }),
    text: `${preheader}\n\nAcceptera inbjudan:\n${input.inviteUrl}\n\nInbjudan är personlig. Dela inte länken med någon annan.`,
  };
}
