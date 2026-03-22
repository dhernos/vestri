"use client";

import { usePathname, useRouter } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import { cn } from "@/lib/utils";

type ToggleLanguageProps = {
  compact?: boolean;
  className?: string;
  buttonClassName?: string;
};

export default function ToggleLanguage({
  compact = false,
  className,
  buttonClassName,
}: ToggleLanguageProps) {
  const t = useTranslations("LanguageToggle");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const nextLocale = locale === "en" ? "de" : "en";
  const flagByLocale: Record<string, { src: string; alt: string }> = {
    en: { src: "/flags/en.svg", alt: t("flagAlt.en") },
    de: { src: "/flags/de.svg", alt: t("flagAlt.de") },
  };

  const handleLanguageSwitch = () => {
    router.replace(pathname, { locale: nextLocale });
  };

  const flag = flagByLocale[nextLocale];

  return (
    <div
      className={cn(
        compact ? "flex justify-end" : "mb-6 flex w-full max-w-4xl justify-end",
        className
      )}
    >
      <button
        onClick={handleLanguageSwitch}
        aria-label={t("switchTo", { locale: t(`localeName.${nextLocale}` as never) })}
        title={t("switchTo", { locale: t(`localeName.${nextLocale}` as never) })}
        className={cn(
          "flex h-5 w-7 items-center justify-center rounded-sm border border-border bg-card shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 cursor-pointer",
          compact ? "h-7 w-10 rounded-md" : "",
          buttonClassName
        )}
      >
        <Image
          src={flag.src}
          alt={flag.alt}
          width={28}
          height={20}
          className={cn("h-5 w-7", compact ? "h-6 w-9 rounded-sm" : "")}
        />
      </button>
    </div>
  );
}
