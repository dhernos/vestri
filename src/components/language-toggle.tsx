import { usePathname, useRouter } from "@/i18n/navigation";
import { useLocale } from "next-intl";
import Image from "next/image";

export default function ToggleLanguage() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const nextLocale = locale === "en" ? "de" : "en";
  const flagByLocale: Record<string, { src: string; alt: string }> = {
    en: { src: "/flags/en.svg", alt: "English" },
    de: { src: "/flags/de.svg", alt: "Deutsch" },
  };

  const handleLanguageSwitch = () => {
    router.replace(pathname, { locale: nextLocale });
  };

  const flag = flagByLocale[nextLocale];

  return (
    <div className="mb-6 flex w-full max-w-4xl justify-end">
      <button
        onClick={handleLanguageSwitch}
        className="flex h-5 w-7 items-center justify-center border border-gray-200 shadow-sm transition hover:-translate-y-0.5 hover:shadow focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 cursor-pointer"
      >
        <Image
          src={flag.src}
          alt={flag.alt}
          width={28}
          height={20}
          className="h-5 w-7"
        />
      </button>
    </div>
  );
}
