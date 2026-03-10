"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function NodeAccessCard() {
  const t = useTranslations("NodeDetailsPage");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("access.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{t("access.description")}</p>
      </CardContent>
    </Card>
  );
}
