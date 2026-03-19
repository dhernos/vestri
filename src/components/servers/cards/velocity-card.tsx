"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import ServerStatusBlob from "@/components/servers/status-blob";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buildServerWorkspacePath } from "@/features/servers/navigation";
import type {
  GameServerTemplateSummary,
  GameServerTemplateVersionField,
  ServerStatus,
  VelocityBackendSummary,
} from "@/components/servers/cards/types";

type VelocityCardProps = {
  nodeRef: string;
  velocityTemplateId: string;
  velocityTemplates: GameServerTemplateSummary[];
  velocityBackendName: string;
  velocitySoftwareField?: GameServerTemplateVersionField;
  velocitySoftwareOptions: string[];
  velocityBackendSoftwareVersion: string;
  velocityGameField?: GameServerTemplateVersionField;
  velocityGameOptions: string[];
  velocityBackendGameVersion: string;
  velocityCreating: boolean;
  velocityLoading: boolean;
  velocityError: string;
  velocityCreateError: string;
  agreementRequired: boolean;
  velocityBackends: VelocityBackendSummary[];
  onTemplateIdChange: (value: string) => void;
  onBackendNameChange: (value: string) => void;
  onBackendSoftwareVersionChange: (value: string) => void;
  onBackendGameVersionChange: (value: string) => void;
  onCreateVelocityBackend: () => void;
  onRefreshVelocityData: () => void;
  statusLabel: (status: ServerStatus) => string;
};

export default function VelocityCard({
  nodeRef,
  velocityTemplateId,
  velocityTemplates,
  velocityBackendName,
  velocitySoftwareField,
  velocitySoftwareOptions,
  velocityBackendSoftwareVersion,
  velocityGameField,
  velocityGameOptions,
  velocityBackendGameVersion,
  velocityCreating,
  velocityLoading,
  velocityError,
  velocityCreateError,
  agreementRequired,
  velocityBackends,
  onTemplateIdChange,
  onBackendNameChange,
  onBackendSoftwareVersionChange,
  onBackendGameVersionChange,
  onCreateVelocityBackend,
  onRefreshVelocityData,
  statusLabel,
}: VelocityCardProps) {
  const t = useTranslations("ServerPage");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("velocity.title")}</CardTitle>
        <CardDescription>{t("velocity.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="velocity-backend-template">{t("velocity.fields.template")}</Label>
            <select
              id="velocity-backend-template"
              className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
              value={velocityTemplateId}
              onChange={(event) => onTemplateIdChange(event.target.value)}
              disabled={velocityCreating || velocityTemplates.length === 0}
            >
              {velocityTemplates.length === 0 ? (
                <option value="">{t("velocity.empty.templates")}</option>
              ) : (
                velocityTemplates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))
              )}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="velocity-backend-name">{t("velocity.fields.identifier")}</Label>
            <Input
              id="velocity-backend-name"
              value={velocityBackendName}
              onChange={(event) => onBackendNameChange(event.target.value)}
              placeholder={t("velocity.fields.identifierPlaceholder")}
              disabled={velocityCreating}
            />
          </div>
          {velocitySoftwareField ? (
            <div className="space-y-2">
              <Label htmlFor="velocity-backend-software">
                {velocitySoftwareField.label || t("velocity.fields.serverType")}
              </Label>
              {velocitySoftwareOptions.length > 0 ? (
                <select
                  id="velocity-backend-software"
                  className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                  value={velocityBackendSoftwareVersion}
                  onChange={(event) => onBackendSoftwareVersionChange(event.target.value)}
                  disabled={velocityCreating}
                >
                  {velocitySoftwareOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  id="velocity-backend-software"
                  value={velocityBackendSoftwareVersion}
                  onChange={(event) => onBackendSoftwareVersionChange(event.target.value)}
                  placeholder={velocitySoftwareField.placeholder || ""}
                  disabled={velocityCreating}
                />
              )}
            </div>
          ) : null}
          {velocityGameField ? (
            <div className="space-y-2">
              <Label htmlFor="velocity-backend-game-version">
                {velocityGameField.label || t("velocity.fields.gameVersion")}
              </Label>
              {velocityGameOptions.length > 0 ? (
                <select
                  id="velocity-backend-game-version"
                  className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                  value={velocityBackendGameVersion}
                  onChange={(event) => onBackendGameVersionChange(event.target.value)}
                  disabled={velocityCreating}
                >
                  {velocityGameOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  id="velocity-backend-game-version"
                  value={velocityBackendGameVersion}
                  onChange={(event) => onBackendGameVersionChange(event.target.value)}
                  placeholder={velocityGameField.placeholder || ""}
                  disabled={velocityCreating}
                />
              )}
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={onCreateVelocityBackend} disabled={velocityCreating || !velocityTemplateId}>
            {velocityCreating ? t("velocity.buttons.creating") : t("velocity.buttons.create")}
          </Button>
          <Button variant="secondary" onClick={onRefreshVelocityData} disabled={velocityLoading}>
            {velocityLoading ? t("velocity.buttons.refreshing") : t("velocity.buttons.refresh")}
          </Button>
        </div>
        {agreementRequired ? (
          <p className="text-xs text-muted-foreground">{t("velocity.agreementRequired")}</p>
        ) : null}
        {velocityError ? <p className="text-sm text-red-600">{velocityError}</p> : null}
        {velocityCreateError ? <p className="text-sm text-red-600">{velocityCreateError}</p> : null}

        {velocityBackends.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("velocity.empty.backends")}</p>
        ) : (
          <div className="space-y-2">
            {velocityBackends.map((backend) => (
              <div
                key={backend.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"
              >
                <div>
                  <p className="flex items-center gap-2 font-medium">
                    <ServerStatusBlob status={backend.status} size="md" label={statusLabel(backend.status)} />
                    <span>{backend.name}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("velocity.connectLabel")}: {backend.connectHost || `vestri-${backend.slug}`}:
                    {backend.connectPort || 25565}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button asChild size="sm" variant="secondary">
                    <Link href={buildServerWorkspacePath(nodeRef, backend.id, "dashboard")}>
                      {t("buttons.openControls")}
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
