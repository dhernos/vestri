"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import GameServerPanel from "@/components/dashboard/game-server-panel";
import { useAuth } from "@/hooks/useAuth";
import { Link, usePathname, useRouter } from "@/i18n/navigation";

type HttpMethod = "GET" | "POST";

type WorkerNode = {
  id: string;
  slug: string;
  name: string;
  baseUrl: string;
  accessRole: "owner" | "admin" | "operator" | "viewer";
};

type RequestLog = {
  id: string;
  time: string;
  userId: string;
  nodeRef: string;
  method: HttpMethod;
  path: string;
  status: number | "error";
  ok: boolean;
  durationMs: number;
  error?: string;
};

type RequestOptions = {
  id: string;
  method: HttpMethod;
  path: string;
  body?: BodyInit | null;
  extraHeaders?: Record<string, string>;
  download?: boolean;
};

export default function DashboardPage() {
  const t = useTranslations("TestPage");
  const { data: session, status } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [nodes, setNodes] = useState<WorkerNode[]>([]);
  const [nodesLoading, setNodesLoading] = useState(false);
  const [nodesError, setNodesError] = useState("");
  const [selectedNodeRef, setSelectedNodeRef] = useState("");
  const [fsReadPath, setFsReadPath] = useState("mc-01/server.properties");
  const [fsListPath, setFsListPath] = useState("mc-01");
  const [fsListRootPath, setFsListRootPath] = useState("");
  const [fsWritePath, setFsWritePath] = useState("mc-01/server.properties");
  const [fsWriteContent, setFsWriteContent] = useState("max-players=20");
  const [fsDownloadPath, setFsDownloadPath] = useState(
    "servers/myserver/world.zip",
  );
  const [fsUploadPath, setFsUploadPath] = useState(
    "servers/myserver/world.zip",
  );
  const [fsUploadFile, setFsUploadFile] = useState<File | null>(null);
  const [fsDeletePath, setFsDeletePath] = useState(
    "servers/myserver/world.zip",
  );
  const [fsDeleteRecursive, setFsDeleteRecursive] = useState(false);
  const [fsZipSource, setFsZipSource] = useState("servers/myserver/world");
  const [fsZipDest, setFsZipDest] = useState("archives/world.zip");
  const [fsUnzipSource, setFsUnzipSource] = useState("archives/world.zip");
  const [fsUnzipDest, setFsUnzipDest] = useState("servers/myserver");
  const [stackName, setStackName] = useState("docker1");
  const [results, setResults] = useState<Record<string, string>>({});
  const [logs, setLogs] = useState<RequestLog[]>([]);

  const userId = session?.user?.id || t("fallback.unknownUser");
  const requestedNode = searchParams.get("node") || "";
  const canCall = status === "authenticated" && selectedNodeRef !== "";
  const proxyBaseUrl = selectedNodeRef
    ? `/api/nodes/${encodeURIComponent(selectedNodeRef)}/worker`
    : "";
  const selectedNode =
    nodes.find((node) => node.id === selectedNodeRef) || null;

  const loadNodes = useCallback(async () => {
    setNodesLoading(true);
    setNodesError("");
    try {
      const res = await fetch("/api/nodes", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNodes([]);
        setNodesError(data?.message || t("errors.loadNodes"));
        return;
      }
      const loadedNodes: WorkerNode[] = Array.isArray(data?.nodes)
        ? data.nodes
        : [];
      setNodes(loadedNodes);
    } catch {
      setNodes([]);
      setNodesError(t("errors.loadNodes"));
    } finally {
      setNodesLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }
    loadNodes();
  }, [status, loadNodes]);

  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }

    if (nodes.length === 0) {
      setSelectedNodeRef("");
      return;
    }

    if (requestedNode && nodes.some((node) => node.id === requestedNode)) {
      setSelectedNodeRef((current) =>
        current === requestedNode ? current : requestedNode,
      );
      return;
    }

    setSelectedNodeRef((current) => {
      if (current && nodes.some((node) => node.id === current)) {
        return current;
      }
      return nodes[0].id;
    });
  }, [nodes, requestedNode, status]);

  const handleNodeChange = (nextNodeRef: string) => {
    setSelectedNodeRef(nextNodeRef);

    const params = new URLSearchParams(searchParams.toString());
    if (nextNodeRef) {
      params.set("node", nextNodeRef);
    } else {
      params.delete("node");
    }

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  };

  const updateResult = (id: string, value: string) => {
    setResults((prev) => ({ ...prev, [id]: value }));
  };

  const addLog = (entry: RequestLog) => {
    setLogs((prev) => [entry, ...prev].slice(0, 50));
  };

  const ensureLeadingSlash = (value: string) =>
    value.startsWith("/") ? value : `/${value}`;

  const createNonce = () => {
    if (crypto.randomUUID) {
      return crypto.randomUUID();
    }
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  };

  const readResponseBody = async (res: Response) => {
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const data = await res.json().catch(() => null);
      return data ? JSON.stringify(data, null, 2) : "";
    }
    return res.text();
  };

  const formatResponse = (res: Response, body: string) => {
    const headerLine = `${res.status} ${res.statusText}`.trim();
    if (!body) {
      return headerLine;
    }
    return `${headerLine}\n${body}`;
  };

  const getDownloadName = (disposition: string | null, path: string) => {
    if (disposition) {
      const match = /filename\*?=(?:UTF-8''|\")?([^\";]+)\"?/i.exec(
        disposition,
      );
      if (match?.[1]) {
        return decodeURIComponent(match[1]);
      }
    }
    const fallback = path.split("?")[0].split("/").pop();
    return fallback || "download";
  };

  const handleRequest = async ({
    id,
    method,
    path,
    body,
    extraHeaders,
    download,
  }: RequestOptions) => {
    updateResult(id, t("request.running"));
    if (!canCall) {
      updateResult(
        id,
        t("request.authAndNodeRequired")
      );
      return;
    }
    if (!proxyBaseUrl) {
      updateResult(id, t("request.missingNodeSelection"));
      return;
    }

    const normalizedPath = ensureLeadingSlash(path);
    const url = `${proxyBaseUrl}${normalizedPath}`;
    const startedAt = performance.now();

    try {
      const headers = new Headers(extraHeaders);
      const res = await fetch(url, {
        method,
        headers,
        body,
        credentials: "include",
      });
      let output = "";

      if (download && res.ok) {
        const blob = await res.blob();
        const fileName = getDownloadName(
          res.headers.get("content-disposition"),
          normalizedPath,
        );
        const blobUrl = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = blobUrl;
        anchor.download = fileName;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(blobUrl);
        output = t("request.downloaded", { fileName, size: blob.size });
      } else {
        const responseBody = await readResponseBody(res);
        output = formatResponse(res, responseBody);
      }

      updateResult(id, output);
      addLog({
        id: createNonce(),
        time: new Date().toLocaleTimeString(),
        userId,
        nodeRef: selectedNodeRef,
        method,
        path: normalizedPath,
        status: res.status,
        ok: res.ok,
        durationMs: Math.round(performance.now() - startedAt),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : t("request.failed");
      updateResult(id, message);
      addLog({
        id: createNonce(),
        time: new Date().toLocaleTimeString(),
        userId,
        nodeRef: selectedNodeRef,
        method,
        path: normalizedPath,
        status: "error",
        ok: false,
        durationMs: Math.round(performance.now() - startedAt),
        error: message,
      });
    }
  };

  const ResultBlock = ({ id }: { id: string }) => {
    const value = results[id];
    if (!value) return null;
    return (
      <pre className="mt-3 whitespace-pre-wrap rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
        {value}
      </pre>
    );
  };

  const fsReadRequestPath = `/fs/read?path=${fsReadPath}`;
  const fsListRequestPath = `/fs/list?path=${fsListPath}`;
  const fsListRootRequestPath = `/fs/list?path=${fsListRootPath}`;
  const fsDownloadRequestPath = `/fs/download?path=${fsDownloadPath}`;
  const stackStatusPath = `/stack/status?stack=${stackName}`;

  if (status === "loading") {
    return <p className="p-6">{t("loading")}</p>;
  }

  if (status === "unauthenticated") {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("unauthenticatedMessage")}
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">{t("benchTitle")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("benchDescription")}
        </p>
        <p className="text-sm text-muted-foreground">
          {t("authenticatedUserId", { userId })}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("connection.title")}</CardTitle>
          <CardDescription>{t("connection.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="node-select">{t("connection.nodeLabel")}</Label>
            <div className="flex flex-wrap items-center gap-2">
              <select
                id="node-select"
                className="h-9 min-w-64 rounded-md border bg-transparent px-3 text-sm"
                value={selectedNodeRef}
                onChange={(event) => handleNodeChange(event.target.value)}
                disabled={nodesLoading || nodes.length === 0}
              >
                {nodes.length === 0 ? (
                  <option value="">{t("connection.noNodes")}</option>
                ) : (
                  nodes.map((node) => (
                    <option key={node.id} value={node.id}>
                      {node.name} ({node.slug})
                    </option>
                  ))
                )}
              </select>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={loadNodes}
                disabled={nodesLoading}
              >
                {t("buttons.refresh")}
              </Button>
              <Button asChild type="button" variant="outline" size="sm">
                <Link href="/nodes">{t("buttons.manageNodes")}</Link>
              </Button>
            </div>
            {nodesError && <p className="text-xs text-red-600">{nodesError}</p>}
            <p className="text-xs text-muted-foreground">
              {t("connection.proxyInfo")}
            </p>
            {selectedNode ? (
              <p className="text-xs text-muted-foreground">
                {t("connection.activeRole", { role: selectedNode.accessRole })}
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {!nodesLoading && nodes.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              {t("noNodeAvailable.prefix")}{" "}
              <Link className="underline" href="/nodes">
                /nodes
              </Link>{" "}
              {t("noNodeAvailable.suffix")}
            </p>
          </CardContent>
        </Card>
      ) : null}

      <GameServerPanel
        nodeRef={selectedNodeRef}
        nodeRole={selectedNode ? selectedNode.accessRole : null}
      />

      <Card>
        <CardHeader>
          <CardTitle>{t("health.title")}</CardTitle>
          <CardDescription>{t("health.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={() =>
              handleRequest({
                id: "health",
                method: "GET",
                path: "/health",
              })
            }
            disabled={!canCall}
          >
            {t("health.buttons.run")}
          </Button>
          <ResultBlock id="health" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("settings.title")}</CardTitle>
          <CardDescription>{t("settings.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={() =>
              handleRequest({
                id: "settings",
                method: "GET",
                path: "/settings",
              })
            }
            disabled={!canCall}
          >
            {t("settings.buttons.call")}
          </Button>
          <ResultBlock id="settings" />
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">{t("filesystem.title")}</h2>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{t("filesystem.read.title")}</CardTitle>
              <CardDescription>{t("filesystem.read.description")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="fs-read-path">{t("fields.path")}</Label>
                <Input
                  id="fs-read-path"
                  value={fsReadPath}
                  onChange={(event) => setFsReadPath(event.target.value)}
                />
              </div>
              <Button
                onClick={() =>
                  handleRequest({
                    id: "fs-read",
                    method: "GET",
                    path: fsReadRequestPath,
                  })
                }
                disabled={!canCall}
              >
                {t("filesystem.read.buttons.run")}
              </Button>
              <ResultBlock id="fs-read" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("filesystem.list.title")}</CardTitle>
              <CardDescription>{t("filesystem.list.description")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="fs-list-path">{t("fields.path")}</Label>
                <Input
                  id="fs-list-path"
                  value={fsListPath}
                  onChange={(event) => setFsListPath(event.target.value)}
                />
              </div>
              <Button
                onClick={() =>
                  handleRequest({
                    id: "fs-list",
                    method: "GET",
                    path: fsListRequestPath,
                  })
                }
                disabled={!canCall}
              >
                {t("filesystem.list.buttons.run")}
              </Button>
              <ResultBlock id="fs-list" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("filesystem.listRoot.title")}</CardTitle>
              <CardDescription>{t("filesystem.listRoot.description")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="fs-list-root-path">{t("filesystem.listRoot.pathLabel")}</Label>
                <Input
                  id="fs-list-root-path"
                  value={fsListRootPath}
                  onChange={(event) => setFsListRootPath(event.target.value)}
                />
              </div>
              <Button
                onClick={() =>
                  handleRequest({
                    id: "fs-list-root",
                    method: "GET",
                    path: fsListRootRequestPath,
                  })
                }
                disabled={!canCall}
              >
                {t("filesystem.listRoot.buttons.run")}
              </Button>
              <ResultBlock id="fs-list-root" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("filesystem.write.title")}</CardTitle>
              <CardDescription>{t("filesystem.write.description")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="fs-write-path">{t("fields.path")}</Label>
                <Input
                  id="fs-write-path"
                  value={fsWritePath}
                  onChange={(event) => setFsWritePath(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fs-write-content">{t("fields.content")}</Label>
                <textarea
                  id="fs-write-content"
                  value={fsWriteContent}
                  onChange={(event) => setFsWriteContent(event.target.value)}
                  className="min-h-24 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                />
              </div>
              <Button
                onClick={() =>
                  handleRequest({
                    id: "fs-write",
                    method: "POST",
                    path: "/fs/write",
                    body: JSON.stringify({
                      path: fsWritePath,
                      content: fsWriteContent,
                    }),
                    extraHeaders: { "Content-Type": "application/json" },
                  })
                }
                disabled={!canCall}
              >
                {t("filesystem.write.buttons.run")}
              </Button>
              <ResultBlock id="fs-write" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("filesystem.download.title")}</CardTitle>
              <CardDescription>{t("filesystem.download.description")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="fs-download-path">{t("fields.path")}</Label>
                <Input
                  id="fs-download-path"
                  value={fsDownloadPath}
                  onChange={(event) => setFsDownloadPath(event.target.value)}
                />
              </div>
              <Button
                onClick={() =>
                  handleRequest({
                    id: "fs-download",
                    method: "GET",
                    path: fsDownloadRequestPath,
                    download: true,
                  })
                }
                disabled={!canCall}
              >
                {t("filesystem.download.buttons.run")}
              </Button>
              <ResultBlock id="fs-download" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("filesystem.upload.title")}</CardTitle>
              <CardDescription>{t("filesystem.upload.description")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="fs-upload-path">{t("fields.path")}</Label>
                <Input
                  id="fs-upload-path"
                  value={fsUploadPath}
                  onChange={(event) => setFsUploadPath(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fs-upload-file">{t("fields.file")}</Label>
                <Input
                  id="fs-upload-file"
                  type="file"
                  onChange={(event) =>
                    setFsUploadFile(event.target.files?.[0] || null)
                  }
                />
              </div>
              <Button
                onClick={() => {
                  if (!fsUploadFile) {
                    updateResult("fs-upload", t("filesystem.upload.errors.selectFile"));
                    return;
                  }
                  const formData = new FormData();
                  formData.append("path", fsUploadPath);
                  formData.append("file", fsUploadFile);
                  handleRequest({
                    id: "fs-upload",
                    method: "POST",
                    path: "/fs/upload",
                    body: formData,
                  });
                }}
                disabled={!canCall}
              >
                {t("filesystem.upload.buttons.run")}
              </Button>
              <ResultBlock id="fs-upload" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("filesystem.delete.title")}</CardTitle>
              <CardDescription>
                {t("filesystem.delete.description")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="fs-delete-path">{t("fields.path")}</Label>
                <Input
                  id="fs-delete-path"
                  value={fsDeletePath}
                  onChange={(event) => setFsDeletePath(event.target.value)}
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={fsDeleteRecursive}
                  onChange={(event) =>
                    setFsDeleteRecursive(event.target.checked)
                  }
                />
                {t("filesystem.delete.recursiveHint")}
              </label>
              <Button
                variant="destructive"
                onClick={() =>
                  handleRequest({
                    id: "fs-delete",
                    method: "POST",
                    path: "/fs/delete",
                    body: JSON.stringify({
                      path: fsDeletePath,
                      recursive: fsDeleteRecursive,
                    }),
                    extraHeaders: { "Content-Type": "application/json" },
                  })
                }
                disabled={!canCall}
              >
                {t("filesystem.delete.buttons.run")}
              </Button>
              <ResultBlock id="fs-delete" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("filesystem.zip.title")}</CardTitle>
              <CardDescription>{t("filesystem.zip.description")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="fs-zip-source">{t("fields.source")}</Label>
                <Input
                  id="fs-zip-source"
                  value={fsZipSource}
                  onChange={(event) => setFsZipSource(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fs-zip-dest">{t("fields.destination")}</Label>
                <Input
                  id="fs-zip-dest"
                  value={fsZipDest}
                  onChange={(event) => setFsZipDest(event.target.value)}
                />
              </div>
              <Button
                onClick={() =>
                  handleRequest({
                    id: "fs-zip",
                    method: "POST",
                    path: "/fs/zip",
                    body: JSON.stringify({
                      source: fsZipSource,
                      dest: fsZipDest,
                    }),
                    extraHeaders: { "Content-Type": "application/json" },
                  })
                }
                disabled={!canCall}
              >
                {t("filesystem.zip.buttons.run")}
              </Button>
              <ResultBlock id="fs-zip" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("filesystem.unzip.title")}</CardTitle>
              <CardDescription>{t("filesystem.unzip.description")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="fs-unzip-source">{t("fields.source")}</Label>
                <Input
                  id="fs-unzip-source"
                  value={fsUnzipSource}
                  onChange={(event) => setFsUnzipSource(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fs-unzip-dest">{t("fields.destination")}</Label>
                <Input
                  id="fs-unzip-dest"
                  value={fsUnzipDest}
                  onChange={(event) => setFsUnzipDest(event.target.value)}
                />
              </div>
              <Button
                onClick={() =>
                  handleRequest({
                    id: "fs-unzip",
                    method: "POST",
                    path: "/fs/unzip",
                    body: JSON.stringify({
                      source: fsUnzipSource,
                      dest: fsUnzipDest,
                    }),
                    extraHeaders: { "Content-Type": "application/json" },
                  })
                }
                disabled={!canCall}
              >
                {t("filesystem.unzip.buttons.run")}
              </Button>
              <ResultBlock id="fs-unzip" />
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">{t("stack.title")}</h2>
        <Card>
          <CardHeader>
            <CardTitle>{t("stack.controls.title")}</CardTitle>
            <CardDescription>
              {t("stack.controls.description")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="stack-name">{t("stack.controls.stackNameLabel")}</Label>
              <Input
                id="stack-name"
                value={stackName}
                onChange={(event) => setStackName(event.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() =>
                  handleRequest({
                    id: "stack-status",
                    method: "GET",
                    path: stackStatusPath,
                  })
                }
                disabled={!canCall}
              >
                {t("stack.controls.buttons.status")}
              </Button>
              <Button
                onClick={() =>
                  handleRequest({
                    id: "stack-up",
                    method: "POST",
                    path: "/stack/up",
                    body: JSON.stringify({ stack: stackName }),
                    extraHeaders: { "Content-Type": "application/json" },
                  })
                }
                disabled={!canCall}
              >
                {t("stack.controls.buttons.up")}
              </Button>
              <Button
                onClick={() =>
                  handleRequest({
                    id: "stack-down",
                    method: "POST",
                    path: "/stack/down",
                    body: JSON.stringify({ stack: stackName }),
                    extraHeaders: { "Content-Type": "application/json" },
                  })
                }
                disabled={!canCall}
              >
                {t("stack.controls.buttons.down")}
              </Button>
              <Button
                onClick={() =>
                  handleRequest({
                    id: "stack-restart",
                    method: "POST",
                    path: "/stack/restart",
                    body: JSON.stringify({ stack: stackName }),
                    extraHeaders: { "Content-Type": "application/json" },
                  })
                }
                disabled={!canCall}
              >
                {t("stack.controls.buttons.restart")}
              </Button>
            </div>
            <ResultBlock id="stack-status" />
            <ResultBlock id="stack-up" />
            <ResultBlock id="stack-down" />
            <ResultBlock id="stack-restart" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("requestLog.title")}</CardTitle>
          <CardDescription>
            {t("requestLog.description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("requestLog.empty")}</p>
          ) : (
            <div className="max-h-72 space-y-2 overflow-auto">
              {logs.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-md border px-3 py-2 text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      {entry.time} - {entry.method} {entry.path}
                    </span>
                    <span
                      className={entry.ok ? "text-green-600" : "text-red-600"}
                    >
                      {entry.ok ? t("requestLog.status.ok") : t("requestLog.status.err")} {entry.status}
                    </span>
                  </div>
                  <div className="text-muted-foreground">
                    {t("requestLog.meta", {
                      userId: entry.userId,
                      nodeRef: entry.nodeRef,
                      durationMs: entry.durationMs,
                    })}
                  </div>
                  {entry.error && (
                    <div className="text-red-600">{entry.error}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
        <CardFooter>
          <Button
            variant="secondary"
            onClick={() => setLogs([])}
            disabled={logs.length === 0}
          >
            {t("requestLog.buttons.clear")}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
