"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function FileBrowserRestrictedCard() {
  const t = useTranslations("ServerPage");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("fileBrowser.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{t("fileBrowser.restricted")}</p>
      </CardContent>
    </Card>
  );
}
