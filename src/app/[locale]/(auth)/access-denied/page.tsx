import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function AccessDeniedPage() {
  const t = useTranslations("AccessDenied");

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">{t("title")}</CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button asChild>
            <Link href="/">{t("home")}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/login">{t("login")}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
