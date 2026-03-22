// src/hooks/useSyncUserTheme.ts
"use client";

import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { clearThemeOverride, getThemeOverride } from "@/lib/theme-sync";
import { isThemeMode, useTheme } from "@/components/theme-provider";

/**
 * Synchronisiert das in der NextAuth Session gespeicherte Theme
 * mit dem next-themes Provider.
 */
export function useSyncUserTheme() {
  // Ruft Session-Daten ab
  const { data: session, status } = useAuth();
  // Ruft next-themes-Funktionalität ab
  const { theme: currentClientTheme, setTheme: setClientTheme } = useTheme();

  // Der Theme-Wert aus der Datenbank/Session
  const userTheme = isThemeMode(session?.user?.theme)
    ? session.user.theme
    : null;

  useEffect(() => {
    const overrideTheme = getThemeOverride();
    if (overrideTheme) {
      if (currentClientTheme !== overrideTheme) {
        setClientTheme(overrideTheme);
        return;
      }
      if (status === "authenticated" && userTheme === overrideTheme) {
        clearThemeOverride();
      }
      return;
    }

    // Nur bei Session-/User-Theme Änderungen synchronisieren, nicht bei jedem lokalen Toggle.
    if (status === "authenticated" && userTheme) {
      if (currentClientTheme !== userTheme) {
        setClientTheme(userTheme);
      }
    }
  }, [status, userTheme, setClientTheme, currentClientTheme]);
}
