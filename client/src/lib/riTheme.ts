import { useCallback, useEffect, useState } from "react";

export type RITheme = "light" | "warm-dark" | "dark";

export const RI_THEME_STORAGE_KEY = "ri-ui-theme";
export const DEFAULT_RI_THEME: RITheme = "dark";

export function isRITheme(value: string | null): value is RITheme {
  return value === "light" || value === "warm-dark" || value === "dark";
}

export function getStoredRITheme(): RITheme {
  if (typeof window === "undefined") return DEFAULT_RI_THEME;
  const stored = window.localStorage.getItem(RI_THEME_STORAGE_KEY);
  return isRITheme(stored) ? stored : DEFAULT_RI_THEME;
}

export function applyRITheme(theme: RITheme, persist = true) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.riTheme = theme;
  if (persist && typeof window !== "undefined") {
    window.localStorage.setItem(RI_THEME_STORAGE_KEY, theme);
    window.dispatchEvent(new CustomEvent("ri-theme-change", { detail: theme }));
  }
}

export function initialiseRITheme() {
  const theme = getStoredRITheme();
  applyRITheme(theme, false);
  return theme;
}

export function useRITheme() {
  const [theme, setThemeState] = useState<RITheme>(() => getStoredRITheme());

  useEffect(() => {
    applyRITheme(theme, false);

    const handleThemeChange = (event: Event) => {
      const next = (event as CustomEvent<RITheme>).detail;
      if (isRITheme(next)) setThemeState(next);
    };

    window.addEventListener("ri-theme-change", handleThemeChange);
    return () => window.removeEventListener("ri-theme-change", handleThemeChange);
  }, [theme]);

  const setTheme = useCallback((next: RITheme) => {
    setThemeState(next);
    applyRITheme(next, true);
  }, []);

  return { theme, setTheme };
}
