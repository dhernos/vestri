// src/components/theme-toggle.tsx
"use client";

import { useTheme } from "next-themes";
import React, { useEffect, useState } from "react";
import { useTranslations } from "next-intl"; // <-- Import für next-intl
import { Button } from "./ui/button";
import { MoonIcon, SunIcon } from "@radix-ui/react-icons";

export default function ThemeToggle({
  showText = false,
}: {
  showText?: boolean;
}) {
  const { setTheme, resolvedTheme } = useTheme();
  const t = useTranslations("Common"); // Verwenden des Common-Namespaces
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={() => {
        setTheme(resolvedTheme === "dark" ? "light" : "dark");
      }}
    >
      {resolvedTheme === "dark" ? (
        <div className="flex items-center">
          <SunIcon className="size-4 text-orange-300" />
          {showText && <span className="ml-2">{t("theme.lightMode")}</span>} {/* Lokalisiert */}
        </div>
      ) : (
        <div className="flex items-center">
          <MoonIcon className="size-4 text-sky-950" />
          {showText && <span className="ml-2">{t("theme.darkMode")}</span>} {/* Lokalisiert */}
        </div>
      )}

      <span className="sr-only">{t("theme.toggleAria")}</span> {/* Lokalisiert */}
    </Button>
  );
}