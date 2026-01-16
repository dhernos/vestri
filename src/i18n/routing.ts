import { defineRouting } from "next-intl/routing";

export type SupportedLocale = "en" | "de";

export const routing = defineRouting({
  // A list of all locales that are supported
  locales: ["en", "de"],

  // Used when no locale matches
  defaultLocale: "en",

  // WICHTIG: erzwingt Locale-Prefix (z.B. /de/...)
  localePrefix: "always",
});
