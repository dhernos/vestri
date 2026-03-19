"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import AccessCard from "@/components/servers/cards/access-card";
import ConfigEditorCard from "@/components/servers/cards/config-editor-card";
import FileBrowserCard from "@/components/servers/cards/file-browser-card";
import FileBrowserRestrictedCard from "@/components/servers/cards/file-browser-restricted-card";
import FileEditorCard from "@/components/servers/cards/file-editor-card";
import InteractiveConsoleCard from "@/components/servers/cards/interactive-console-card";
import LogsCard from "@/components/servers/cards/logs-card";
import ServerControlsCard from "@/components/servers/cards/controls-card";
import VelocityCard from "@/components/servers/cards/velocity-card";
import ServerStatusBlob from "@/components/servers/status-blob";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useServerAccess } from "@/features/servers/hooks/use-server-access";
import { useServerConsole } from "@/features/servers/hooks/use-server-console";
import { useServerFiles } from "@/features/servers/hooks/use-server-files";
import { useVelocityBackends } from "@/features/servers/hooks/use-velocity-backends";
import {
  buildServerWorkspacePath,
  normalizeServerWorkspaceSection,
} from "@/features/servers/navigation";
import type {
  GameServerDetails,
  ServerStatus,
} from "@/features/servers/types";
import styles from "./page.module.css";

export default function ServerControlsPage() {
  const t = useTranslations("ServerPage");
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams<{ noderef: string; serverref: string }>();
  const nodeRef = typeof params?.noderef === "string" ? params.noderef : "";
  const serverRef = typeof params?.serverref === "string" ? params.serverref : "";
  const activeSection = useMemo(() => {
    const segments = pathname.split("/").filter(Boolean);
    return normalizeServerWorkspaceSection(segments.at(-1));
  }, [pathname]);
  const isDashboardSection = activeSection === "dashboard";
  const isConfigSection = activeSection === "config";
  const isFilesystemSection = activeSection === "filesystem";
  const isConsoleSection = activeSection === "console";

  const [server, setServer] = useState<GameServerDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [stackActionLoading, setStackActionLoading] = useState<"" | "start" | "stop">("");
  const [stackError, setStackError] = useState("");
  const [serverDeleting, setServerDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const basePath = useMemo(() => {
    if (!nodeRef || !serverRef) {
      return "";
    }
    return `/api/nodes/${encodeURIComponent(nodeRef)}/servers/${encodeURIComponent(serverRef)}`;
  }, [nodeRef, serverRef]);
  const serverId = server?.id || "";
  const isServerUp = server?.status === "up";
  const canReadConsole = Boolean(server?.permissions.canReadConsole);
  const canUseInteractiveConsole = Boolean(server?.permissions.canManage);
  const canManageFiles = Boolean(server?.permissions.canManageFiles);
  const isVelocityServer = server?.kind === "velocity";
  const isVelocityBackendServer = server?.kind === "velocity-backend";
  const statusLabel = useCallback((status: ServerStatus) => t(`status.${status}`), [t]);
  const invitePermissionLabel = useCallback(
    (permission: "admin" | "operator" | "viewer") => t(`access.roles.${permission}`),
    [t]
  );

  const loadServer = useCallback(async () => {
    if (!basePath) {
      setLoading(false);
      setError(t("errors.missingRouteParams"));
      return;
    }

    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${basePath}?includeStatus=1`, {
        credentials: "include",
        cache: "no-store",
      });
      const data = (await res.json().catch(() => ({}))) as {
        server?: GameServerDetails;
        message?: string;
      };
      if (!res.ok || !data.server) {
        setServer(null);
        setError(t("errors.loadServer"));
        return;
      }
      setServer(data.server);
      setStackError("");
    } catch {
      setServer(null);
      setError(t("errors.loadServer"));
    } finally {
      setLoading(false);
    }
  }, [basePath, t]);

  useEffect(() => {
    loadServer();
  }, [loadServer]);

  const {
    velocityTemplateId,
    velocityTemplates,
    velocityBackendName,
    velocitySoftwareField,
    velocitySoftwareOptions,
    velocityBackendSoftwareVersion,
    velocityGameField,
    velocityGameOptions,
    velocityBackendGameVersion,
    velocityCreating,
    velocityLoading,
    velocityError,
    velocityCreateError,
    agreementRequired,
    velocityBackends,
    velocityAgreementOpen,
    selectedVelocityAgreement,
    setVelocityTemplateId,
    setVelocityBackendName,
    setVelocityBackendSoftwareVersion,
    setVelocityBackendGameVersion,
    setVelocityAgreementOpen,
    loadVelocityData,
    createVelocityBackend,
    confirmVelocityAgreementAndCreate,
  } = useVelocityBackends({
    nodeRef,
    server: isDashboardSection ? server : null,
    t,
  });

  const refreshServerStatus = useCallback(async (): Promise<ServerStatus | null> => {
    if (!basePath) {
      return null;
    }
    try {
      const res = await fetch(`${basePath}/status`, {
        credentials: "include",
        cache: "no-store",
      });
      const data = (await res.json().catch(() => ({}))) as {
        status?: ServerStatus;
        output?: string;
        error?: string;
      };
      if (!res.ok) {
        return null;
      }
      const nextStatus = data.status || "unknown";
      setServer((prev) =>
        prev
          ? {
              ...prev,
              status: nextStatus,
              statusOutput: data.output || "",
              statusError: data.error || "",
            }
          : prev
      );
      return nextStatus;
    } catch {
      return null;
    }
  }, [basePath]);

  const {
    browserPath,
    setBrowserPath,
    browserEntries,
    browserLoading,
    browserError,
    browserActionError,
    browserUploadFile,
    setBrowserUploadFile,
    browserUploadInputKey,
    browserUploading,
    browserDownloadingPath,
    browserDeletingPath,
    browserUnzippingPath,
    filePath,
    fileContent,
    setFileContent,
    fileLoading,
    fileSaving,
    fileError,
    selectedConfigFileId,
    setSelectedConfigFileId,
    configContent,
    setConfigContent,
    configRows,
    useKeyValueEditor,
    configLoading,
    configSaving,
    configError,
    hasSelectedConfigFile,
    folderNavigationLockedRef,
    loadBrowserEntries,
    openFile,
    saveFile,
    downloadBrowserPath,
    uploadFileToCurrentFolder,
    deleteBrowserPath,
    unzipArchiveInCurrentFolder,
    saveConfig,
    updateConfigRow,
    addConfigRow,
    removeConfigRow,
    normalizeRelativePath,
    parentRelativePath,
    formatBytes,
    isZipArchiveName,
    markInvalidFileSelection,
  } = useServerFiles({
    basePath,
    canManageFiles: canManageFiles && (isFilesystemSection || isConfigSection),
    configFiles: server?.configFiles || [],
    t,
  });

  const {
    invites,
    invitesLoading,
    revokingInviteId,
    guests,
    guestsLoading,
    removingGuestUserId,
    inviteEmail,
    invitePermission,
    inviteSubmitting,
    inviteError,
    setInviteEmail,
    setInvitePermission,
    createInvite,
    revokeInvite,
    removeGuest,
  } = useServerAccess({
    basePath,
    canManage: canUseInteractiveConsole && isDashboardSection,
    t,
  });

  const {
    consoleOutput,
    consoleStatus,
    consoleError,
    consoleRefreshMode,
    setConsoleRefreshMode,
    consoleSnapshotLoading,
    consoleOutputRef,
    refreshConsoleOutput,
    clearLogOutput,
    canConnectInteractiveConsole,
    execSessionActive,
    execStatus,
    execError,
    terminalHostRef,
    startExecSession,
    stopExecSession,
  } = useServerConsole({
    basePath,
    serverId,
    canReadConsole: canReadConsole && isConsoleSection,
    canUseInteractiveConsole: canUseInteractiveConsole && isConsoleSection,
    isServerUp,
    refreshServerStatus,
    t,
  });


  const runStackAction = async (action: "start" | "stop") => {
    if (!server || !basePath) {
      return;
    }
    if (action === "stop") {
      stopExecSession();
    }
    setStackActionLoading(action);
    setStackError("");
    try {
      const res = await fetch(`${basePath}/${action}`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        setStackError(t(`controls.errors.${action}`));
        return;
      }
      await loadServer();
    } catch {
      setStackError(t(`controls.errors.${action}`));
    } finally {
      setStackActionLoading("");
    }
  };

  const refreshStatus = async () => {
    if (!server || !basePath) {
      return;
    }
    await refreshServerStatus();
  };

  const deleteServer = async () => {
    if (!server || !basePath || serverDeleting) {
      return;
    }
    const confirmed = window.confirm(t("controls.confirmDelete", { name: server.name }));
    if (!confirmed) {
      return;
    }

    setServerDeleting(true);
    setDeleteError("");
    try {
      const res = await fetch(basePath, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        setDeleteError(t("controls.errors.delete"));
        return;
      }
      router.push(`/dashboard?node=${encodeURIComponent(nodeRef)}`);
    } catch {
      setDeleteError(t("controls.errors.delete"));
    } finally {
      setServerDeleting(false);
    }
  };

  if (loading) {
    return <p className="p-6">{t("loading")}</p>;
  }

  if (error || !server) {
    return (
      <div className="container mx-auto space-y-4 p-6">
        <p className="text-red-600">{error || t("errors.notFound")}</p>
        <Button asChild variant="secondary">
          <Link href="/dashboard">{t("buttons.backToDashboard")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="flex items-center gap-3 text-3xl font-bold">
          <ServerStatusBlob status={server.status} size="lg" label={statusLabel(server.status)} />
          <span>{server.name}</span>
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("header.templateLabel")}: {server.templateName || server.templateId} |{" "}
          {t("header.stackLabel")}: {server.stackName}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="secondary">
          <Link href={`/dashboard?node=${encodeURIComponent(nodeRef)}`}>
            {t("buttons.backToDashboard")}
          </Link>
        </Button>
        {isVelocityBackendServer && server.parentServerId ? (
          <Button asChild variant="outline">
            <Link href={buildServerWorkspacePath(nodeRef, server.parentServerId, "dashboard")}>
              {t("buttons.backToProxy")}
            </Link>
          </Button>
        ) : null}
      </div>

      {isDashboardSection ? (
        <>
          <ServerControlsCard
            canControl={server.permissions.canControl}
            canReadConsole={server.permissions.canReadConsole}
            canManage={server.permissions.canManage}
            stackActionLoading={stackActionLoading}
            serverDeleting={serverDeleting}
            stackError={stackError}
            deleteError={deleteError}
            onStart={() => {
              void runStackAction("start");
            }}
            onStop={() => {
              void runStackAction("stop");
            }}
            onRefreshStatus={() => {
              void refreshStatus();
            }}
            onDeleteServer={() => {
              void deleteServer();
            }}
          />

          {isVelocityServer ? (
            <VelocityCard
              nodeRef={nodeRef}
              velocityTemplateId={velocityTemplateId}
              velocityTemplates={velocityTemplates}
              velocityBackendName={velocityBackendName}
              velocitySoftwareField={velocitySoftwareField}
              velocitySoftwareOptions={velocitySoftwareOptions}
              velocityBackendSoftwareVersion={velocityBackendSoftwareVersion}
              velocityGameField={velocityGameField}
              velocityGameOptions={velocityGameOptions}
              velocityBackendGameVersion={velocityBackendGameVersion}
              velocityCreating={velocityCreating}
              velocityLoading={velocityLoading}
              velocityError={velocityError}
              velocityCreateError={velocityCreateError}
              agreementRequired={agreementRequired}
              velocityBackends={velocityBackends}
              onTemplateIdChange={setVelocityTemplateId}
              onBackendNameChange={setVelocityBackendName}
              onBackendSoftwareVersionChange={setVelocityBackendSoftwareVersion}
              onBackendGameVersionChange={setVelocityBackendGameVersion}
              onCreateVelocityBackend={() => {
                void createVelocityBackend();
              }}
              onRefreshVelocityData={() => {
                void loadVelocityData();
              }}
              statusLabel={statusLabel}
            />
          ) : null}
        </>
      ) : null}

      {isConsoleSection ? (
        <>
          <LogsCard
            consoleRefreshMode={consoleRefreshMode}
            canReadConsole={canReadConsole}
            consoleSnapshotLoading={consoleSnapshotLoading}
            consoleOutput={consoleOutput}
            consoleStatus={consoleStatus}
            isServerUp={isServerUp}
            consoleError={consoleError}
            consoleOutputRef={consoleOutputRef}
            onSetRefreshMode={setConsoleRefreshMode}
            onRefreshNow={() => {
              void refreshConsoleOutput();
            }}
            onClearOutput={clearLogOutput}
          />

          {canUseInteractiveConsole ? (
            <InteractiveConsoleCard
              canConnectInteractiveConsole={canConnectInteractiveConsole}
              execSessionActive={execSessionActive}
              execStatus={execStatus}
              isServerUp={isServerUp}
              execError={execError}
              terminalHostRef={terminalHostRef}
              terminalScopeClassName={styles.terminalScope}
              onStartSession={() => {
                void startExecSession();
              }}
              onStopSession={stopExecSession}
            />
          ) : null}
        </>
      ) : null}

      {isFilesystemSection ? (
        <>
          {server.permissions.canManageFiles ? (
            <div className="grid gap-6 lg:grid-cols-2">
              <FileBrowserCard
                browserPath={browserPath}
                browserLoading={browserLoading}
                browserUploadInputKey={browserUploadInputKey}
                browserUploadFile={browserUploadFile}
                browserUploading={browserUploading}
                browserError={browserError}
                browserActionError={browserActionError}
                browserEntries={browserEntries}
                browserDownloadingPath={browserDownloadingPath}
                browserDeletingPath={browserDeletingPath}
                browserUnzippingPath={browserUnzippingPath}
                folderNavigationLockedRef={folderNavigationLockedRef}
                normalizeRelativePath={normalizeRelativePath}
                formatBytes={formatBytes}
                isZipArchiveName={isZipArchiveName}
                onRefresh={() => {
                  void loadBrowserEntries();
                }}
                onGoUp={() => setBrowserPath(parentRelativePath(browserPath))}
                onGoRoot={() => setBrowserPath("")}
                onSelectUploadFile={setBrowserUploadFile}
                onUploadToCurrentFolder={() => {
                  void uploadFileToCurrentFolder();
                }}
                onNavigateDirectory={setBrowserPath}
                onOpenFile={(relativePath) => {
                  void openFile(relativePath);
                }}
                onInvalidFileSelection={markInvalidFileSelection}
                onDownload={(relativePath, entryType) => {
                  void downloadBrowserPath(relativePath, entryType);
                }}
                onUnzip={(relativePath) => {
                  void unzipArchiveInCurrentFolder(relativePath);
                }}
                onDelete={(relativePath, entryType) => {
                  void deleteBrowserPath(relativePath, entryType);
                }}
              />

              <FileEditorCard
                filePath={filePath}
                fileContent={fileContent}
                fileLoading={fileLoading}
                fileSaving={fileSaving}
                fileError={fileError}
                onFileContentChange={setFileContent}
                onSaveFile={() => {
                  void saveFile();
                }}
                onReloadFile={() => {
                  void openFile(filePath);
                }}
              />
            </div>
          ) : (
            <FileBrowserRestrictedCard />
          )}
        </>
      ) : null}

      {isConfigSection ? (
        <>
          {server.permissions.canManageFiles ? (
            <ConfigEditorCard
              configFiles={server.configFiles}
              selectedConfigFileId={selectedConfigFileId}
              useKeyValueEditor={useKeyValueEditor}
              configRows={configRows}
              configLoading={configLoading}
              configSaving={configSaving}
              configContent={configContent}
              hasSelectedConfigFile={hasSelectedConfigFile}
              configError={configError}
              onSelectConfigFile={setSelectedConfigFileId}
              onUpdateConfigRow={updateConfigRow}
              onRemoveConfigRow={removeConfigRow}
              onAddConfigRow={addConfigRow}
              onConfigContentChange={setConfigContent}
              onSaveConfig={() => {
                void saveConfig();
              }}
            />
          ) : (
            <FileBrowserRestrictedCard />
          )}
        </>
      ) : null}

      {isDashboardSection && server.permissions.canManage ? (
        <AccessCard
          inviteEmail={inviteEmail}
          invitePermission={invitePermission}
          inviteSubmitting={inviteSubmitting}
          inviteError={inviteError}
          invitesLoading={invitesLoading}
          invites={invites}
          revokingInviteId={revokingInviteId}
          guestsLoading={guestsLoading}
          guests={guests}
          removingGuestUserId={removingGuestUserId}
          invitePermissionLabel={invitePermissionLabel}
          onInviteEmailChange={setInviteEmail}
          onInvitePermissionChange={setInvitePermission}
          onCreateInvite={() => {
            void createInvite();
          }}
          onRevokeInvite={(inviteId) => {
            void revokeInvite(inviteId);
          }}
          onRemoveGuest={(userId) => {
            void removeGuest(userId);
          }}
        />
      ) : null}

      {isDashboardSection ? (
        <Dialog open={velocityAgreementOpen} onOpenChange={setVelocityAgreementOpen}>
          <DialogContent showCloseButton={false}>
            <DialogHeader>
              <DialogTitle>
                {selectedVelocityAgreement?.title || t("velocity.dialog.title")}
              </DialogTitle>
              <DialogDescription>
                {selectedVelocityAgreement?.text ||
                  t("velocity.dialog.description")}
              </DialogDescription>
            </DialogHeader>
            {selectedVelocityAgreement?.linkUrl ? (
              <a
                href={selectedVelocityAgreement.linkUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="text-sm text-blue-600 underline"
              >
                {selectedVelocityAgreement.linkText || selectedVelocityAgreement.linkUrl}
              </a>
            ) : null}
            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setVelocityAgreementOpen(false)}
                disabled={velocityCreating}
              >
                {t("velocity.dialog.cancel")}
              </Button>
              <Button
                type="button"
                onClick={confirmVelocityAgreementAndCreate}
                disabled={velocityCreating}
              >
                {velocityCreating
                  ? t("velocity.buttons.creating")
                  : t("velocity.dialog.agreeAndCreate")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
