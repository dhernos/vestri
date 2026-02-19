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

  const userId = session?.user?.id || "unknown";
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
    updateResult(id, "Running...");
    if (!canCall) {
      updateResult(
        id,
        "You must be authenticated and select a node to call this endpoint.",
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
                onChange={(event) => handleNodeChange(event.target.value)}
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

      <GameServerPanel
        nodeRef={selectedNodeRef}
        nodeRole={selectedNode ? selectedNode.accessRole : null}
      />
    </div>
  );
}
