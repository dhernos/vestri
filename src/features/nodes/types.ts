export type NodeAccessRole = "owner" | "admin" | "operator" | "viewer";

export type WorkerNode = {
  id: string;
  slug: string;
  name: string;
  baseUrl: string;
  ownerUserId: string;
  accessRole: NodeAccessRole;
  isOwner: boolean;
  apiKeyPreview: string;
  createdAt: string;
  updatedAt: string;
};

export type WorkerNodeSummary = Pick<WorkerNode, "id" | "slug" | "name" | "accessRole">;

export type IncomingNodeInvite = {
  id: string;
  nodeId: string;
  nodeName: string;
  nodeSlug: string;
  serverId: string;
  serverName: string;
  serverSlug: string;
  inviterMail: string;
  permission: Exclude<NodeAccessRole, "owner">;
  expiresAt: string;
};
