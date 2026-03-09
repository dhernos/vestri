"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { pushToast, subscribeToToasts, type ToastPayload } from "@/lib/toast";
import { X } from "lucide-react";

type ToastItem = ToastPayload & { id: string };

const fallbackId = () => Math.random().toString(36).slice(2);

const variants: Record<
  NonNullable<ToastPayload["variant"]>,
  { container: string; dot: string }
> = {
  info: {
    container: "border-border bg-card/90 text-foreground",
    dot: "bg-blue-500",
  },
  success: {
    container:
      "border-green-200 bg-green-50/90 text-green-950 dark:border-green-900/60 dark:bg-green-950/50 dark:text-green-100",
    dot: "bg-green-500",
  },
  error: {
    container:
      "border-rose-200 bg-rose-50/90 text-rose-950 dark:border-rose-900/60 dark:bg-rose-950/50 dark:text-rose-50",
    dot: "bg-rose-500",
  },
};

export function ToastViewport() {
  const t = useTranslations("Common");
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Map<string, number>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
    const timerId = timers.current.get(id);
    if (timerId) {
      window.clearTimeout(timerId);
      timers.current.delete(id);
    }
  }, []);

  useEffect(() => {
    const timerMap = timers.current;
    const unsubscribe = subscribeToToasts((toast) => {
      const id = crypto.randomUUID ? crypto.randomUUID() : fallbackId();
      const entry: ToastItem = {
        id,
        variant: toast.variant || "error",
        duration: toast.duration ?? 5000,
        ...toast,
      };

      setToasts((prev) => [...prev, entry]);
      const timerId = window.setTimeout(() => dismiss(id), entry.duration!);
      timerMap.set(id, timerId);
    });

    return () => {
      unsubscribe();
      timerMap.forEach((timerId) => window.clearTimeout(timerId));
      timerMap.clear();
    };
  }, [dismiss]);

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-3 sm:bottom-6 sm:right-6">
      {toasts.map((toast) => {
        const theme = variants[toast.variant ?? "info"];
        return (
          <div
            key={toast.id}
            className={`pointer-events-auto overflow-hidden rounded-lg border shadow-xl backdrop-blur ${theme.container}`}
          >
            <div className="flex items-start gap-3 p-3">
              <div className="flex-1 text-sm">
                {toast.title && (
                  <p className="font-semibold leading-5">{toast.title}</p>
                )}
                {toast.description && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {toast.description}
                  </p>
                )}
              </div>
              <button
                type="button"
                className="text-muted-foreground transition hover:text-foreground cursor-pointer"
                aria-label={t("a11y.dismissNotification")}
                onClick={() => dismiss(toast.id)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Simple helper for components that prefer a hook-style API.
export function useToast() {
  return {
    push: pushToast,
  };
}
