export const eventKinds = [
  "server_created", "server_deleted", "worker_unhealthy", "server_down",
  "worker_recovered", "server_recovered", "server_invited", "server_access_granted",
  "server_role_changed", "server_access_removed",
] as const;

export type EventKind = (typeof eventKinds)[number];
export type Notification = {
  id: string;
  kind: EventKind;
  nodeName: string;
  serverName: string;
  actorName?: string;
  role?: string;
  createdAt: string;
  readAt: string | null;
  deliveryFailed: boolean;
};

export function notificationMessageValues(
  item: Pick<Notification, "serverName" | "nodeName" | "actorName" | "role">,
  translateRole: (key: "roles.viewer" | "roles.operator" | "roles.admin") => string,
) {
  const role = item.role ?? "";
  return {
    server: item.serverName,
    node: item.nodeName,
    actor: item.actorName ?? "",
    role: role === "viewer" || role === "operator" || role === "admin"
      ? translateRole(`roles.${role}`) : role,
  };
}