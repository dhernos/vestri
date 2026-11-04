"use client";

import { useEffect, useId, useState } from "react";
import { Ban, ChevronLeft, ChevronRight, History, LoaderCircle, Network, Plus, RefreshCw, Search, ShieldCheck, ShieldOff, Undo2, Users } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type PlayerEntry = { uuid: string; name: string };
type KnownPlayer = PlayerEntry & { lastIP: string; lastLoginIP?: string; lastAttempt: string; lastLogin?: string };
type LoginAttempt = { id: string; name: string; uuid?: string; ip: string; time: string; outcome: "success" | "denied" | "failed"; reason: string };
type PlayerData = {
  available: boolean;
  updatedAt: string;
  policyHealthy: boolean | null;
  policyError?: string;
  legacyMigration: boolean;
  policy: { whitelistEnabled: boolean; whitelist: PlayerEntry[]; bans: PlayerEntry[]; ipBans: string[] };
  players: KnownPlayer[];
  attempts: LoginAttempt[];
};
type View = "known" | "whitelist" | "bans" | "attempts";
type Mutation = {
  action: "whitelist-enable" | "whitelist-add" | "whitelist-remove" | "ban" | "unban" | "ip-ban" | "ip-unban";
  username?: string;
  uuid?: string;
  ip?: string;
  enabled?: boolean;
};
const PAGE_SIZE = 25;

export default function PlayerManagement({ basePath }: { basePath: string }) {
  const t = useTranslations("ServerPage.players");
  const format = useFormatter();
  const inputId = useId();
  const [data, setData] = useState<PlayerData | null>(null);
  const [view, setView] = useState<View>("known");
  const [search, setSearch] = useState("");
  const [outcome, setOutcome] = useState("all");
  const [page, setPage] = useState(0);
  const [username, setUsername] = useState("");
  const [ip, setIP] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [revision, setRevision] = useState(0);
  const [observedAt, setObservedAt] = useState(0);
  const [confirmation, setConfirmation] = useState<Mutation | null>(null);

  useEffect(() => {
    if (busy) return;
    const controller = new AbortController();
    let fetching = false;
    const load = async () => {
      if (fetching) return;
      fetching = true;
      try {
        const res = await fetch(`${basePath}/players`, { credentials: "include", cache: "no-store", signal: controller.signal });
        const payload = await res.json();
        if (!res.ok) throw new Error(payload.message || t("errors.load"));
        if (!controller.signal.aborted) {
          setData(payload as PlayerData);
          setObservedAt(Date.now());
          setError("");
        }
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : t("errors.load"));
      } finally {
        fetching = false;
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void load();
    const interval = window.setInterval(() => void load(), 15000);
    return () => { controller.abort(); window.clearInterval(interval); };
  }, [basePath, revision, busy, t]);

  const mutate = async (request: Mutation) => {
    if (busy) return;
    setBusy(true);
    setError("");
    setSaved("");
    try {
      const res = await fetch(`${basePath}/players`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.message || t("errors.save"));
      setData(payload as PlayerData);
      setSaved(t(payload.legacyMigration ? "migrated" : "saved"));
      setUsername("");
      setIP("");
      setConfirmation(null);
      setRevision((value) => value + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("errors.save"));
      setConfirmation(null);
    } finally {
      setBusy(false);
    }
  };

  const requestMutation = (request: Mutation) => {
    if (["ban", "ip-ban", "whitelist-remove"].includes(request.action) || (request.action === "whitelist-enable" && request.enabled)) {
      setConfirmation(request);
    } else {
      void mutate(request);
    }
  };
  const date = (value?: string) => value && Number.isFinite(Date.parse(value))
    ? format.dateTime(new Date(value), { dateStyle: "short", timeStyle: "medium" }) : t("unknown");
  const disabled = loading || busy || !data;
  const query = search.trim().toLowerCase();
  const matches = (...values: (string | undefined)[]) => values.some((value) => value?.toLowerCase().includes(query));
  const playerEntries = (view === "whitelist" ? data?.policy.whitelist : view === "bans" ? data?.policy.bans : data?.players) ?? [];
  const filteredPlayers = [...playerEntries].sort((left, right) => {
    if (view === "known") return Date.parse((right as KnownPlayer).lastAttempt) - Date.parse((left as KnownPlayer).lastAttempt);
    return left.name.localeCompare(right.name);
  }).filter((entry) => matches(entry.name, entry.uuid, (entry as KnownPlayer).lastIP, (entry as KnownPlayer).lastLoginIP));
  const filteredAttempts = (data?.attempts ?? []).filter((entry) => (outcome === "all" || entry.outcome === outcome)
    && matches(entry.name, entry.uuid, entry.ip, entry.reason)).sort((left, right) => Date.parse(right.time) - Date.parse(left.time));
  const count = view === "attempts" ? filteredAttempts.length : filteredPlayers.length;
  const lastPage = Math.max(0, Math.ceil(count / PAGE_SIZE) - 1);
  const currentPage = Math.min(page, lastPage);
  const offset = currentPage * PAGE_SIZE;
  const stale = !!data?.available && (!data.updatedAt || observedAt - Date.parse(data.updatedAt) > 30000);
  const views = [
    { key: "known", icon: Users }, { key: "whitelist", icon: ShieldCheck },
    { key: "bans", icon: Ban }, { key: "attempts", icon: History },
  ] as const;

  const playerActions = (entry: PlayerEntry) => {
    const whitelisted = data?.policy.whitelist.some((value) => value.uuid === entry.uuid);
    const banned = data?.policy.bans.some((value) => value.uuid === entry.uuid);
    return (
      <div className="flex justify-end gap-1">
        <Button type="button" variant="ghost" size="icon" disabled={disabled}
          title={t(whitelisted ? "whitelistRemove" : "whitelistAdd")} aria-label={t(whitelisted ? "whitelistRemove" : "whitelistAdd")}
          onClick={() => requestMutation({ action: whitelisted ? "whitelist-remove" : "whitelist-add", username: entry.name, uuid: entry.uuid })}>
          {whitelisted ? <ShieldOff /> : <ShieldCheck />}
        </Button>
        <Button type="button" variant="ghost" size="icon" disabled={disabled} className={banned ? undefined : "text-destructive"}
          title={t(banned ? "unban" : "ban")} aria-label={t(banned ? "unban" : "ban")}
          onClick={() => requestMutation({ action: banned ? "unban" : "ban", username: entry.name, uuid: entry.uuid })}>
          {banned ? <Undo2 /> : <Ban />}
        </Button>
      </div>
    );
  };

  return (
    <section className="min-w-0 space-y-5" aria-busy={loading || busy}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h2 className="text-xl font-semibold">{t("title")}</h2>
          {data?.updatedAt ? <p className="text-xs text-muted-foreground">{t("updated", { time: date(data.updatedAt) })}</p> : null}
        </div>
        <Button variant="outline" size="icon" title={t("refresh")} aria-label={t("refresh")} disabled={loading || busy}
          onClick={() => { setLoading(true); setRevision((value) => value + 1); }}>
          <RefreshCw className={loading ? "animate-spin" : undefined} />
        </Button>
      </div>
      {error ? <p role="alert" className="wrap-break-word text-sm text-destructive">{error}</p> : null}
      {saved ? <p role="status" className="wrap-break-word text-sm text-success">{saved}</p> : null}
      {data && (!data.available || stale) ? <p role="status" className="text-sm text-destructive">{t(stale ? "stale" : "unavailable")}</p> : null}
      {data?.policyHealthy === false ? <p role="alert" className="text-sm text-destructive">{t("policyError")}</p> : null}
      {data?.legacyMigration ? <div className="flex flex-wrap items-center gap-3">
        <p role="status" className="text-sm text-muted-foreground">{t("legacyMigration")}</p>
        <Button variant="outline" disabled={disabled || !data.available || stale || data.policyHealthy !== true}
          onClick={() => requestMutation({ action: "whitelist-enable", enabled: data.policy.whitelistEnabled })}>
          <ShieldCheck />{t("migrate")}
        </Button>
      </div> : null}
      {loading ? <p role="status" className="text-sm text-muted-foreground">{t("loading")}</p> : null}

      <div className="flex flex-wrap gap-1 border-b pb-2" role="group" aria-label={t("title")}>
        {views.map(({ key, icon: Icon }) => (
          <Button key={key} variant={view === key ? "secondary" : "ghost"} size="sm" aria-pressed={view === key}
            onClick={() => { setView(key); setPage(0); setSearch(""); }}>
            <Icon />{t(key)}
          </Button>
        ))}
      </div>

      {view === "whitelist" ? (
        <div className="flex items-center gap-2">
          <input id={`${inputId}-enabled`} type="checkbox" className="size-4 accent-primary" checked={data?.policy.whitelistEnabled ?? false}
            disabled={disabled} onChange={(event) => requestMutation({ action: "whitelist-enable", enabled: event.target.checked })} />
          <Label htmlFor={`${inputId}-enabled`}>{t("whitelistEnabled")}</Label>
        </div>
      ) : null}
      {view === "whitelist" || view === "bans" ? (
        <form className="flex flex-wrap items-end gap-3" onSubmit={(event) => {
          event.preventDefault(); requestMutation({ action: view === "whitelist" ? "whitelist-add" : "ban", username: username.trim() });
        }}>
          <div className="min-w-0 flex-1 space-y-2 sm:max-w-sm">
            <Label htmlFor={`${inputId}-name`}>{t("username")}</Label>
            <Input id={`${inputId}-name`} value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="off"
              autoCapitalize="none" spellCheck={false} required minLength={3} maxLength={16} pattern="[A-Za-z0-9_]{3,16}" disabled={disabled} />
          </div>
          <Button type="submit" disabled={disabled || !/^[A-Za-z0-9_]{3,16}$/.test(username.trim())}>
            {busy ? <LoaderCircle className="animate-spin" /> : view === "whitelist" ? <Plus /> : <Ban />}{t(view === "whitelist" ? "whitelistAdd" : "ban")}
          </Button>
        </form>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input className="pl-9" aria-label={t("search")} placeholder={t("search")} value={search}
            onChange={(event) => { setSearch(event.target.value); setPage(0); }} />
        </div>
        {view === "attempts" ? (
          <select className="h-9 max-w-full rounded-md border bg-background px-2 text-sm" value={outcome} aria-label={t("outcome")}
            onChange={(event) => { setOutcome(event.target.value); setPage(0); }}>
            {["all", "success", "denied", "failed"].map((value) => <option key={value} value={value}>{t(value)}</option>)}
          </select>
        ) : null}
        <span className="text-xs text-muted-foreground">{t("count", { count })}</span>
      </div>

      <div className="overflow-x-auto border-y">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="p-3 font-medium">{t("player")}</th>
              {view === "known" ? <><th className="p-3 font-medium">{t("lastLogin")}</th><th className="p-3 font-medium">{t("lastAttempt")}</th></> : null}
              {view === "attempts" ? <><th className="p-3 font-medium">{t("time")}</th><th className="p-3 font-medium">{t("ip")}</th><th className="p-3 font-medium">{t("outcome")}</th></> : null}
              <th className="p-3 text-right font-medium">{t("actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {view === "attempts" ? filteredAttempts.slice(offset, offset + PAGE_SIZE).map((entry) => (
              <tr key={entry.id}>
                <td className="p-3 align-top"><p className="font-medium">{entry.name}</p><p className="break-all font-mono text-xs text-muted-foreground">{entry.uuid || t("uuidUnavailable")}</p></td>
                <td className="whitespace-nowrap p-3 align-top text-xs">{date(entry.time)}</td>
                <td className="break-all p-3 align-top font-mono text-xs">{entry.ip}</td>
                <td className="max-w-xs p-3 align-top"><span className={entry.outcome === "success" ? "text-success" : "text-destructive"}>{t(entry.outcome)}</span><p className="mt-1 wrap-break-word text-xs text-muted-foreground">{entry.reason}</p></td>
                <td className="p-3 align-top"><div className="flex justify-end gap-1">
                  {entry.uuid ? playerActions({ name: entry.name, uuid: entry.uuid }) : null}
                  <Button variant="ghost" size="icon" disabled={disabled} title={t("ipBan")} aria-label={t("ipBan")}
                    onClick={() => requestMutation({ action: "ip-ban", ip: entry.ip })}><Network /></Button>
                </div></td>
              </tr>
            )) : filteredPlayers.slice(offset, offset + PAGE_SIZE).map((entry) => {
              const known = entry as KnownPlayer;
              const whitelisted = data?.policy.whitelist.some((value) => value.uuid === entry.uuid);
              const banned = data?.policy.bans.some((value) => value.uuid === entry.uuid);
              return <tr key={entry.uuid}>
                <td className="p-3 align-top"><div className="flex items-center gap-2"><span className="font-medium">{entry.name}</span>
                  {whitelisted ? <ShieldCheck className="size-4 text-success" aria-label={t("whitelisted")} /> : null}
                  {banned ? <Ban className="size-4 text-destructive" aria-label={t("banned")} /> : null}
                </div><p className="break-all font-mono text-xs text-muted-foreground">{entry.uuid}</p></td>
                {view === "known" ? <>
                  <td className="p-3 align-top text-xs"><p className="whitespace-nowrap">{date(known.lastLogin)}</p><p className="mt-1 break-all font-mono text-muted-foreground">{known.lastLoginIP || t("unknown")}</p></td>
                  <td className="p-3 align-top text-xs"><p className="whitespace-nowrap">{date(known.lastAttempt)}</p><p className="mt-1 break-all font-mono text-muted-foreground">{known.lastIP}</p></td>
                </> : null}
                <td className="p-3 align-top"><div className="flex justify-end gap-1">{playerActions(entry)}
                  {view === "known" && known.lastIP ? <Button variant="ghost" size="icon" disabled={disabled} title={t("ipBan")} aria-label={t("ipBan")}
                    onClick={() => requestMutation({ action: "ip-ban", ip: known.lastIP })}><Network /></Button> : null}
                </div></td>
              </tr>;
            })}
            {count === 0 ? <tr><td colSpan={view === "attempts" ? 5 : view === "known" ? 4 : 2} className="p-6 text-center text-muted-foreground">{t("empty")}</td></tr> : null}
          </tbody>
        </table>
      </div>
      {count > PAGE_SIZE ? <div className="flex items-center justify-end gap-3">
        <span className="text-xs text-muted-foreground">{t("page", { current: currentPage + 1, total: lastPage + 1 })}</span>
        <Button variant="outline" size="icon" disabled={currentPage === 0} title={t("previous")} aria-label={t("previous")} onClick={() => setPage(currentPage - 1)}><ChevronLeft /></Button>
        <Button variant="outline" size="icon" disabled={currentPage === lastPage} title={t("next")} aria-label={t("next")} onClick={() => setPage(currentPage + 1)}><ChevronRight /></Button>
      </div> : null}

      {view === "bans" ? <div className="space-y-4 border-t pt-4">
        <h3 className="text-base font-semibold">{t("ipBans")}</h3>
        <form className="flex flex-wrap items-end gap-3" onSubmit={(event) => { event.preventDefault(); requestMutation({ action: "ip-ban", ip: ip.trim() }); }}>
          <div className="min-w-0 flex-1 space-y-2 sm:max-w-sm"><Label htmlFor={`${inputId}-ip`}>{t("ip")}</Label>
            <Input id={`${inputId}-ip`} value={ip} onChange={(event) => setIP(event.target.value)} required maxLength={45} autoComplete="off" disabled={disabled} /></div>
          <Button type="submit" disabled={disabled || !ip.trim()}><Network />{t("ipBan")}</Button>
        </form>
        <ul className="divide-y border-y">
          {(data?.policy.ipBans ?? []).filter((value) => matches(value)).map((address) => <li key={address} className="flex min-w-0 items-center justify-between gap-3 py-2">
            <span className="break-all font-mono text-sm">{address}</span>
            <Button variant="ghost" size="icon" disabled={disabled} title={t("ipUnban")} aria-label={t("ipUnban")}
              onClick={() => requestMutation({ action: "ip-unban", ip: address })}><Undo2 /></Button>
          </li>)}
          {!data?.policy.ipBans.length ? <li className="py-4 text-sm text-muted-foreground">{t("empty")}</li> : null}
        </ul>
      </div> : null}

      <Dialog open={confirmation !== null} onOpenChange={(open) => { if (!open && !busy) setConfirmation(null); }}>
        <DialogContent><DialogHeader><DialogTitle>{t("confirmTitle")}</DialogTitle>
          <DialogDescription>{t("confirm", { target: confirmation?.username || confirmation?.ip || t("allPlayers") })}</DialogDescription>
        </DialogHeader><DialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => setConfirmation(null)}>{t("cancel")}</Button>
          <Button variant="destructive" disabled={busy} onClick={() => { if (confirmation) void mutate(confirmation); }}>
            {busy ? <LoaderCircle className="animate-spin" /> : <ShieldOff />}{t("apply")}
          </Button>
        </DialogFooter></DialogContent>
      </Dialog>
    </section>
  );
}