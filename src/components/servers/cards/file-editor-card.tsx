"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type FileEditorCardProps = {
  filePath: string;
  fileReadOnly: boolean;
  fileContent: string;
  fileLoading: boolean;
  fileSaving: boolean;
  fileError: string;
  onFileContentChange: (value: string) => void;
  onSaveFile: () => void;
  onReloadFile: () => void;
};

export default function FileEditorCard({
  filePath,
  fileReadOnly,
  fileContent,
  fileLoading,
  fileSaving,
  fileError,
  onFileContentChange,
  onSaveFile,
  onReloadFile,
}: FileEditorCardProps) {
  const t = useTranslations("ServerPage");

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {t(fileReadOnly ? "fileViewer.title" : "fileEditor.title")}
        </CardTitle>
        <CardDescription>
          {filePath || t("fileEditor.selectFromBrowser")}
          {fileReadOnly ? (
            <span className="mt-1 block">{t("fileViewer.compressedLog")}</span>
          ) : null}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <textarea
          value={fileContent}
          onChange={(event) => onFileContentChange(event.target.value)}
          className="min-h-64 w-full rounded-md border border-input bg-transparent p-2 text-xs"
          disabled={!filePath || fileLoading}
          readOnly={fileReadOnly}
        />
        <div className="flex gap-2">
          {!fileReadOnly ? (
            <Button onClick={onSaveFile} disabled={!filePath || fileSaving || fileLoading}>
              {fileSaving ? t("fileEditor.buttons.saving") : t("fileEditor.buttons.saveFile")}
            </Button>
          ) : null}
          <Button variant="secondary" onClick={onReloadFile} disabled={!filePath || fileLoading}>
            {t("fileEditor.buttons.reload")}
          </Button>
        </div>
        {fileError ? <p className="text-sm text-destructive">{fileError}</p> : null}
      </CardContent>
    </Card>
  );
}
