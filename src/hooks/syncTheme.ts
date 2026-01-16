// src/hooks/useSyncUserTheme.ts
"use client";

import { useTheme } from "next-themes";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";

/**
 * Synchronisiert das in der NextAuth Session gespeicherte Theme
 * mit dem next-themes Provider.
 */
export function useSyncUserTheme() {
  // Ruft Session-Daten ab
  const { data: session, status } = useAuth();
  // Ruft next-themes-Funktionalität ab
  const { theme: currentClientTheme, setTheme: setClientTheme } = useTheme();

  // Der Theme-Wert aus der Datenbank/Session
  const userTheme = session?.user?.theme;

  useEffect(() => {
    // 1. Nur ausführen, wenn der Benutzer authentifiziert ist und das Theme bekannt ist.
    if (status === "authenticated" && userTheme) {
      // 2. Führe die Aktualisierung nur aus, wenn das aktuelle Client-Theme
      //    nicht mit dem Theme aus der Session übereinstimmt.
      if (currentClientTheme !== userTheme) {
        console.log(
          `Syncing theme: Client ${currentClientTheme} -> Session ${userTheme}`
        );
        setClientTheme(userTheme);
      }
    }

    // Abhängigkeiten: Status ändert sich nach dem Login, userTheme ist der Wert,
    // der geladen werden muss, setClientTheme ist stabil, currentClientTheme muss
    // beobachtet werden, falls der Benutzer manuell wechselt.
  }, [status, userTheme, setClientTheme, currentClientTheme]);
}
