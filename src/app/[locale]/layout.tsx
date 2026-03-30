import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "@/app/[locale]/globals.css";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { Providers } from "@/components/providers";
import { THEME_COOKIE_KEY } from "@/lib/theme-constants";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const themeInitScript = `
(() => {
  try {
    const root = document.documentElement;
    const isTheme = (value) =>
      value === "light" || value === "dark" || value === "system";
    const getCookieTheme = () => {
      const entry = document.cookie
        .split("; ")
        .find((row) => row.startsWith("${THEME_COOKIE_KEY}="));
      if (!entry) return null;
      const value = decodeURIComponent(entry.slice(entry.indexOf("=") + 1));
      return isTheme(value) ? value : null;
    };

    let theme = localStorage.getItem("theme");
    if (!isTheme(theme)) {
      theme = getCookieTheme();
    }
    const overrideRaw = localStorage.getItem("vestri_theme_override");

    if (overrideRaw) {
      try {
        const override = JSON.parse(overrideRaw);
        const validOverride =
          isTheme(override?.theme) &&
          typeof override?.at === "number" &&
          Date.now() - override.at <= 15000;
        if (validOverride) {
          theme = override.theme;
        } else {
          localStorage.removeItem("vestri_theme_override");
        }
      } catch {
        localStorage.removeItem("vestri_theme_override");
      }
    }

    if (!isTheme(theme)) {
      theme = "system";
    }

    const resolved =
      theme === "system"
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : theme;

    document.cookie = "${THEME_COOKIE_KEY}=" + encodeURIComponent(theme) + "; path=/; max-age=31536000; samesite=lax";
    root.classList.remove("light", "dark");
    root.classList.add(resolved);
    root.style.colorScheme = resolved;
  } catch {
    // no-op
  }
})();
`;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const activeLocale = hasLocale(routing.locales, locale)
    ? locale
    : routing.defaultLocale;
  const t = await getTranslations({
    locale: activeLocale,
    namespace: "AppMetadata",
  });
  return {
    title: t("title"),
    description: t("description"),
    icons: "/logos/vestri/vestri_no_font.ico",
  };
}

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  // Ensure that the incoming `locale` is valid
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  const cookieStore = await cookies();
  const cookieTheme = cookieStore.get(THEME_COOKIE_KEY)?.value;
  const initialThemeClass =
    cookieTheme === "dark" || cookieTheme === "light" ? cookieTheme : undefined;

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={initialThemeClass}
    >
      <head>
        <Script id="theme-init" strategy="afterInteractive">
          {themeInitScript}
        </Script>
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <NextIntlClientProvider>
          <Providers>
            <main className="min-h-screen">
              <div>{children}</div>
            </main>
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
