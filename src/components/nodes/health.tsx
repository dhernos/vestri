"use client";

import { useEffect, useState } from "react";

type HealthState = "green" | "orange" | "red" | "loading";

type HealthBlobProps = {
  nodeRef: string;
};

export default function HealthBlob({ nodeRef }: HealthBlobProps) {
  const [state, setState] = useState<HealthState>("loading");
  const [statusReason, setStatusReason] = useState(
    "Health-Check wird ausgeführt..."
  );

  useEffect(() => {
    if (!nodeRef) {
      setState("red");
      setStatusReason("Worker nicht erreichbar oder fehlerhafte Node-Konfiguration.");
      return;
    }

    const checkHealth = async () => {
      try {
        const res = await fetch(
          `/api/nodes/${encodeURIComponent(nodeRef)}/worker/health`,
          {
            cache: "no-store",
            credentials: "include",
          }
        );

        if (res.status === 200) {
          const data = await res.json();

          if (data.status === "OK" && data.external_service === "OK") {
            setState("green");
            setStatusReason(
              "Alles passt: Worker ist erreichbar und Internetverbindung funktioniert."
            );
          } else {
            setState("orange");
            setStatusReason(
              "Worker ist erreichbar, kann aber keine Internetverbindung aufbauen."
            );
          }

          return;
        }

        setState("red");
        setStatusReason(
          `Worker nicht erreichbar oder anderer Fehler (HTTP ${res.status}).`
        );
      } catch {
        setState("red");
        setStatusReason("Worker nicht erreichbar oder anderer Fehler.");
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 10000); // alle 10s

    return () => clearInterval(interval);
  }, [nodeRef]);

  return (
    <div
      title={statusReason}
      aria-label={statusReason}
      className={`h-4 w-4 rounded-full ${
        state === "green"
          ? "bg-green-500"
          : state === "orange"
            ? "bg-orange-500"
            : state === "red"
              ? "bg-red-500"
              : "bg-gray-400"
      }`}
    />
  );
}
