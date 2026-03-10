"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { WorkerNode } from "@/features/nodes/types";

type WorkerNodeInfo = Pick<
  WorkerNode,
  "id" | "slug" | "baseUrl" | "ownerUserId" | "accessRole" | "apiKeyPreview" | "createdAt" | "updatedAt"
>;

type NodeInfoCardProps = {
  node: WorkerNodeInfo;
  canDeleteNode: boolean;
  deletingNode: boolean;
  deleteNodeError: string;
  onDeleteNode: () => void;
};

export default function NodeInfoCard({
  node,
  canDeleteNode,
  deletingNode,
  deleteNodeError,
  onDeleteNode,
}: NodeInfoCardProps) {
  const t = useTranslations("NodeDetailsPage");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("info.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p>
          <span className="font-medium">{t("info.labels.id")}</span> {node.id}
        </p>
        <p>
          <span className="font-medium">{t("info.labels.slug")}</span> {node.slug}
        </p>
        <p>
          <span className="font-medium">{t("info.labels.role")}</span> {node.accessRole}
        </p>
        <p>
          <span className="font-medium">{t("info.labels.baseUrl")}</span> {node.baseUrl}
        </p>
        <p>
          <span className="font-medium">{t("info.labels.ownerUserId")}</span> {node.ownerUserId}
        </p>
        <p>
          <span className="font-medium">{t("info.labels.apiKey")}</span> {node.apiKeyPreview}
        </p>
        <p>
          <span className="font-medium">{t("info.labels.createdAt")}</span>{" "}
          {new Date(node.createdAt).toLocaleString()}
        </p>
        <p>
          <span className="font-medium">{t("info.labels.updatedAt")}</span>{" "}
          {new Date(node.updatedAt).toLocaleString()}
        </p>
        {canDeleteNode ? (
          <div className="pt-2">
            <Button variant="destructive" onClick={onDeleteNode} disabled={deletingNode}>
              {deletingNode ? t("delete.deleting") : t("delete.button")}
            </Button>
            {deleteNodeError ? <p className="pt-2 text-sm text-red-600">{deleteNodeError}</p> : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
