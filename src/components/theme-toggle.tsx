// src/components/theme-toggle.tsx
"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl"; // <-- Import für next-intl
import { Button } from "./ui/button";
import { MoonIcon, SunIcon } from "@radix-ui/react-icons";
import { useAuth } from "@/hooks/useAuth";
import { clearThemeOverride, setThemeOverride } from "@/lib/theme-sync";
import { useTheme } from "@/components/theme-provider";

export default function ThemeToggle({
  showText = false,
}: {
  showText?: boolean;
}) {
  const { setTheme, resolvedTheme } = useTheme();
  const { status, updateUser } = useAuth();
  const t = useTranslations("Common"); // Verwenden des Common-Namespaces
  const [mounted, setMounted] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  const handleToggleTheme = async () => {
    if (saving) return;

    const currentTheme = resolvedTheme === "dark" ? "dark" : "light";
    const nextTheme = currentTheme === "dark" ? "light" : "dark";
    setThemeOverride(nextTheme);
    setTheme(nextTheme);

    if (status !== "authenticated") {
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/profile/update-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ theme: nextTheme }),
      });

      if (res.ok) {
        updateUser({ theme: nextTheme });
        clearThemeOverride();
      } else {
        console.error("Failed to persist theme preference.");
      }
    } catch (err) {
      console.error("Theme persistence error:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={handleToggleTheme}
      disabled={saving}
    >
      {resolvedTheme === "dark" ? (
        <div className="flex items-center">
          <SunIcon className="size-4 text-warning" />
          {showText && <span className="ml-2">{t("theme.lightMode")}</span>} {/* Lokalisiert */}
        </div>
      ) : (
        <div className="flex items-center">
          <MoonIcon className="size-4 text-primary" />
          {showText && <span className="ml-2">{t("theme.darkMode")}</span>} {/* Lokalisiert */}
        </div>
      )}

      <span className="sr-only">{t("theme.toggleAria")}</span> {/* Lokalisiert */}
    </Button>
  );
}
