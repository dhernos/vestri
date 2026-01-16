// src/app/providers.tsx
"use client";

import { ThemeProvider } from "next-themes";
import { useSyncUserTheme } from "@/hooks/syncTheme";
import { AuthProvider } from "@/hooks/useAuth";
import { ToastViewport } from "@/components/ui/toast";
import { QueryToastListener } from "@/components/query-toast-listener";
import { OAuthTwoFactorListener } from "@/components/oauth-twofactor-listener";

function ThemeSynchronizer({ children }: { children: React.ReactNode }) {
  useSyncUserTheme();
  return <>{children}</>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ThemeProvider
        enableSystem
        attribute="class"
        defaultTheme="system"
        disableTransitionOnChange
      >
        <ThemeSynchronizer>
          <QueryToastListener />
          <OAuthTwoFactorListener />
          {children}
          <ToastViewport />
        </ThemeSynchronizer>
      </ThemeProvider>
    </AuthProvider>
  );
}
