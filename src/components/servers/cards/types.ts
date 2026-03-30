import type {
  ConfigRow as SharedConfigRow,
  ConnectionStatus as SharedConnectionStatus,
  ConsoleRefreshMode as SharedConsoleRefreshMode,
  GameServerConfigFile as SharedGameServerConfigFile,
  GameServerListItem as SharedGameServerListItem,
  GameServerTemplate as SharedGameServerTemplate,
  GameServerTemplateVersionField as SharedGameServerTemplateVersionField,
  InvitePermission as SharedInvitePermission,
  ServerGuest as SharedServerGuest,
  ServerInvite as SharedServerInvite,
  ServerStatus as SharedServerStatus,
  WorkerListEntry as SharedWorkerListEntry,
} from "@/features/servers/types";

export type ConnectionStatus = SharedConnectionStatus;
export type ConsoleRefreshMode = SharedConsoleRefreshMode;
export type InvitePermission = SharedInvitePermission;
export type ServerStatus = SharedServerStatus;

export type StackActionLoading = "" | "start" | "stop";

export type WorkerListEntry = SharedWorkerListEntry;
export type ConfigRow = SharedConfigRow;

export type GameServerTemplateSummary = Pick<SharedGameServerTemplate, "id" | "name">;

export type VelocityBackendSummary = Pick<
  SharedGameServerListItem,
  "id" | "name" | "slug" | "status" | "connectHost" | "connectPort"
>;

export type GameServerTemplateVersionField = Pick<
  SharedGameServerTemplateVersionField,
  "label" | "placeholder"
>;

export type GameServerConfigFileOption = Pick<
  SharedGameServerConfigFile,
  "id" | "title" | "path"
>;

export type ServerInviteListItem = Pick<
  SharedServerInvite,
  "id" | "email" | "permission" | "inviterMail" | "expiresAt"
>;

export type ServerGuestListItem = Pick<
  SharedServerGuest,
  "userId" | "name" | "email" | "permission" | "createdAt"
>;
