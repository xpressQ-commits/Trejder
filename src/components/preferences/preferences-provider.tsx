"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { translate, type Locale, type TranslationKey } from "@/i18n";
import { localeCookie } from "@/i18n/config";
import {
  resolveTheme,
  themeCookie,
  type ThemePreference,
} from "@/theme/config";

type PreferencesContextValue = {
  locale: Locale;
  theme: ThemePreference;
  setLocale(locale: Locale): Promise<void>;
  setTheme(theme: ThemePreference): Promise<void>;
  t(key: TranslationKey): string;
};
const PreferencesContext = createContext<PreferencesContextValue | null>(null);

function applyTheme(preference: ThemePreference) {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  document.documentElement.dataset.themePreference = preference;
  document.documentElement.dataset.theme = resolveTheme(
    preference,
    media.matches,
  );
  document.documentElement.style.colorScheme = resolveTheme(
    preference,
    media.matches,
  );
}
export function persistPreference(name: string, value: string) {
  localStorage.setItem(name, value);
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

export function PreferencesProvider({
  initialLocale,
  initialTheme,
  authenticated,
  children,
}: {
  initialLocale: Locale;
  initialTheme: ThemePreference;
  authenticated: boolean;
  children: ReactNode;
}) {
  const [locale, setLocaleState] = useState(initialLocale);
  const [theme, setThemeState] = useState(initialTheme);
  useEffect(() => {
    applyTheme(theme);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const changed = () => {
      if (theme === "system") applyTheme("system");
    };
    media.addEventListener("change", changed);
    return () => media.removeEventListener("change", changed);
  }, [theme]);
  useEffect(() => {
    if (authenticated) {
      persistPreference(themeCookie, theme);
      persistPreference(localeCookie, locale);
    }
  }, [authenticated, locale, theme]);
  const save = useCallback(
    async (nextTheme: ThemePreference, nextLocale: Locale) => {
      persistPreference(themeCookie, nextTheme);
      persistPreference(localeCookie, nextLocale);
      if (authenticated)
        await fetch("/api/account/preferences", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ theme: nextTheme, locale: nextLocale }),
        });
    },
    [authenticated],
  );
  const setTheme = useCallback(
    async (next: ThemePreference) => {
      setThemeState(next);
      applyTheme(next);
      await save(next, locale);
    },
    [locale, save],
  );
  const setLocale = useCallback(
    async (next: Locale) => {
      setLocaleState(next);
      await save(theme, next);
      window.location.reload();
    },
    [save, theme],
  );
  const value = useMemo(
    () => ({
      locale,
      theme,
      setLocale,
      setTheme,
      t: (key: TranslationKey) => translate(locale, key),
    }),
    [locale, setLocale, setTheme, theme],
  );
  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
}
export function usePreferences() {
  const value = useContext(PreferencesContext);
  if (!value) throw new Error("PreferencesProvider is missing");
  return value;
}
