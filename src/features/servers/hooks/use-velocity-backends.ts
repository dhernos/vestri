"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { TranslateFn } from "@/features/servers/i18n";
import { normalizeFieldOptions, resolveFieldValue } from "@/features/servers/template-version";
import type {
  GameServerDetails,
  GameServerListItem,
  GameServerTemplate,
} from "@/features/servers/types";

type UseVelocityBackendsParams = {
  nodeRef: string;
  server: GameServerDetails | null;
  t: TranslateFn;
};

const filterVelocityTemplates = (templates: GameServerTemplate[]) =>
  templates.filter(
    (template) =>
      template.game?.toLowerCase() === "minecraft" &&
      template.id.toLowerCase() === "minecraft-vanilla"
  );

export const useVelocityBackends = ({ nodeRef, server, t }: UseVelocityBackendsParams) => {
  const [velocityTemplates, setVelocityTemplates] = useState<GameServerTemplate[]>([]);
  const [velocityBackends, setVelocityBackends] = useState<GameServerListItem[]>([]);
  const [velocityLoading, setVelocityLoading] = useState(false);
  const [velocityError, setVelocityError] = useState("");
  const [velocityCreateError, setVelocityCreateError] = useState("");
  const [velocityCreating, setVelocityCreating] = useState(false);
  const [velocityAgreementOpen, setVelocityAgreementOpen] = useState(false);
  const [velocityTemplateId, setVelocityTemplateId] = useState("");
  const [velocityBackendName, setVelocityBackendName] = useState("");
  const [velocityBackendSoftwareVersion, setVelocityBackendSoftwareVersion] = useState("");
  const [velocityBackendGameVersion, setVelocityBackendGameVersion] = useState("");

  const selectedVelocityTemplate = useMemo(
    () => velocityTemplates.find((template) => template.id === velocityTemplateId) || null,
    [velocityTemplateId, velocityTemplates]
  );
  const selectedVelocityAgreement = selectedVelocityTemplate?.agreement;
  const velocitySoftwareField = selectedVelocityTemplate?.versionConfig?.software;
  const velocityGameField = selectedVelocityTemplate?.versionConfig?.game;
  const velocitySoftwareOptions = useMemo(
    () => normalizeFieldOptions(velocitySoftwareField),
    [velocitySoftwareField]
  );
  const velocityGameOptions = useMemo(
    () => normalizeFieldOptions(velocityGameField, velocityBackendSoftwareVersion),
    [velocityBackendSoftwareVersion, velocityGameField]
  );

  const loadVelocityData = useCallback(async () => {
    if (!nodeRef || !server || server.kind !== "velocity") {
      setVelocityTemplates([]);
      setVelocityBackends([]);
      setVelocityTemplateId("");
      setVelocityError("");
      return;
    }

    setVelocityLoading(true);
    setVelocityError("");
    try {
      const [templatesResult, backendsResult] = await Promise.allSettled([
        fetch(`/api/nodes/${encodeURIComponent(nodeRef)}/servers/templates`, {
          credentials: "include",
          cache: "no-store",
        }),
        fetch(
          `/api/nodes/${encodeURIComponent(nodeRef)}/servers?parent=${encodeURIComponent(
            server.id
          )}&includeStatus=1`,
          {
            credentials: "include",
            cache: "no-store",
          }
        ),
      ]);

      const nextErrors: string[] = [];
      let nextTemplates: GameServerTemplate[] = [];
      let nextBackends: GameServerListItem[] = [];

      if (templatesResult.status === "fulfilled") {
        const templatesRes = templatesResult.value;
        const templatesData = (await templatesRes.json().catch(() => ({}))) as {
          templates?: GameServerTemplate[];
          message?: string;
        };
        if (templatesRes.ok) {
          const allTemplates = Array.isArray(templatesData.templates) ? templatesData.templates : [];
          nextTemplates = filterVelocityTemplates(allTemplates);
        } else {
          nextErrors.push(templatesData.message || t("velocity.errors.loadTemplates"));
        }
      } else {
        nextErrors.push(t("velocity.errors.loadTemplates"));
      }

      if (backendsResult.status === "fulfilled") {
        const backendsRes = backendsResult.value;
        const backendsData = (await backendsRes.json().catch(() => ({}))) as {
          servers?: GameServerListItem[];
          message?: string;
        };
        if (backendsRes.ok) {
          nextBackends = Array.isArray(backendsData.servers) ? backendsData.servers : [];
        } else {
          nextErrors.push(backendsData.message || t("velocity.errors.loadBackends"));
        }
      } else {
        nextErrors.push(t("velocity.errors.loadBackends"));
      }

      setVelocityTemplates(nextTemplates);
      setVelocityBackends(nextBackends);

      if (nextTemplates.length === 0) {
        setVelocityTemplateId("");
      } else if (!velocityTemplateId) {
        setVelocityTemplateId(nextTemplates[0].id);
      } else if (!nextTemplates.some((template) => template.id === velocityTemplateId)) {
        setVelocityTemplateId(nextTemplates[0].id);
      }

      if (nextErrors.length > 0) {
        setVelocityError(nextErrors.join(" "));
      }
    } catch {
      setVelocityError(t("velocity.errors.loadData"));
    } finally {
      setVelocityLoading(false);
    }
  }, [nodeRef, server, t, velocityTemplateId]);

  useEffect(() => {
    if (!server || server.kind !== "velocity") {
      setVelocityTemplates([]);
      setVelocityBackends([]);
      setVelocityTemplateId("");
      setVelocityError("");
      setVelocityCreateError("");
      setVelocityAgreementOpen(false);
      return;
    }
    void loadVelocityData();
  }, [loadVelocityData, server]);

  useEffect(() => {
    setVelocityBackendSoftwareVersion((current) =>
      resolveFieldValue(current, velocitySoftwareField)
    );
  }, [velocitySoftwareField]);

  useEffect(() => {
    setVelocityBackendGameVersion((current) =>
      resolveFieldValue(current, velocityGameField, velocityBackendSoftwareVersion)
    );
  }, [velocityBackendSoftwareVersion, velocityGameField]);

  const submitCreateVelocityBackend = useCallback(
    async (agreementAccepted: boolean) => {
      if (!nodeRef || !server || server.kind !== "velocity" || !velocityTemplateId) {
        return;
      }

      setVelocityCreating(true);
      setVelocityCreateError("");
      try {
        const res = await fetch(`/api/nodes/${encodeURIComponent(nodeRef)}/servers`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            templateId: velocityTemplateId,
            name: velocityBackendName.trim(),
            agreementAccepted,
            softwareVersion: velocitySoftwareField ? velocityBackendSoftwareVersion.trim() : "",
            gameVersion: velocityGameField ? velocityBackendGameVersion.trim() : "",
            parentServerRef: server.id,
          }),
        });

        if (!res.ok) {
          setVelocityCreateError(t("velocity.errors.createBackend"));
          return;
        }

        setVelocityBackendName("");
        await loadVelocityData();
      } catch {
        setVelocityCreateError(t("velocity.errors.createBackend"));
      } finally {
        setVelocityCreating(false);
      }
    },
    [
      loadVelocityData,
      nodeRef,
      server,
      t,
      velocityBackendGameVersion,
      velocityBackendName,
      velocityBackendSoftwareVersion,
      velocityGameField,
      velocitySoftwareField,
      velocityTemplateId,
    ]
  );

  const createVelocityBackend = useCallback(async () => {
    if (selectedVelocityAgreement?.required) {
      setVelocityAgreementOpen(true);
      return;
    }
    await submitCreateVelocityBackend(false);
  }, [selectedVelocityAgreement, submitCreateVelocityBackend]);

  const confirmVelocityAgreementAndCreate = useCallback(async () => {
    await submitCreateVelocityBackend(true);
    setVelocityAgreementOpen(false);
  }, [submitCreateVelocityBackend]);

  return {
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
    agreementRequired: Boolean(selectedVelocityAgreement?.required),
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
  };
};
