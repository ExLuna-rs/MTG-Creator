"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DeckSnapshot } from "@/domain/deck/editor";

/** Pause après la dernière modification avant d'enregistrer. */
const SAVE_DELAY_MS = 800;

export type SaveStatus = "saved" | "pending" | "saving" | "error";

/**
 * Sauvegarde automatique : envoie le deck au serveur après chaque série de
 * modifications, une requête à la fois. Revenir (par « Annuler ») à la
 * version enregistrée ne déclenche pas de nouvel envoi.
 */
export function useAutosave(deckId: string, snapshot: DeckSnapshot) {
  const [status, setStatus] = useState<SaveStatus>("saved");
  const latest = useRef(snapshot);
  const saved = useRef(snapshot);
  const inFlight = useRef(false);

  const flush = useCallback(async () => {
    if (inFlight.current) return;
    const toSave = latest.current;
    if (toSave === saved.current) {
      setStatus("saved");
      return;
    }
    inFlight.current = true;
    setStatus("saving");
    try {
      const response = await fetch(`/api/decks/${deckId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toSave),
        // Laisse partir la dernière sauvegarde si la page se ferme.
        keepalive: true,
      });
      if (!response.ok) throw new Error(String(response.status));
      saved.current = toSave;
    } catch {
      inFlight.current = false;
      setStatus("error");
      return;
    }
    inFlight.current = false;
    // Des modifications sont arrivées pendant l'envoi : on recommence.
    if (latest.current !== saved.current) void flush();
    else setStatus("saved");
  }, [deckId]);

  useEffect(() => {
    latest.current = snapshot;
    if (snapshot === saved.current) {
      if (!inFlight.current) setStatus("saved");
      return;
    }
    setStatus((current) => (current === "saving" ? current : "pending"));
    const timer = setTimeout(() => void flush(), SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [snapshot, flush]);

  // Prévient avant de quitter la page avec des modifications non enregistrées.
  useEffect(() => {
    if (status === "saved") return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      void flush();
      event.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [status, flush]);

  return { status, retry: flush };
}
