"use client";

import { useEffect, useState } from "react";
import { FolderUp, RefreshCw, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  PluginFileEditorDialog,
  PluginTree,
  type EditorTarget,
} from "@/components/servers/cards/velocity-plugin-manager-card";
import UploadProgressList from "@/components/uploads/upload-progress-list";
import {
  hasActiveUpload,
  startUpload,
  subscribeUploadCompletion,
  useUploads,
} from "@/features/uploads/upload-store";

export default function MinecraftPluginLibrary({
  nodeRef,
}: {
  nodeRef: string;
}) {
  const t = useTranslations("NodeDetailsPage.minecraft");
  const serverText = useTranslations("ServerPage");
  const apiBase = `/api/nodes/${encodeURIComponent(nodeRef)}/minecraft`;
  const uploadScope = `${apiBase}/files/upload`;
  const uploading = hasActiveUpload(useUploads(uploadScope));
  const [reloadKey, setReloadKey] = useState(0);
  const [editor, setEditor] = useState<EditorTarget | null>(null);

  useEffect(
    () =>
      subscribeUploadCompletion(uploadScope, () =>
        setReloadKey((current) => current + 1),
      ),
    [uploadScope],
  );

  const upload = (files: FileList | null) => {
    for (const file of Array.from(files || [])) {
      startUpload({
        scope: uploadScope,
        url: uploadScope,
        file,
        fields: { path: `plugins/${file.webkitRelativePath || file.name}` },
        fallbackError: serverText("fileBrowser.errors.uploadFile"),
      });
    }
  };

  return (
    <section
      className="min-w-0 space-y-4"
      aria-labelledby="minecraft-library-title"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="minecraft-library-title" className="text-xl font-semibold">
          {t("title")}
        </h2>
        <Button
          size="icon"
          variant="ghost"
          title={t("refresh")}
          aria-label={t("refresh")}
          onClick={() => setReloadKey((current) => current + 1)}
        >
          <RefreshCw />
        </Button>
      </div>
      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        <label className="min-w-0 space-y-2 text-sm">
          <span className="flex items-center gap-2">
            <Upload className="size-4" />
            {t("files")}
          </span>
          <Input
            type="file"
            multiple
            disabled={uploading}
            onChange={(event) => {
              upload(event.currentTarget.files);
              event.currentTarget.value = "";
            }}
          />
        </label>
        <label className="min-w-0 space-y-2 text-sm">
          <span className="flex items-center gap-2">
            <FolderUp className="size-4" />
            {t("folder")}
          </span>
          <Input
            type="file"
            multiple
            {...{ webkitdirectory: "" }}
            disabled={uploading}
            onChange={(event) => {
              upload(event.currentTarget.files);
              event.currentTarget.value = "";
            }}
          />
        </label>
      </div>
      <UploadProgressList scope={uploadScope} />
      <PluginTree
        key={nodeRef}
        apiBase={apiBase}
        path="plugins"
        reloadKey={reloadKey}
        emptyLabel={serverText("groupFiles.manager.staging.empty")}
        onEdit={setEditor}
      />
      <PluginFileEditorDialog
        target={editor}
        onClose={() => {
          setEditor(null);
          setReloadKey((current) => current + 1);
        }}
      />
    </section>
  );
}
