import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import "./globals.css";
import { PreferencesProvider } from "@/components/preferences/preferences-provider";
import { defaultLocale, isLocale, localeCookie } from "@/i18n/config";
import { getAuthenticatedUser } from "@/server/company/context";
import { getUserPreferences } from "@/server/preferences";
import { defaultTheme, isThemePreference, themeCookie } from "@/theme/config";

export const metadata: Metadata = {
  title: "Trejder",
  description: "En enkel marknadsplats för bilhandlare.",
};

const themeBootstrap = `(function(){try{var e=document.documentElement,a=e.dataset.authenticated==='true',p=e.dataset.themePreference||'system',l=e.dataset.locale||'sv';if(!a){var s=localStorage.getItem('trejder_theme'),c=localStorage.getItem('trejder_locale');if(s==='system'||s==='light'||s==='dark')p=s;if(c==='sv'||c==='en')l=c}var d=p==='dark'||(p==='system'&&matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light';e.dataset.themePreference=p;e.dataset.theme=d;e.lang=l;e.style.colorScheme=d}catch(_){}})();`;

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const currentUser = await getAuthenticatedUser(await headers());
  const stored = currentUser ? await getUserPreferences(currentUser.id) : null;
  const cookieStore = await cookies();
  const cookieTheme = cookieStore.get(themeCookie)?.value;
  const cookieLocale = cookieStore.get(localeCookie)?.value;
  const initialTheme = stored?.theme ?? (isThemePreference(cookieTheme) ? cookieTheme : defaultTheme);
  const initialLocale = stored?.locale ?? (isLocale(cookieLocale) ? cookieLocale : defaultLocale);
  return (
    <html lang={initialLocale} data-authenticated={currentUser ? "true" : "false"} data-theme-preference={initialTheme} data-locale={initialLocale} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeBootstrap }} /></head>
      <body><PreferencesProvider initialLocale={initialLocale} initialTheme={initialTheme} authenticated={Boolean(currentUser)}>{children}</PreferencesProvider></body>
    </html>
  );
}
