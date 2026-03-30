"use client";

import { useCallback, useState } from "react";
import { fetchNodes } from "@/features/nodes/api";
import type { WorkerNode } from "@/features/nodes/types";

type UseNodesListOptions = {
  loadErrorMessage: string;
  clearOnError?: boolean;
  initialLoading?: boolean;
};

export const useNodesList = ({
  loadErrorMessage,
  clearOnError = false,
  initialLoading = false,
}: UseNodesListOptions) => {
  const [nodes, setNodes] = useState<WorkerNode[]>([]);
  const [loading, setLoading] = useState(initialLoading);
  const [error, setError] = useState("");

  const loadNodes = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await fetchNodes();
      if (!result.ok) {
        if (clearOnError) {
          setNodes([]);
        }
        setError(result.message || loadErrorMessage);
        return false;
      }
      setNodes(result.data);
      return true;
    } catch {
      if (clearOnError) {
        setNodes([]);
      }
      setError(loadErrorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, [clearOnError, loadErrorMessage]);

  return {
    nodes,
    loading,
    error,
    setError,
    loadNodes,
  };
};
