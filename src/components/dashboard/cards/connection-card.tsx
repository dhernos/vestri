"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { NodeAccessRole, WorkerNodeSummary } from "@/features/nodes/types";

type DashboardConnectionCardProps = {
  nodes: WorkerNodeSummary[];
  nodesLoading: boolean;
  nodesError: string;
  selectedNodeRef: string;
  selectedNodeRole: NodeAccessRole | null;
  onNodeChange: (nextNodeRef: string) => void;
  onRefreshNodes: () => void;
};

export default function DashboardConnectionCard({
  nodes,
  nodesLoading,
  nodesError,
  selectedNodeRef,
  selectedNodeRole,
  onNodeChange,
  onRefreshNodes,
}: DashboardConnectionCardProps) {
  const t = useTranslations("DashboardPage");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("connection.title")}</CardTitle>
        <CardDescription>{t("connection.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="node-select">{t("connection.nodeLabel")}</Label>
          <div className="flex flex-wrap items-center gap-2">
            <select
              id="node-select"
              className="h-9 min-w-64 rounded-md border bg-transparent px-3 text-sm"
              value={selectedNodeRef}
              onChange={(event) => onNodeChange(event.target.value)}
              disabled={nodesLoading || nodes.length === 0}
            >
              {nodes.length === 0 ? (
                <option value="">{t("connection.noNodes")}</option>
              ) : (
                nodes.map((node) => (
                  <option key={node.id} value={node.id}>
                    {node.name} ({node.slug})
                  </option>
                ))
              )}
            </select>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onRefreshNodes}
              disabled={nodesLoading}
            >
              {t("buttons.refresh")}
            </Button>
            <Button asChild type="button" variant="outline" size="sm">
              <Link href="/nodes">{t("buttons.manageNodes")}</Link>
            </Button>
          </div>
          {nodesError && <p className="text-xs text-destructive">{nodesError}</p>}
          <p className="text-xs text-muted-foreground">{t("connection.proxyInfo")}</p>
          {selectedNodeRole ? (
            <p className="text-xs text-muted-foreground">
              {t("connection.activeRole", { role: selectedNodeRole })}
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
