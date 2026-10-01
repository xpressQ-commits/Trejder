const colors = {
  background: "#f4f6f8",
  surface: "#ffffff",
  foreground: "#17212b",
  muted: "#5c6874",
  border: "#d8dee4",
  primary: "#164d78",
} as const;

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

type EmailLayoutInput = {
  title: string;
  preheader: string;
  logoUrl: string;
  content: string;
  year?: number;
};

export function renderEmailLayout(input: EmailLayoutInput): string {
  const title = escapeHtml(input.title);
  const preheader = escapeHtml(input.preheader);
  const logoUrl = escapeHtml(input.logoUrl);
  const year = input.year ?? new Date().getUTCFullYear();

  return `<!doctype html>
<html lang="sv">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light dark">
    <meta name="supported-color-schemes" content="light dark">
    <title>${title}</title>
    <style>
      @media only screen and (max-width: 620px) {
        .email-shell { padding: 20px 12px !important; }
        .email-card { padding: 32px 24px !important; }
        .email-heading { font-size: 26px !important; line-height: 32px !important; }
        .email-button { display: block !important; text-align: center !important; }
      }
      @media (prefers-color-scheme: dark) {
        .email-page { background: #111820 !important; }
        .email-card { background: #1b2530 !important; border-color: #34404c !important; }
        .email-heading, .email-copy { color: #f5f7f9 !important; }
        .email-muted { color: #c1c9d0 !important; }
        .email-divider { border-color: #34404c !important; }
      }
    </style>
  </head>
  <body class="email-page" style="margin:0;padding:0;background:${colors.background};color:${colors.foreground};font-family:Arial,Helvetica,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all;">${preheader}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="email-page" style="width:100%;background:${colors.background};">
      <tr>
        <td align="center" class="email-shell" style="padding:44px 20px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:580px;">
            <tr>
              <td class="email-card" style="padding:44px 48px;background:${colors.surface};border:1px solid ${colors.border};border-radius:18px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td align="left" style="padding:0 0 34px;">
                      <img src="${logoUrl}" width="144" alt="Trejder" style="display:block;width:144px;max-width:100%;height:auto;border:0;outline:none;text-decoration:none;color:${colors.foreground};font-size:20px;font-weight:700;">
                    </td>
                  </tr>
                  <tr>
                    <td>${input.content}</td>
                  </tr>
                  <tr>
                    <td class="email-divider" style="padding-top:38px;border-bottom:1px solid ${colors.border};font-size:0;line-height:0;">&nbsp;</td>
                  </tr>
                  <tr>
                    <td class="email-muted" style="padding-top:22px;color:${colors.muted};font-size:12px;line-height:18px;">
                      &copy; ${year} Trejder &middot; <a href="https://trejder.se" style="color:${colors.muted};text-decoration:underline;">trejder.se</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export const emailColors = colors;
