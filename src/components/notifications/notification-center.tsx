"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Bell, Check, CheckCheck, ChevronDown, Loader2, RefreshCw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const eventKinds = ["server_created", "server_deleted", "worker_unhealthy", "server_down"] as const;
type EventKind = (typeof eventKinds)[number];
type Settings = {
  events: Record<EventKind, boolean>;
  emailEnabled: boolean;
  webhookEnabled: boolean;
  webhookUrl: string;
  locale: string;
};
type Notification = {
  id: string;
  kind: EventKind;
  nodeName: string;
  serverName: string;
  createdAt: string;
  readAt: string | null;
  deliveryFailed: boolean;
};
type NotificationsPayload = { notifications: Notification[]; unread: number; hasMore: boolean };

function SettingToggle({ id, label, checked, onChange, disabled }: {
  id: string; label: string; checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean;
}) {
  return (
    <label htmlFor={id} className="flex min-h-11 cursor-pointer items-center justify-between gap-4 py-2 text-sm">
      <span>{label}</span>
      <span className="relative inline-flex shrink-0">
        <input id={id} type="checkbox" role="switch" className="peer sr-only" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
        <span className="h-6 w-11 rounded-full border bg-muted transition-colors peer-checked:bg-primary peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring peer-disabled:opacity-50" />
        <span className="pointer-events-none absolute left-1 top-1 h-4 w-4 rounded-full bg-background shadow-sm transition-transform peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

export default function NotificationCenter() {
  const t = useTranslations("NotificationsPage");
  const locale = useLocale();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [settingsError, setSettingsError] = useState("");
  const [saved, setSaved] = useState(false);

  async function loadNotifications(older = false, signal?: AbortSignal) {
    const last = notifications.at(-1);
    const query = older && last ? `?before=${encodeURIComponent(last.createdAt)}&beforeId=${encodeURIComponent(last.id)}` : "";
    try {
      const response = await fetch(`/api/notifications${query}`, { cache: "no-store", signal });
      if (!response.ok) throw new Error("load");
      const data = await response.json() as NotificationsPayload;
      if (signal?.aborted) return;
      setNotifications((previous) => {
        const incoming = new Set(data.notifications.map((item) => item.id));
        if (older) return [...previous.filter((item) => !incoming.has(item.id)), ...data.notifications];
        return [...data.notifications, ...previous.filter((item) => !incoming.has(item.id))];
      });
      setUnread(data.unread);
      if (older || notifications.length <= 50) setHasMore(data.hasMore);
      setError("");
    } catch {
      if (!signal?.aborted) setError(t("loadError"));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }

  const poll = useEffectEvent((signal: AbortSignal) => { void loadNotifications(false, signal); });
  useEffect(() => { window.dispatchEvent(new Event("vestri:notifications-changed")); }, [unread]);
  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => { if (!controller.signal.aborted) poll(controller.signal); });
    const interval = setInterval(() => poll(controller.signal), 15000);
    return () => { controller.abort(); clearInterval(interval); };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    async function loadSettings() {
      try {
        const response = await fetch("/api/notifications/settings", { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("settings");
        const data = await response.json() as Settings;
        if (!controller.signal.aborted) { setSettings(data); setSettingsError(""); }
      } catch {
        if (!controller.signal.aborted) setSettingsError(t("loadError"));
      }
    }
    void loadSettings();
    return () => controller.abort();
  }, [t]);

  function updateSettings(next: Settings) { setSettings(next); setSaved(false); }

  async function saveSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!settings) return;
    setSaving(true);
    setSaved(false);
    setSettingsError("");
    try {
      const response = await fetch("/api/notifications/settings", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...settings, locale }),
      });
      if (!response.ok) throw new Error("save");
      setSettings(await response.json() as Settings);
      setSaved(true);
    } catch { setSettingsError(t("saveError")); } finally { setSaving(false); }
  }

  async function markRead(id?: string) {
    setBusy(true);
    try {
      const response = await fetch(id ? `/api/notifications/${encodeURIComponent(id)}/read` : "/api/notifications/read", { method: "POST" });
      if (!response.ok) throw new Error("read");
      setNotifications((previous) => previous.map((item) => !id || item.id === id ? { ...item, readAt: new Date().toISOString() } : item));
      await loadNotifications();
    } catch { setError(t("updateError")); } finally { setBusy(false); }
  }

  return (
    <div className="grid min-w-0 items-start gap-8 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <section className="min-w-0" aria-labelledby="notification-events">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="notification-events" className="text-lg font-semibold">{t("eventsTitle")}</h2>
            <p className="text-sm text-muted-foreground" aria-live="polite">{t("unread", { count: unread })}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" title={t("refresh")} aria-label={t("refresh")} disabled={busy || loading} onClick={() => { setBusy(true); void loadNotifications().finally(() => setBusy(false)); }}><RefreshCw className="size-4" /></Button>
            <Button variant="outline" size="sm" disabled={busy || unread === 0} onClick={() => void markRead()}><CheckCheck className="size-4" />{t("markAllRead")}</Button>
          </div>
        </div>
        {error && <p role="alert" className="mb-3 text-sm text-destructive">{error}</p>}
        {loading ? <p role="status" className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />{t("loading")}</p> : null}
        {!loading && !error && notifications.length === 0 ? <div className="flex items-center gap-3 border-y py-8 text-sm text-muted-foreground"><Bell className="size-5" />{t("empty")}</div> : null}
        <ul className="divide-y border-y empty:border-0">
          {notifications.map((item) => (
            <li key={item.id} className={`flex min-w-0 items-start gap-3 px-2 py-4 ${item.readAt ? "" : "bg-muted/40"}`}>
              <span className={`mt-2 size-2 shrink-0 rounded-full ${item.readAt ? "bg-transparent" : "bg-primary"}`} aria-label={item.readAt ? undefined : t("unreadLabel")} />
              <div className="min-w-0 flex-1 space-y-1">
                <p className="wrap-break-word text-sm font-medium">{t(`messages.${item.kind}`, { server: item.serverName, node: item.nodeName })}</p>
                <time dateTime={item.createdAt} className="block text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleString(locale)}</time>
                {item.deliveryFailed && <p className="text-xs text-destructive">{t("deliveryFailed")}</p>}
              </div>
              {!item.readAt && <Button variant="ghost" size="icon" className="shrink-0" title={t("markRead")} aria-label={t("markRead")} disabled={busy} onClick={() => void markRead(item.id)}><Check className="size-4" /></Button>}
            </li>
          ))}
        </ul>
        {hasMore && <Button variant="ghost" className="mt-3 w-full" disabled={busy} onClick={() => { setBusy(true); void loadNotifications(true).finally(() => setBusy(false)); }}><ChevronDown className="size-4" />{t("loadMore")}</Button>}
      </section>
      <section className="min-w-0 border-t pt-5 xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0" aria-labelledby="notification-settings">
        <h2 id="notification-settings" className="mb-3 text-lg font-semibold">{t("settingsTitle")}</h2>
        {settingsError && <p role="alert" className="mb-3 text-sm text-destructive">{settingsError}</p>}
        {!settings && !settingsError && <p className="text-sm text-muted-foreground">{t("loading")}</p>}
        {settings && <form onSubmit={(event) => void saveSettings(event)} className="space-y-5">
          <fieldset disabled={saving} className="divide-y">
            <legend className="mb-1 text-xs font-medium uppercase text-muted-foreground">{t("eventsTitle")}</legend>
            <p className="pb-2 text-xs text-muted-foreground">{t("eventsHint")}</p>
            {eventKinds.map((kind) => <SettingToggle key={kind} id={`notify-${kind}`} label={t(`events.${kind}`)} checked={settings.events[kind]} onChange={(checked) => updateSettings({ ...settings, events: { ...settings.events, [kind]: checked } })} />)}
          </fieldset>
          <fieldset disabled={saving} className="space-y-1 border-t pt-4">
            <legend className="text-xs font-medium uppercase text-muted-foreground">{t("deliveryTitle")}</legend>
            <SettingToggle id="notify-email" label={t("email")} checked={settings.emailEnabled} onChange={(checked) => updateSettings({ ...settings, emailEnabled: checked })} />
            <SettingToggle id="notify-webhook" label={t("webhook")} checked={settings.webhookEnabled} onChange={(checked) => updateSettings({ ...settings, webhookEnabled: checked })} />
            {(settings.webhookEnabled || settings.webhookUrl) && <div className="space-y-2 pt-2"><Label htmlFor="notification-webhook-url">{t("webhookUrl")}</Label><Input id="notification-webhook-url" type="url" placeholder="https://" autoComplete="off" required={settings.webhookEnabled} maxLength={2048} value={settings.webhookUrl} onChange={(event) => updateSettings({ ...settings, webhookUrl: event.target.value })} /></div>}
          </fieldset>
          <Button type="submit" disabled={saving} className="w-full">{saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}{t("save")}</Button>
          {saved && <p role="status" className="text-sm text-muted-foreground">{t("saved")}</p>}
        </form>}
      </section>
    </div>
  );
}