// src/proxy.ts

import { NextResponse } from "next/server";
import { pageAccess, PUBLIC_ROLE, type Role } from "@/lib/auth.config";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";
import type { NextRequest } from "next/server";
import type { SupportedLocale } from "@/i18n/routing";

const GO_API_URL = process.env.GO_API_URL || "http://localhost:8080";

// ---------------------------------------------
// 1. next-intl Middleware (Locale handling)
// ---------------------------------------------

const intlMiddleware = createIntlMiddleware({
  locales: routing.locales,
  defaultLocale: routing.defaultLocale,
  localePrefix: routing.localePrefix,
});

const findAccessForPath = (path: string) => {
  return pageAccess.find((route) => {
    if (route.path === "/") {
      return path === "/";
    }
    return path.startsWith(route.path);
  });
};

const hasPublicAccess = (roles: Role[]) => roles.includes(PUBLIC_ROLE);

const isRole = (value: string): value is Role =>
  value === "PUBLIC" ||
  value === "USER" ||
  value === "ADMIN" ||
  value === "EDITOR";

const fetchSessionRole = async (
  req: NextRequest
): Promise<{ role: Role | null; status: number | null }> => {
  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader) {
    return { role: null, status: 401 };
  }

  try {
    const res = await fetch(`${GO_API_URL}/api/auth/me`, {
      headers: { cookie: cookieHeader },
      cache: "no-store",
    });

    if (!res.ok) {
      return { role: null, status: res.status };
    }

    const data = (await res.json()) as { role?: string };
    if (typeof data.role !== "string" || !isRole(data.role)) {
      return { role: null, status: res.status };
    }

    return { role: data.role, status: res.status };
  } catch {
    return { role: null, status: null };
  }
};

export default async function proxy(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  const getPathnameWithoutLocale = () => {
    const parts = pathname.split("/");
    const possibleLocale = parts[1];
    if (routing.locales.includes(possibleLocale as SupportedLocale)) {
      return "/" + parts.slice(2).join("/");
    }
    return pathname;
  };

  const pathnameWithoutLocale = getPathnameWithoutLocale();
  const currentLocale = pathname.split("/")[1];

  const access = findAccessForPath(pathnameWithoutLocale);
  if (!access) {
    const target = routing.locales.includes(currentLocale as SupportedLocale)
      ? `/${currentLocale}/access-denied`
      : "/access-denied";
    return NextResponse.redirect(new URL(target, req.url));
  }

  if (hasPublicAccess(access.roles)) {
    return intlMiddleware(req);
  }

  const sessionCookie = req.cookies.get("session_id")?.value;
  if (!sessionCookie) {
    const targetPath =
      currentLocale &&
      routing.locales.includes(currentLocale as SupportedLocale)
        ? `/${currentLocale}/login`
        : "/login";
    const loginUrl = new URL(targetPath, req.url);
    const callbackUrl = `${req.nextUrl.pathname}${req.nextUrl.search}`;
    loginUrl.searchParams.set("callbackUrl", callbackUrl);
    return NextResponse.redirect(loginUrl);
  }

  const roleResult = await fetchSessionRole(req);
  if (!roleResult.role) {
    if (roleResult.status === 401) {
      const targetPath =
        currentLocale &&
        routing.locales.includes(currentLocale as SupportedLocale)
          ? `/${currentLocale}/login`
          : "/login";
      const loginUrl = new URL(targetPath, req.url);
      const callbackUrl = `${req.nextUrl.pathname}${req.nextUrl.search}`;
      loginUrl.searchParams.set("callbackUrl", callbackUrl);
      return NextResponse.redirect(loginUrl);
    }

    const target = routing.locales.includes(currentLocale as SupportedLocale)
      ? `/${currentLocale}/access-denied`
      : "/access-denied";
    return NextResponse.redirect(new URL(target, req.url));
  }

  if (!access.roles.includes(roleResult.role)) {
    const target = routing.locales.includes(currentLocale as SupportedLocale)
      ? `/${currentLocale}/access-denied`
      : "/access-denied";
    return NextResponse.redirect(new URL(target, req.url));
  }

  return intlMiddleware(req);
}

// ---------------------------------------------
// 4. Matcher-Konfiguration
// ---------------------------------------------

export const config = {
  // Matcht ALLE relevanten Pfade (inkl. Locales, aber exkl. _next/static etc.)
  matcher: ["/((?!api|_next/static|_next/image|images|favicon.ico|.*\\..*).*)"],
};
