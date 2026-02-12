"use client";

import { useCallback, useEffect, useState } from "react";
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
import { useAuth } from "@/hooks/useAuth";
import { Link } from "@/i18n/navigation";

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
  const { data: session, status } = useAuth();
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
    "servers/myserver/world.zip"
  );
  const [fsUploadPath, setFsUploadPath] = useState(
    "servers/myserver/world.zip"
  );
  const [fsUploadFile, setFsUploadFile] = useState<File | null>(null);
  const [fsDeletePath, setFsDeletePath] = useState("servers/myserver/world.zip");
  const [fsDeleteRecursive, setFsDeleteRecursive] = useState(false);
  const [fsZipSource, setFsZipSource] = useState("servers/myserver/world");
  const [fsZipDest, setFsZipDest] = useState("archives/world.zip");
  const [fsUnzipSource, setFsUnzipSource] = useState("archives/world.zip");
  const [fsUnzipDest, setFsUnzipDest] = useState("servers/myserver");
  const [stackName, setStackName] = useState("docker1");
  const [results, setResults] = useState<Record<string, string>>({});
  const [logs, setLogs] = useState<RequestLog[]>([]);

  const userId = session?.user?.id || "unknown";
  const requestedNode = searchParams.get("node") || "";
  const canCall = status === "authenticated" && selectedNodeRef !== "";
  const proxyBaseUrl = selectedNodeRef
    ? `/api/nodes/${encodeURIComponent(selectedNodeRef)}/worker`
    : "";
  const selectedNode = nodes.find((node) => node.id === selectedNodeRef) || null;

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
        setNodesError(data?.message || "Failed to load nodes.");
        return;
      }
      const loadedNodes: WorkerNode[] = Array.isArray(data?.nodes)
        ? data.nodes
        : [];
      setNodes(loadedNodes);
    } catch {
      setNodes([]);
      setNodesError("Failed to load nodes.");
    } finally {
      setNodesLoading(false);
    }
  }, []);

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
      if (selectedNodeRef !== requestedNode) {
        setSelectedNodeRef(requestedNode);
      }
      return;
    }

    if (!selectedNodeRef || !nodes.some((node) => node.id === selectedNodeRef)) {
      setSelectedNodeRef(nodes[0].id);
    }
  }, [nodes, requestedNode, selectedNodeRef, status]);

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
      const match =
        /filename\*?=(?:UTF-8''|\")?([^\";]+)\"?/i.exec(disposition);
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
    updateResult(id, "Running...");
    if (!canCall) {
      updateResult(
        id,
        "You must be authenticated and select a node to call this endpoint."
      );
      return;
    }
    if (!proxyBaseUrl) {
      updateResult(id, "Missing node selection.");
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
          normalizedPath
        );
        const blobUrl = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = blobUrl;
        anchor.download = fileName;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(blobUrl);
        output = `Downloaded ${fileName} (${blob.size} bytes).`;
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
      const message = err instanceof Error ? err.message : "Request failed.";
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
    return <p className="p-6">Loading...</p>;
  }

  if (status === "unauthenticated") {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You must be authenticated to use the API test tools.
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Worker API Test Bench</h1>
        <p className="text-sm text-muted-foreground">
          Signed request helper for the Go worker endpoints.
        </p>
        <p className="text-sm text-muted-foreground">
          Authenticated user id: {userId}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Connection</CardTitle>
          <CardDescription>Node selection shared by all calls.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="node-select">Node</Label>
            <div className="flex flex-wrap items-center gap-2">
              <select
                id="node-select"
                className="h-9 min-w-64 rounded-md border bg-transparent px-3 text-sm"
                value={selectedNodeRef}
                onChange={(event) => setSelectedNodeRef(event.target.value)}
                disabled={nodesLoading || nodes.length === 0}
              >
                {nodes.length === 0 ? (
                  <option value="">No nodes available</option>
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
                Refresh
              </Button>
              <Button asChild type="button" variant="outline" size="sm">
                <Link href="/nodes">Manage nodes</Link>
              </Button>
            </div>
            {nodesError && <p className="text-xs text-red-600">{nodesError}</p>}
            <p className="text-xs text-muted-foreground">
              Requests are proxied via /api/nodes/[nodeId]/worker.
            </p>
            {selectedNode ? (
              <p className="text-xs text-muted-foreground">
                Active role on this node: {selectedNode.accessRole}
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {!nodesLoading && nodes.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              No node available. Create one in{" "}
              <Link className="underline" href="/nodes">
                /nodes
              </Link>{" "}
              first.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Health</CardTitle>
          <CardDescription>GET /health</CardDescription>
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
            Run health check
          </Button>
          <ResultBlock id="health" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Settings (Disabled)</CardTitle>
          <CardDescription>GET /settings (expected 404)</CardDescription>
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
            Call /settings
          </Button>
          <ResultBlock id="settings" />
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Filesystem</h2>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>FS Read</CardTitle>
              <CardDescription>GET /fs/read?path=...</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="fs-read-path">Path</Label>
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
                Read file
              </Button>
              <ResultBlock id="fs-read" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>FS List</CardTitle>
              <CardDescription>GET /fs/list?path=...</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="fs-list-path">Path</Label>
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
                List path
              </Button>
              <ResultBlock id="fs-list" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>FS List (Safe Root)</CardTitle>
              <CardDescription>GET /fs/list?path=</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="fs-list-root-path">Path (empty for root)</Label>
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
                List safe root
              </Button>
              <ResultBlock id="fs-list-root" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>FS Write</CardTitle>
              <CardDescription>POST /fs/write</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="fs-write-path">Path</Label>
                <Input
                  id="fs-write-path"
                  value={fsWritePath}
                  onChange={(event) => setFsWritePath(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fs-write-content">Content</Label>
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
                Write file
              </Button>
              <ResultBlock id="fs-write" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>FS Download</CardTitle>
              <CardDescription>GET /fs/download?path=...</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="fs-download-path">Path</Label>
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
                Download file
              </Button>
              <ResultBlock id="fs-download" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>FS Upload</CardTitle>
              <CardDescription>POST /fs/upload (multipart)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="fs-upload-path">Path</Label>
                <Input
                  id="fs-upload-path"
                  value={fsUploadPath}
                  onChange={(event) => setFsUploadPath(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fs-upload-file">File</Label>
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
                    updateResult("fs-upload", "Select a file to upload.");
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
                Upload file
              </Button>
              <ResultBlock id="fs-upload" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>FS Delete</CardTitle>
              <CardDescription>POST /fs/delete (file or folder)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="fs-delete-path">Path</Label>
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
                  onChange={(event) => setFsDeleteRecursive(event.target.checked)}
                />
                Delete recursively (required for non-empty folders)
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
                Delete
              </Button>
              <ResultBlock id="fs-delete" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>FS Zip</CardTitle>
              <CardDescription>POST /fs/zip</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="fs-zip-source">Source</Label>
                <Input
                  id="fs-zip-source"
                  value={fsZipSource}
                  onChange={(event) => setFsZipSource(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fs-zip-dest">Destination</Label>
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
                Create zip
              </Button>
              <ResultBlock id="fs-zip" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>FS Unzip</CardTitle>
              <CardDescription>POST /fs/unzip</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="fs-unzip-source">Source</Label>
                <Input
                  id="fs-unzip-source"
                  value={fsUnzipSource}
                  onChange={(event) => setFsUnzipSource(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fs-unzip-dest">Destination</Label>
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
                Unzip archive
              </Button>
              <ResultBlock id="fs-unzip" />
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Stack</h2>
        <Card>
          <CardHeader>
            <CardTitle>Stack Controls</CardTitle>
            <CardDescription>
              GET /stack/status, POST /stack/up|down|restart
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="stack-name">Stack name</Label>
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
                Status
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
                Up
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
                Down
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
                Restart
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
          <CardTitle>Request Log</CardTitle>
          <CardDescription>
            User id and node id are captured with each call.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No requests yet.</p>
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
                      {entry.ok ? "OK" : "ERR"} {entry.status}
                    </span>
                  </div>
                  <div className="text-muted-foreground">
                    User: {entry.userId} | Node: {entry.nodeRef} |{" "}
                    {entry.durationMs}ms
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
            Clear log
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
