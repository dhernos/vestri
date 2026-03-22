"use client";

import {
  useCallback,
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import { THEME_COOKIE_KEY } from "@/lib/theme-constants";

export type ThemeMode = "light" | "dark" | "system";
type ResolvedTheme = Exclude<ThemeMode, "system">;

type ThemeContextValue = {
  theme: ThemeMode;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: ThemeMode) => void;
};

type ThemeProviderProps = {
  children: React.ReactNode;
  attribute?: "class" | `data-${string}` | Array<"class" | `data-${string}`>;
  defaultTheme?: ThemeMode;
  enableSystem?: boolean;
  disableTransitionOnChange?: boolean;
  storageKey?: string;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);
const PREFERS_DARK = "(prefers-color-scheme: dark)";

export const isThemeMode = (value: unknown): value is ThemeMode =>
  value === "light" || value === "dark" || value === "system";

const getSystemTheme = (): ResolvedTheme => {
  if (typeof window === "undefined") return "light";
  return window.matchMedia(PREFERS_DARK).matches ? "dark" : "light";
};

const normalizeTheme = (theme: ThemeMode, enableSystem: boolean): ThemeMode => {
  if (!enableSystem && theme === "system") {
    return "light";
  }
  return theme;
};

const getThemeCookie = (): ThemeMode | null => {
  if (typeof document === "undefined") return null;
  const entry = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${THEME_COOKIE_KEY}=`));
  if (!entry) return null;
  const value = decodeURIComponent(entry.slice(entry.indexOf("=") + 1));
  return isThemeMode(value) ? value : null;
};

const applyThemeToDom = (
  resolvedTheme: ResolvedTheme,
  attribute: NonNullable<ThemeProviderProps["attribute"]>
) => {
  const root = document.documentElement;
  const targets = Array.isArray(attribute) ? attribute : [attribute];

  targets.forEach((target) => {
    if (target === "class") {
      root.classList.remove("light", "dark");
      root.classList.add(resolvedTheme);
      return;
    }
    root.setAttribute(target, resolvedTheme);
  });

  root.style.colorScheme = resolvedTheme;
};

const disableTransitionsTemporarily = () => {
  const style = document.createElement("style");
  style.appendChild(
    document.createTextNode(
      "*,*::before,*::after{transition:none!important;animation:none!important;}"
    )
  );
  document.head.appendChild(style);
  return () => {
    window.getComputedStyle(document.body);
    setTimeout(() => {
      document.head.removeChild(style);
    }, 1);
  };
};

export function ThemeProvider({
  children,
  attribute = "class",
  defaultTheme = "system",
  enableSystem = true,
  disableTransitionOnChange = false,
  storageKey = "theme",
}: ThemeProviderProps) {
  const normalizedDefaultTheme = normalizeTheme(defaultTheme, enableSystem);
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") return normalizedDefaultTheme;
    const persisted = window.localStorage.getItem(storageKey);
    if (isThemeMode(persisted)) {
      return normalizeTheme(persisted, enableSystem);
    }
    const cookieTheme = getThemeCookie();
    if (cookieTheme) {
      return normalizeTheme(cookieTheme, enableSystem);
    }
    return normalizedDefaultTheme;
  });
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(() =>
    getSystemTheme()
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia(PREFERS_DARK);
    const onChange = () => setSystemTheme(getSystemTheme());

    onChange();
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    }
    media.addListener(onChange);
    return () => media.removeListener(onChange);
  }, []);

  const resolvedTheme: ResolvedTheme =
    theme === "system" ? systemTheme : theme;

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.cookie = `${THEME_COOKIE_KEY}=${encodeURIComponent(theme)}; path=/; max-age=31536000; samesite=lax`;
  }, [theme]);

  useLayoutEffect(() => {
    const cleanup = disableTransitionOnChange
      ? disableTransitionsTemporarily()
      : null;
    applyThemeToDom(resolvedTheme, attribute);
    cleanup?.();
  }, [attribute, disableTransitionOnChange, resolvedTheme]);

  const setTheme = useCallback(
    (nextTheme: ThemeMode) => {
      const normalized = normalizeTheme(nextTheme, enableSystem);
      setThemeState(normalized);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(storageKey, normalized);
        document.cookie = `${THEME_COOKIE_KEY}=${encodeURIComponent(normalized)}; path=/; max-age=31536000; samesite=lax`;
      }
    },
    [enableSystem, storageKey]
  );

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
    }),
    [resolvedTheme, setTheme, theme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
