export const serverWorkspaceSections = [
  "dashboard",
  "config",
  "filesystem",
  "console",
] as const;

export type ServerWorkspaceSection = (typeof serverWorkspaceSections)[number];

export const isServerWorkspaceSection = (
  value: string,
): value is ServerWorkspaceSection => {
  return (serverWorkspaceSections as readonly string[]).includes(value);
};

export const normalizeServerWorkspaceSection = (
  value: string | null | undefined,
): ServerWorkspaceSection => {
  if (!value) {
    return "dashboard";
  }
  return isServerWorkspaceSection(value) ? value : "dashboard";
};

export const buildServerWorkspacePath = (
  nodeRef: string,
  serverRef: string,
  section: ServerWorkspaceSection = "dashboard",
) => {
  return `/servers/${encodeURIComponent(nodeRef)}/${encodeURIComponent(serverRef)}/${section}`;
};
