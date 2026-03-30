import { NextRequest } from "next/server";
import http from "node:http";
import https from "node:https";
import { Buffer } from "node:buffer";

const GO_API_URL = process.env.GO_API_URL || "http://localhost:8080";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = {
  nodeRef: string;
  serverRef: string;
};

type NodeUpstreamStream = {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: ReadableStream<Uint8Array>;
};

const buildBackendLogsURL = (request: NextRequest, params: RouteParams) => {
  const target = new URL(
    `${GO_API_URL}/api/nodes/${encodeURIComponent(params.nodeRef)}/servers/${encodeURIComponent(
      params.serverRef
    )}/console/logs/stream`
  );
  target.search = request.nextUrl.search;
  return target;
};

const getSingleHeaderValue = (value: string | string[] | undefined) => {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
};

const requestBackendStream = (
  targetURL: URL,
  headers: Record<string, string>,
  signal: AbortSignal
): Promise<NodeUpstreamStream> =>
  new Promise((resolve, reject) => {
    const client = targetURL.protocol === "https:" ? https : http;
    let settled = false;

    const onAbort = () => {
      req.destroy();
      if (settled) {
        return;
      }
      settled = true;
      reject(new Error("Request aborted."));
    };

    const req = client.request(
      targetURL,
      {
        method: "GET",
        headers,
      },
      (res) => {
        const responseBody = new ReadableStream<Uint8Array>({
          start(controller) {
            res.on("data", (chunk: Buffer | string) => {
              const payload =
                typeof chunk === "string" ? Buffer.from(chunk) : chunk;
              controller.enqueue(new Uint8Array(payload));
            });
            res.on("end", () => {
              controller.close();
            });
            res.on("error", (error) => {
              controller.error(error);
            });
          },
          cancel(reason) {
            if (reason instanceof Error) {
              res.destroy(reason);
              return;
            }
            res.destroy();
          },
        });

        signal.removeEventListener("abort", onAbort);
        settled = true;
        resolve({
          status: res.statusCode || 502,
          headers: res.headers,
          body: responseBody,
        });
      }
    );

    req.on("error", (error) => {
      signal.removeEventListener("abort", onAbort);
      if (settled) {
        return;
      }
      settled = true;
      reject(error);
    });

    if (signal.aborted) {
      onAbort();
      return;
    }

    signal.addEventListener("abort", onAbort, { once: true });
    req.end();
  });

export async function GET(
  request: NextRequest,
  context: { params: Promise<RouteParams> }
) {
  const params = await context.params;
  const targetURL = buildBackendLogsURL(request, params);

  const headers: Record<string, string> = {};
  const cookie = request.headers.get("cookie");
  if (cookie) {
    headers.cookie = cookie;
  }
  const accept = request.headers.get("accept");
  if (accept) {
    headers.accept = accept;
  }
  headers["accept-encoding"] = "identity";

  let upstream: NodeUpstreamStream;
  try {
    upstream = await requestBackendStream(targetURL, headers, request.signal);
  } catch {
    return new Response("Failed to reach backend log stream.", {
      status: 502,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
      },
    });
  }

  const responseHeaders = new Headers();
  const contentType = getSingleHeaderValue(upstream.headers["content-type"]);
  if (contentType) {
    responseHeaders.set("Content-Type", contentType);
  }
  responseHeaders.set(
    "Cache-Control",
    getSingleHeaderValue(upstream.headers["cache-control"]) ||
      "no-cache, no-transform"
  );
  responseHeaders.set(
    "X-Accel-Buffering",
    getSingleHeaderValue(upstream.headers["x-accel-buffering"]) || "no"
  );
  responseHeaders.set("Connection", "keep-alive");

  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}
