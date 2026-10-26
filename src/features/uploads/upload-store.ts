"use client";

import { useMemo, useSyncExternalStore } from "react";

export type UploadStatus = "uploading" | "processing" | "done" | "error";

export type UploadJob = {
  id: string;
  scope: string;
  fileName: string;
  loaded: number;
  total: number;
  status: UploadStatus;
  error: string;
};

type StartUploadOptions = {
  // Jobs are grouped by scope so each page only shows and reacts to its own uploads.
  scope: string;
  url: string;
  file: File;
  fileField?: string;
  fields?: Record<string, string>;
  fallbackError: string;
  mapError?: (status: number, body: string) => string | null;
};

const doneVisibleMs = 4000;

let jobs: UploadJob[] = [];
const listeners = new Set<() => void>();
const completionListeners = new Map<string, Set<(job: UploadJob) => void>>();
const requests = new Map<string, XMLHttpRequest>();
let sequence = 0;
let unloadGuardActive = false;

const emit = () => listeners.forEach((listener) => listener());

const updateJob = (id: string, patch: Partial<UploadJob>) => {
  jobs = jobs.map((job) => (job.id === id ? { ...job, ...patch } : job));
  emit();
  syncUnloadGuard();
};

const removeJob = (id: string) => {
  jobs = jobs.filter((job) => job.id !== id);
  emit();
  syncUnloadGuard();
};

const isActive = (job: UploadJob) =>
  job.status === "uploading" || job.status === "processing";

const onBeforeUnload = (event: BeforeUnloadEvent) => {
  event.preventDefault();
  event.returnValue = "";
};

const syncUnloadGuard = () => {
  const shouldGuard = jobs.some(isActive);
  if (shouldGuard === unloadGuardActive || typeof window === "undefined") {
    return;
  }
  unloadGuardActive = shouldGuard;
  if (shouldGuard) {
    window.addEventListener("beforeunload", onBeforeUnload);
  } else {
    window.removeEventListener("beforeunload", onBeforeUnload);
  }
};

const parseErrorBody = (body: string): string => {
  const raw = body.trim();
  if (!raw) {
    return "";
  }
  try {
    const parsed = JSON.parse(raw) as { message?: unknown; error?: unknown };
    if (typeof parsed.message === "string" && parsed.message.trim()) {
      return parsed.message.trim();
    }
    if (typeof parsed.error === "string" && parsed.error.trim()) {
      return parsed.error.trim();
    }
  } catch {
    // not JSON, fall through to raw text
  }
  return raw.slice(0, 500);
};

const finish = (job: UploadJob) => {
  completionListeners.get(job.scope)?.forEach((listener) => listener(job));
};

export const startUpload = (options: StartUploadOptions): string => {
  sequence += 1;
  const id = `upload-${Date.now()}-${sequence}`;
  const job: UploadJob = {
    id,
    scope: options.scope,
    fileName: options.file.name,
    loaded: 0,
    total: options.file.size,
    status: "uploading",
    error: "",
  };
  jobs = [...jobs, job];
  emit();
  syncUnloadGuard();

  const formData = new FormData();
  Object.entries(options.fields ?? {}).forEach(([key, value]) =>
    formData.append(key, value),
  );
  formData.append(options.fileField ?? "file", options.file);

  const xhr = new XMLHttpRequest();
  requests.set(id, xhr);
  xhr.open("POST", options.url);
  xhr.withCredentials = true;

  xhr.upload.onprogress = (event) => {
    if (!event.lengthComputable) {
      return;
    }
    // Once every byte reached our server it still has to be forwarded to the node.
    updateJob(id, {
      loaded: event.loaded,
      total: event.total,
      status: event.loaded >= event.total ? "processing" : "uploading",
    });
  };

  const fail = (message: string) => {
    requests.delete(id);
    updateJob(id, { status: "error", error: message });
    finish({ ...job, status: "error", error: message });
  };

  xhr.onload = () => {
    requests.delete(id);
    if (xhr.status >= 200 && xhr.status < 300) {
      updateJob(id, { status: "done", loaded: job.total });
      finish({ ...job, status: "done" });
      window.setTimeout(() => removeJob(id), doneVisibleMs);
      return;
    }
    const body = xhr.responseText || "";
    fail(
      options.mapError?.(xhr.status, body) ||
        parseErrorBody(body) ||
        options.fallbackError,
    );
  };
  xhr.onerror = () => fail(options.fallbackError);
  xhr.ontimeout = () => fail(options.fallbackError);
  xhr.onabort = () => {
    requests.delete(id);
    removeJob(id);
  };

  xhr.send(formData);
  return id;
};

export const cancelUpload = (id: string) => {
  requests.get(id)?.abort();
};

export const dismissUpload = (id: string) => {
  removeJob(id);
};

export const subscribeUploadCompletion = (
  scope: string,
  listener: (job: UploadJob) => void,
) => {
  let set = completionListeners.get(scope);
  if (!set) {
    set = new Set();
    completionListeners.set(scope, set);
  }
  set.add(listener);
  return () => {
    set?.delete(listener);
  };
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const emptyJobs: UploadJob[] = [];

export const useUploads = (scope: string) => {
  const all = useSyncExternalStore(
    subscribe,
    () => jobs,
    () => emptyJobs,
  );
  return useMemo(() => all.filter((job) => job.scope === scope), [all, scope]);
};

export const hasActiveUpload = (list: UploadJob[]) => list.some(isActive);
