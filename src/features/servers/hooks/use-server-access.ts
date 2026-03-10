"use client";

import { useCallback, useEffect, useState } from "react";
import type { TranslateFn } from "@/features/servers/i18n";
import type { InvitePermission, ServerGuest, ServerInvite } from "@/features/servers/types";

type UseServerAccessParams = {
  basePath: string;
  canManage: boolean;
  t: TranslateFn;
};

export const useServerAccess = ({ basePath, canManage, t }: UseServerAccessParams) => {
  const [invites, setInvites] = useState<ServerInvite[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(false);
  const [revokingInviteId, setRevokingInviteId] = useState("");
  const [guests, setGuests] = useState<ServerGuest[]>([]);
  const [guestsLoading, setGuestsLoading] = useState(false);
  const [removingGuestUserId, setRemovingGuestUserId] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePermission, setInvitePermission] = useState<InvitePermission>("operator");
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [inviteError, setInviteError] = useState("");

  const loadInvites = useCallback(async () => {
    if (!canManage || !basePath) {
      setInvites([]);
      return;
    }

    setInvitesLoading(true);
    setInviteError("");
    try {
      const res = await fetch(`${basePath}/invites`, {
        credentials: "include",
        cache: "no-store",
      });
      const data = (await res.json().catch(() => ({}))) as {
        invites?: ServerInvite[];
      };
      if (!res.ok) {
        setInvites([]);
        return;
      }
      setInvites(Array.isArray(data.invites) ? data.invites : []);
    } catch {
      setInvites([]);
    } finally {
      setInvitesLoading(false);
    }
  }, [basePath, canManage]);

  const loadGuests = useCallback(async () => {
    if (!canManage || !basePath) {
      setGuests([]);
      return;
    }

    setGuestsLoading(true);
    try {
      const res = await fetch(`${basePath}/guests`, {
        credentials: "include",
        cache: "no-store",
      });
      const data = (await res.json().catch(() => ({}))) as {
        guests?: ServerGuest[];
      };
      if (!res.ok) {
        setGuests([]);
        return;
      }
      setGuests(Array.isArray(data.guests) ? data.guests : []);
    } catch {
      setGuests([]);
    } finally {
      setGuestsLoading(false);
    }
  }, [basePath, canManage]);

  useEffect(() => {
    if (!canManage) {
      setInvites([]);
      setGuests([]);
      return;
    }
    void loadInvites();
    void loadGuests();
  }, [canManage, loadGuests, loadInvites]);

  const createInvite = async () => {
    if (!canManage || !basePath || inviteSubmitting) {
      return;
    }

    setInviteSubmitting(true);
    setInviteError("");
    try {
      const res = await fetch(`${basePath}/invites`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          permission: invitePermission,
        }),
      });
      if (!res.ok) {
        setInviteError(t("access.errors.createInvite"));
        return;
      }
      setInviteEmail("");
      await Promise.all([loadInvites(), loadGuests()]);
    } catch {
      setInviteError(t("access.errors.createInvite"));
    } finally {
      setInviteSubmitting(false);
    }
  };

  const revokeInvite = async (inviteId: string) => {
    if (!basePath) {
      return;
    }
    setRevokingInviteId(inviteId);
    try {
      const res = await fetch(`${basePath}/invites/${encodeURIComponent(inviteId)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        return;
      }
      await loadInvites();
    } finally {
      setRevokingInviteId("");
    }
  };

  const removeGuest = async (guestUserId: string) => {
    if (!basePath) {
      return;
    }
    setRemovingGuestUserId(guestUserId);
    try {
      const res = await fetch(`${basePath}/guests/${encodeURIComponent(guestUserId)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        return;
      }
      await loadGuests();
    } finally {
      setRemovingGuestUserId("");
    }
  };

  return {
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
  };
};
