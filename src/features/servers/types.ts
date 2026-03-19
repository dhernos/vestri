export type ServerStatus = "up" | "down" | "unknown";

export type GameServerKind = "standalone" | "velocity" | "velocity-backend";

export type InvitePermission = "admin" | "operator" | "viewer";

export type GameServerPermissions = {
  canView: boolean;
  canCreate: boolean;
  canControl: boolean;
  canManageFiles: boolean;
  canReadConsole: boolean;
  canManage: boolean;
};

export type GameServerConfigFile = {
  id: string;
  title: string;
  path: string;
  format: string;
};

export type GameServerTemplateVersionField = {
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  options?: string[];
  optionsBySoftware?: Record<string, string[]>;
};

export type GameServerTemplateVersionConfig = {
  software?: GameServerTemplateVersionField;
  game?: GameServerTemplateVersionField;
};

export type GameServerTemplateAgreement = {
  required: boolean;
  title?: string;
  text?: string;
  linkText?: string;
  linkUrl?: string;
};

export type GameServerTemplate = {
  id: string;
  name: string;
  game?: string;
  agreement?: GameServerTemplateAgreement;
  versionConfig?: GameServerTemplateVersionConfig;
};

export type GameServerListItem = {
  id: string;
  nodeId?: string;
  slug: string;
  name: string;
  kind?: GameServerKind;
  parentServerId?: string;
  connectHost?: string;
  connectPort?: number;
  templateId: string;
  templateVersion?: string;
  templateName: string;
  softwareVersion?: string;
  gameVersion?: string;
  stackName?: string;
  rootPath?: string;
  composePath?: string;
  configFiles?: GameServerConfigFile[];
  status: ServerStatus;
  statusOutput?: string;
  statusError?: string;
  imageUpdateAvailable?: boolean;
  imageStatusError?: string;
  permissions: GameServerPermissions;
};

export type GameServerDetails = GameServerListItem & {
  nodeId: string;
  kind: GameServerKind;
  stackName: string;
  rootPath: string;
  composePath: string;
  configFiles: GameServerConfigFile[];
};

export type WorkerListEntry = {
  name: string;
  type: "dir" | "file" | "symlink" | "other";
  size: number;
};

export type ServerInvite = {
  id: string;
  nodeId: string;
  nodeName: string;
  nodeSlug: string;
  serverId: string;
  serverName: string;
  serverSlug: string;
  inviterMail: string;
  email: string;
  permission: InvitePermission;
  expiresAt: string;
  createdAt: string;
};

export type ServerGuest = {
  nodeId: string;
  nodeName: string;
  nodeSlug: string;
  serverId: string;
  serverName: string;
  serverSlug: string;
  userId: string;
  name?: string | null;
  email: string;
  permission: InvitePermission;
  createdAt: string;
};

export type ConfigRow = {
  id: string;
  key: string;
  value: string;
  keyLocked: boolean;
  valueLocked: boolean;
  custom: boolean;
};

export type ConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "error";

export type ConsoleRefreshMode = "auto" | "manual";

export type ExecMessage = {
  type: string;
  data?: string;
  message?: string;
  cols?: number;
  rows?: number;
  code?: number;
};
