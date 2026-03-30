"use client";

export type ThemeMode = "light" | "dark" | "system";

const THEME_OVERRIDE_KEY = "vestri_theme_override";
const THEME_OVERRIDE_TTL_MS = 15_000;

type ThemeOverride = {
  theme: ThemeMode;
  at: number;
};

const isThemeMode = (value: unknown): value is ThemeMode =>
  value === "light" || value === "dark" || value === "system";

export function setThemeOverride(theme: ThemeMode) {
  if (typeof window === "undefined") return;
  const payload: ThemeOverride = { theme, at: Date.now() };
  window.localStorage.setItem(THEME_OVERRIDE_KEY, JSON.stringify(payload));
}

export function getThemeOverride(): ThemeMode | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(THEME_OVERRIDE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<ThemeOverride>;
    if (!isThemeMode(parsed?.theme) || typeof parsed?.at !== "number") {
      window.localStorage.removeItem(THEME_OVERRIDE_KEY);
      return null;
    }
    if (Date.now() - parsed.at > THEME_OVERRIDE_TTL_MS) {
      window.localStorage.removeItem(THEME_OVERRIDE_KEY);
      return null;
    }
    return parsed.theme;
  } catch {
    window.localStorage.removeItem(THEME_OVERRIDE_KEY);
    return null;
  }
}

export function clearThemeOverride() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(THEME_OVERRIDE_KEY);
}
