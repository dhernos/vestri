"use client";

import { useCallback, useState } from "react";
import { fetchIncomingNodeInvites } from "@/features/nodes/api";
import type { IncomingNodeInvite } from "@/features/nodes/types";

export const useIncomingNodeInvites = () => {
  const [invites, setInvites] = useState<IncomingNodeInvite[]>([]);
  const [loading, setLoading] = useState(true);

  const loadInvites = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchIncomingNodeInvites();
      if (!result.ok) {
        setInvites([]);
        return false;
      }
      setInvites(result.data);
      return true;
    } catch {
      setInvites([]);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    invites,
    loading,
    loadInvites,
  };
};
