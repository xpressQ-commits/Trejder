import { emailColors, escapeHtml, renderEmailLayout } from "./layout";
import type { Locale } from "@/i18n/config";

type InviteEmailInput = {
  inviteUrl: string;
  logoUrl: string;
  year?: number;
  locale?: Locale;
};

export function renderInviteEmail(input: InviteEmailInput): { subject: string; preheader: string; html: string; text: string } {
  const english = input.locale === "en";
  const subject = english ? "Invitation to Trejder" : "Inbjudan till Trejder";
  const preheader = english ? "You have been invited to join Trejder." : "Du har blivit inbjuden att ansluta till Trejder.";
  const inviteUrl = escapeHtml(input.inviteUrl);
  const content = `
    <h1 class="email-heading" style="margin:0 0 18px;color:${emailColors.foreground};font-size:30px;line-height:38px;font-weight:700;letter-spacing:-0.02em;">${english ? "You have been invited to Trejder" : "Du har blivit inbjuden till Trejder"}</h1>
    <p class="email-copy" style="margin:0 0 28px;color:${emailColors.foreground};font-size:16px;line-height:25px;">${english ? "You have received an invitation to create an account and join Trejder." : "Du har fått en inbjudan att skapa ett konto och ansluta till Trejder."}</p>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 26px;">
      <tr>
        <td bgcolor="${emailColors.primary}" style="border-radius:10px;background:${emailColors.primary};mso-padding-alt:0;">
          <a class="email-button" href="${inviteUrl}" target="_blank" style="display:inline-block;padding:15px 24px;color:#ffffff;font-size:16px;line-height:20px;font-weight:700;text-decoration:none;border:1px solid ${emailColors.primary};border-radius:10px;">${english ? "Accept invitation" : "Acceptera inbjudan"}</a>
        </td>
      </tr>
    </table>
    <p class="email-muted" style="margin:0;color:${emailColors.muted};font-size:13px;line-height:20px;">${english ? "This invitation is personal. Do not share the link with anyone else." : "Inbjudan är personlig. Dela inte länken med någon annan."}</p>`;

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
    text: english ? `${preheader}\n\nAccept invitation:\n${input.inviteUrl}\n\nThis invitation is personal. Do not share the link with anyone else.` : `${preheader}\n\nAcceptera inbjudan:\n${input.inviteUrl}\n\nInbjudan är personlig. Dela inte länken med någon annan.`,
  };
}
