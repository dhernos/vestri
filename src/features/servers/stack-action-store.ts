"use client";

import { useSyncExternalStore } from "react";

export type PendingStackAction = "" | "start" | "stop";

// Module-level so the state survives page navigation inside the SPA.
const pending = new Map<string, "start" | "stop">();
const listeners = new Set<() => void>();

export const setPendingStackAction = (key: string, action: PendingStackAction) => {
  if (!key) {
    return;
  }
  if (action) {
    pending.set(key, action);
  } else {
    pending.delete(key);
  }
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const usePendingStackAction = (key: string): PendingStackAction =>
  useSyncExternalStore(
    subscribe,
    () => pending.get(key) ?? "",
    () => "",
  );
