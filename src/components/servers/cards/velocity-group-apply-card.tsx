"use client";

import { useState } from "react";
import { LoaderCircle, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { GameServerListItem } from "@/features/servers/types";

type VelocityGroupApplyCardProps = {
  basePath: string;
  backends: GameServerListItem[];
  applyingLabel: string;
};

const pluginSoftware = new Set(["PAPER", "PURPUR", "SPIGOT", "BUKKIT"]);

const responseMessage = async (res: Response, fallback: string) => {
  const raw = (await res.text().catch(() => "")).trim();
  if (!raw) {
    return fallback;
  }
  try {
    const data = JSON.parse(raw) as { message?: unknown; error?: unknown };
    if (typeof data.message === "string" && data.message.trim()) {
      return data.message.trim();
    }
    if (typeof data.error === "string" && data.error.trim()) {
      return data.error.trim();
    }
  } catch {
    return raw;
  }
  return raw;
};

export default function VelocityGroupApplyCard({
  basePath,
  backends,
  applyingLabel,
}: VelocityGroupApplyCardProps) {
  const t = useTranslations("ServerPage");
  const [selectedRefs, setSelectedRefs] = useState<string[]>([]);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState("");
  const [appliedCount, setAppliedCount] = useState<number | null>(null);
  const compatibleBackends = backends.filter((backend) =>
    pluginSoftware.has((backend.softwareVersion || "").trim().toUpperCase())
  );
  const eligibleBackends = compatibleBackends.filter(
    (backend) => backend.permissions.canManageFiles
  );

  const toggleBackend = (serverRef: string, checked: boolean) => {
    setSelectedRefs((current) =>
      checked
        ? current.includes(serverRef)
          ? current
          : [...current, serverRef]
        : current.filter((ref) => ref !== serverRef)
    );
    setError("");
    setAppliedCount(null);
  };

  const applyChanges = async () => {
    if (!basePath || selectedRefs.length === 0 || applying) {
      return;
    }
    setApplying(true);
    setError("");
    setAppliedCount(null);
    try {
      const res = await fetch(`${basePath}/group-files/apply`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serverRefs: selectedRefs }),
      });
      if (!res.ok) {
        setError(await responseMessage(res, t("groupFiles.apply.errors.apply")));
        return;
      }
      const result = (await res.json().catch(() => ({}))) as { appliedTo?: number };
      setAppliedCount(typeof result.appliedTo === "number" ? result.appliedTo : selectedRefs.length);
      setSelectedRefs([]);
    } catch {
      setError(t("groupFiles.apply.errors.apply"));
    } finally {
      setApplying(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("groupFiles.apply.title")}</CardTitle>
        <CardDescription>{t("groupFiles.apply.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {backends.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("groupFiles.apply.empty")}</p>
        ) : (
          <div className="divide-y rounded-md border">
            {backends.map((backend) => {
              const software = (backend.softwareVersion || "").trim().toUpperCase();
              const compatible = pluginSoftware.has(software);
              const canSelect = compatible && backend.permissions.canManageFiles;
              return (
                <label
                  key={backend.id}
                  className="flex min-h-12 items-center gap-3 px-3 py-2 text-sm"
                >
                  <input
                    type="checkbox"
                    className="size-4 shrink-0 accent-primary"
                    checked={selectedRefs.includes(backend.id)}
                    disabled={!canSelect || applying}
                    onChange={(event) => toggleBackend(backend.id, event.target.checked)}
                  />
                  <span className="min-w-0 flex-1 truncate font-medium">{backend.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {t("groupFiles.apply.software", {
                      software: software || t("groupFiles.apply.unknownSoftware"),
                    })}
                  </span>
                </label>
              );
            })}
          </div>
        )}
        {backends.length > 0 && eligibleBackends.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("groupFiles.apply.noTargets")}</p>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => void applyChanges()} disabled={applying || selectedRefs.length === 0}>
            {applying ? <LoaderCircle className="animate-spin" /> : <Upload />}
            {applying ? applyingLabel : t("groupFiles.apply.button")}
          </Button>
          <span className="text-sm text-muted-foreground">
            {t("groupFiles.apply.selected", { count: selectedRefs.length })}
          </span>
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {appliedCount !== null ? (
          <p className="text-sm text-success">
            {t("groupFiles.apply.success", { count: appliedCount })}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}