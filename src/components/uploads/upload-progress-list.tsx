"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/features/servers/file-utils";
import { cancelUpload, dismissUpload, useUploads } from "@/features/uploads/upload-store";

export default function UploadProgressList({ scope }: { scope: string }) {
  const t = useTranslations("ServerPage");
  const jobs = useUploads(scope);

  if (jobs.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2" aria-live="polite">
      {jobs.map((job) => {
        const percent =
          job.status === "done"
            ? 100
            : job.total > 0
              ? Math.min(100, Math.floor((job.loaded / job.total) * 100))
              : 0;
        const active = job.status === "uploading" || job.status === "processing";
        const detail =
          job.status === "processing"
            ? t("uploads.processing")
            : job.status === "done"
              ? t("uploads.done")
              : job.status === "error"
                ? job.error
                : `${percent}% (${formatBytes(job.loaded)} / ${formatBytes(job.total)})`;
        return (
          <div key={job.id} className="space-y-1 rounded-md border p-2 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-medium">{job.fileName}</span>
              <Button
                variant="ghost"
                size="icon"
                className="size-6 shrink-0"
                onClick={() => (active ? cancelUpload(job.id) : dismissUpload(job.id))}
                title={active ? t("uploads.cancel") : t("uploads.dismiss")}
                aria-label={active ? t("uploads.cancel") : t("uploads.dismiss")}
              >
                <X className="size-4" />
              </Button>
            </div>
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
              className="h-2 w-full overflow-hidden rounded-full bg-muted"
            >
              <div
                className={`h-full transition-[width] duration-200 ${
                  job.status === "error"
                    ? "bg-destructive"
                    : job.status === "processing"
                      ? "animate-pulse bg-primary"
                      : "bg-primary"
                }`}
                style={{ width: `${job.status === "error" ? 100 : percent}%` }}
              />
            </div>
            <p
              className={`text-xs ${job.status === "error" ? "text-destructive" : "text-muted-foreground"}`}
            >
              {detail}
            </p>
          </div>
        );
      })}
    </div>
  );
}
