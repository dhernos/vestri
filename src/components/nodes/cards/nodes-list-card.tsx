"use client";

import { useTranslations } from "next-intl";
import HealthBlob from "@/components/nodes/health";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { WorkerNode } from "@/features/nodes/types";

type WorkerNodeListItem = Pick<
  WorkerNode,
  "id" | "slug" | "name" | "baseUrl" | "accessRole" | "apiKeyPreview"
>;

type NodesListCardProps = {
  loading: boolean;
  nodes: WorkerNodeListItem[];
};

export default function NodesListCard({ loading, nodes }: NodesListCardProps) {
  const t = useTranslations("NodesPage");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("nodesList.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? <p>{t("loading")}</p> : null}
        {!loading && nodes.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("nodesList.empty")}</p>
        ) : null}
        {!loading &&
          nodes.map((node) => (
            <div
              key={node.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <HealthBlob nodeRef={node.id} />
                  <p className="font-medium">{node.name}</p>
                  <span className="rounded bg-muted px-2 py-0.5 text-xs">{node.accessRole}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("nodesList.meta.baseUrlKey", {
                    baseUrl: node.baseUrl,
                    apiKey: node.apiKeyPreview,
                  })}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button asChild variant="secondary" size="sm">
                  <Link href={`/dashboard?node=${encodeURIComponent(node.id)}`}>
                    {t("nodesList.buttons.openDashboard")}
                  </Link>
                </Button>
                <Button asChild size="sm">
                  <Link href={`/nodes/${node.slug}`}>{t("nodesList.buttons.details")}</Link>
                </Button>
              </div>
            </div>
          ))}
      </CardContent>
    </Card>
  );
}
