"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Card, CardContent } from "@/components/ui/card";

export default function DashboardNoNodeCard() {
  const t = useTranslations("DashboardPage");

  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">
          {t("noNodeAvailable.prefix")}{" "}
          <Link className="underline" href="/nodes">
            /nodes
          </Link>{" "}
          {t("noNodeAvailable.suffix")}
        </p>
      </CardContent>
    </Card>
  );
}
