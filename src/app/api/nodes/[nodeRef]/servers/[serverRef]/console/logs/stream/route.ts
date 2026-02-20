import { NextRequest } from "next/server";

const GO_API_URL = process.env.GO_API_URL || "http://localhost:8080";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = {
  nodeRef: string;
  serverRef: string;
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

export async function GET(
  request: NextRequest,
  context: { params: Promise<RouteParams> }
) {
  const params = await context.params;
  const targetURL = buildBackendLogsURL(request, params);

  const headers = new Headers();
  const cookie = request.headers.get("cookie");
  if (cookie) {
    headers.set("cookie", cookie);
  }
  const accept = request.headers.get("accept");
  if (accept) {
    headers.set("accept", accept);
  }

  let upstream: Response;
  try {
    upstream = await fetch(targetURL, {
      method: "GET",
      headers,
      cache: "no-store",
      signal: request.signal,
    });
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
  const contentType = upstream.headers.get("content-type");
  if (contentType) {
    responseHeaders.set("Content-Type", contentType);
  }
  responseHeaders.set(
    "Cache-Control",
    upstream.headers.get("cache-control") || "no-cache, no-transform"
  );
  responseHeaders.set(
    "X-Accel-Buffering",
    upstream.headers.get("x-accel-buffering") || "no"
  );

  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}
