import { emailColors, escapeHtml, renderEmailLayout } from "./layout";

export type AccountApplication = {
  firstName: string;
  lastName: string;
  companyName: string;
  organizationNumber: string;
  phone: string;
  email: string;
};

export function renderAccountApplicationNotification(input: AccountApplication) {
  const subject = `Ny kontoansökan – ${input.companyName}`;
  const rows = [
    ["Namn", `${input.firstName} ${input.lastName}`],
    ["Företag", input.companyName],
    ["Organisationsnummer", input.organizationNumber],
    ["Telefon", input.phone],
    ["Mejladress", input.email],
  ].map(([label, value]) => `<tr><th align="left" style="padding:8px 14px 8px 0;color:${emailColors.muted};font-size:14px;">${escapeHtml(label)}</th><td style="padding:8px 0;color:${emailColors.foreground};font-size:14px;">${escapeHtml(value)}</td></tr>`).join("");
  return {
    subject,
    text: `Ny kontoansökan\n\nNamn: ${input.firstName} ${input.lastName}\nFöretag: ${input.companyName}\nOrganisationsnummer: ${input.organizationNumber}\nTelefon: ${input.phone}\nMejladress: ${input.email}`,
    html: renderEmailLayout({
      title: subject,
      preheader: `Ny kontoansökan från ${input.companyName}.`,
      logoUrl: logoUrl(),
      content: `<h1 class="email-heading" style="margin:0 0 18px;color:${emailColors.foreground};font-size:30px;line-height:38px;font-weight:700;">Ny kontoansökan</h1><table role="presentation" cellspacing="0" cellpadding="0" border="0">${rows}</table>`,
    }),
  };
}

export function renderAccountApplicationReceipt(input: Pick<AccountApplication, "firstName">) {
  const subject = "Vi har tagit emot din förfrågan till Trejder";
  const content = `<h1 class="email-heading" style="margin:0 0 18px;color:${emailColors.foreground};font-size:30px;line-height:38px;font-weight:700;letter-spacing:-0.02em;">Tack för din förfrågan, ${escapeHtml(input.firstName)}</h1><p class="email-copy" style="margin:0 0 18px;color:${emailColors.foreground};font-size:16px;line-height:25px;">Vi har tagit emot din ansökan om ett konto hos Trejder.</p><p class="email-copy" style="margin:0 0 18px;color:${emailColors.foreground};font-size:16px;line-height:25px;">Vi granskar uppgifterna och återkommer inom 48 timmar. Om ansökan godkänns får du en personlig inbjudningslänk via mejl.</p><p class="email-muted" style="margin:0;color:${emailColors.muted};font-size:13px;line-height:20px;">Du behöver inte svara på detta mejl.</p>`;
  return {
    subject,
    text: `Tack för din förfrågan, ${input.firstName}!\n\nVi har tagit emot din ansökan om ett konto hos Trejder. Vi återkommer inom 48 timmar. Om ansökan godkänns får du en personlig inbjudningslänk via mejl.`,
    html: renderEmailLayout({ title: subject, preheader: "Vi återkommer inom 48 timmar.", logoUrl: logoUrl(), content }),
  };
}

function logoUrl() {
  return new URL("/brand/trejder-email.png", process.env.BETTER_AUTH_URL ?? "http://localhost:3000").toString();
}
