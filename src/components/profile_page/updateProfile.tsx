"use client";

import { useRouter } from "@/i18n/navigation";
import { useState, FormEvent } from "react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslations } from "next-intl";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/toast";

export default function UpdateProfileSection() {
  const { data: session, status, refresh } = useAuth();
  const router = useRouter();
  const { setTheme: setClientTheme } = useTheme();
  const { push } = useToast();

  const [name, setName] = useState(session?.user?.name || "");
  const [theme, setTheme] = useState(session?.user?.theme || "system");

  const t = useTranslations("ProfilePage");
  const tCommon = useTranslations("Common");
  const tErrors = useTranslations("Errors");

  const THEMES = [
    { value: "system", label: t("themes.system") },
    { value: "light", label: t("themes.light") },
    { value: "dark", label: t("themes.dark") },
  ];

  if (status === "loading") {
    return <p>{tCommon("loading")}</p>;
  }

  if (status === "unauthenticated") {
    router.push("/login");
    return null;
  }

  // Funktion zur Zurücksetzung der Nachrichten und Fehler
  // --- Handler für Profil-Update (Name, Bild, Theme) ---
  const handleProfileUpdate = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/profile/update-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        // Senden von name, image und theme (alle aus dem lokalen State)
        body: JSON.stringify({ name, theme }),
      });

      const data = await res.json();

      if (res.ok) {
        push({
          variant: "success",
          description: data.message || t("messages.profileUpdated"),
        });

        await refresh();

        setClientTheme(theme);
      } else {
        push({
          variant: "error",
          description: data.message || t("profileUpdateError"),
        });
      }
    } catch (err) {
      push({ variant: "error", description: tErrors("UNEXPECTED_ERROR") });
      console.error(err);
    }
  };

  return (
    <div>
      {/* Sektion für Profil-Update */}
      <section className="mb-8 p-6 border rounded-lg shadow-md">
        <h2 className="text-2xl font-semibold mb-4">
          {t("updateProfileSettingsHeader")}
        </h2>
        <form onSubmit={handleProfileUpdate}>
          <div className="mb-4">
            <label htmlFor="name" className="block text-sm font-medium">
              {t("userName")}
            </label>
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 p-2 w-full border rounded-md"
            />
          </div>
          <div className="mb-4">
            <label htmlFor="theme" className="block text-sm font-medium">
              {t("theme")}
            </label>
            <Select
              value={theme}
              onValueChange={(value) => {
                setTheme(value);
              }}
            >
              <SelectTrigger className="mt-1 p-2 w-full border rounded-md cursor-pointer">
                <SelectValue placeholder={t("theme")} />
              </SelectTrigger>
              <SelectContent>
                {THEMES.map((theme) => (
                  <SelectItem
                    key={theme.value}
                    value={theme.value}
                    className="cursor-pointer"
                  >
                    {theme.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            type="submit"
            className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded cursor-pointer"
          >
            {t("buttons.updateProfile")}
          </Button>
        </form>
      </section>
    </div>
  );
}
