import type { IncomingNodeInvite, WorkerNode } from "@/features/nodes/types";

type ApiResult<T> = {
  ok: boolean;
  message?: string;
  data: T;
};

type NodesPayload = {
  nodes?: WorkerNode[];
  message?: string;
};

type InvitesPayload = {
  invites?: IncomingNodeInvite[];
  message?: string;
};

type NodePayload = {
  node?: WorkerNode | null;
  message?: string;
};

const readJson = async <T>(res: Response): Promise<T> => {
  return (await res.json().catch(() => ({}))) as T;
};

export const fetchNodes = async (): Promise<ApiResult<WorkerNode[]>> => {
  const res = await fetch("/api/nodes", {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });
  const body = await readJson<NodesPayload>(res);
  return {
    ok: res.ok,
    message: body?.message,
    data: Array.isArray(body?.nodes) ? body.nodes : [],
  };
};

export const createNode = async (payload: {
  name: string;
  ip: string;
  apiKey: string;
}): Promise<ApiResult<null>> => {
  const res = await fetch("/api/nodes", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await readJson<{ message?: string }>(res);
  return {
    ok: res.ok,
    message: body?.message,
    data: null,
  };
};

export const fetchIncomingNodeInvites = async (): Promise<ApiResult<IncomingNodeInvite[]>> => {
  const res = await fetch("/api/nodes/invites", {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });
  const body = await readJson<InvitesPayload>(res);
  return {
    ok: res.ok,
    message: body?.message,
    data: Array.isArray(body?.invites) ? body.invites : [],
  };
};

export const acceptIncomingNodeInvite = async (inviteId: string): Promise<ApiResult<null>> => {
  const res = await fetch(`/api/nodes/invites/${encodeURIComponent(inviteId)}/accept`, {
    method: "POST",
    credentials: "include",
  });
  const body = await readJson<{ message?: string }>(res);
  return {
    ok: res.ok,
    message: body?.message,
    data: null,
  };
};

export const fetchNodeDetails = async (nodeRef: string): Promise<ApiResult<WorkerNode | null>> => {
  const res = await fetch(`/api/nodes/${encodeURIComponent(nodeRef)}`, {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });
  const body = await readJson<NodePayload>(res);
  return {
    ok: res.ok,
    message: body?.message,
    data: body?.node || null,
  };
};

export const deleteNodeById = async (nodeId: string): Promise<ApiResult<null>> => {
  const res = await fetch(`/api/nodes/${encodeURIComponent(nodeId)}`, {
    method: "DELETE",
    credentials: "include",
  });
  const body = await readJson<{ message?: string }>(res);
  return {
    ok: res.ok,
    message: body?.message,
    data: null,
  };
};
