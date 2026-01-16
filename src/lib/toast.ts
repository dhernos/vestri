export type ToastPayload = {
  title?: string;
  description?: string;
  variant?: "info" | "success" | "error";
  duration?: number;
};

type Listener = (toast: ToastPayload) => void;

const listeners = new Set<Listener>();

export function subscribeToToasts(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function pushToast(toast: ToastPayload | string) {
  const payload: ToastPayload =
    typeof toast === "string" ? { description: toast } : toast;
  listeners.forEach((listener) => listener(payload));
}
