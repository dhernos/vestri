"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ConfigRow, GameServerConfigFileOption } from "@/components/servers/cards/types";

type ConfigEditorCardProps = {
  configFiles: GameServerConfigFileOption[];
  selectedConfigFileId: string;
  useKeyValueEditor: boolean;
  configRows: ConfigRow[];
  configLoading: boolean;
  configSaving: boolean;
  configContent: string;
  hasSelectedConfigFile: boolean;
  configError: string;
  onSelectConfigFile: (value: string) => void;
  onUpdateConfigRow: (rowId: string, changes: Partial<Pick<ConfigRow, "key" | "value">>) => void;
  onRemoveConfigRow: (rowId: string) => void;
  onAddConfigRow: () => void;
  onConfigContentChange: (value: string) => void;
  onSaveConfig: () => void;
};

export default function ConfigEditorCard({
  configFiles,
  selectedConfigFileId,
  useKeyValueEditor,
  configRows,
  configLoading,
  configSaving,
  configContent,
  hasSelectedConfigFile,
  configError,
  onSelectConfigFile,
  onUpdateConfigRow,
  onRemoveConfigRow,
  onAddConfigRow,
  onConfigContentChange,
  onSaveConfig,
}: ConfigEditorCardProps) {
  const t = useTranslations("ServerPage");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("configEditor.title")}</CardTitle>
        <CardDescription>{t("configEditor.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="config-file-select">{t("configEditor.fields.configFile")}</Label>
          <select
            id="config-file-select"
            className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
            value={selectedConfigFileId}
            onChange={(event) => onSelectConfigFile(event.target.value)}
            disabled={configFiles.length === 0}
          >
            {configFiles.length === 0 ? (
              <option value="">{t("configEditor.empty.noConfiguredFiles")}</option>
            ) : (
              configFiles.map((cfg) => (
                <option key={cfg.id} value={cfg.id}>
                  {cfg.title} ({cfg.path})
                </option>
              ))
            )}
          </select>
        </div>

        {useKeyValueEditor ? (
          <div className="space-y-2">
            <div className="grid grid-cols-[1fr_1fr_auto] gap-2 text-xs font-medium text-muted-foreground">
              <span>{t("configEditor.columns.key")}</span>
              <span>{t("configEditor.columns.value")}</span>
              <span />
            </div>
            {configRows.map((row) => (
              <div key={row.id} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                <Input
                  value={row.key}
                  onChange={(event) => onUpdateConfigRow(row.id, { key: event.target.value })}
                  disabled={row.keyLocked}
                />
                <Input
                  value={row.value}
                  onChange={(event) => onUpdateConfigRow(row.id, { value: event.target.value })}
                  disabled={row.valueLocked}
                />
                <Button variant="ghost" onClick={() => onRemoveConfigRow(row.id)} disabled={!row.custom}>
                  {t("configEditor.buttons.remove")}
                </Button>
              </div>
            ))}
            <Button variant="secondary" onClick={onAddConfigRow} disabled={configLoading}>
              {t("configEditor.buttons.addSetting")}
            </Button>
          </div>
        ) : (
          <textarea
            value={configContent}
            onChange={(event) => onConfigContentChange(event.target.value)}
            className="min-h-64 w-full rounded-md border border-input bg-transparent p-2 text-xs"
            disabled={!hasSelectedConfigFile || configLoading}
          />
        )}

        <div className="flex gap-2">
          <Button onClick={onSaveConfig} disabled={!hasSelectedConfigFile || configSaving || configLoading}>
            {configSaving ? t("configEditor.buttons.saving") : t("configEditor.buttons.saveConfig")}
          </Button>
        </div>
        {configError ? <p className="text-sm text-red-600">{configError}</p> : null}
      </CardContent>
    </Card>
  );
}
