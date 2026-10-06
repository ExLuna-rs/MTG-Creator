"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ScanListChange } from "@/domain/collection/schema";
import type { ScanListItem } from "@/server/collection/scan";

/** Appel à l'API, avec le jeton du téléphone relié s'il y en a un. */
export type ScanApi = (path: string, init?: RequestInit) => Promise<Response>;

/** Intervalle entre deux lectures de la liste, pour suivre l'autre appareil. */
const POLL_MS = 2500;

/**
 * Liste de scan partagée entre le téléphone et l'ordinateur : relue
 * régulièrement (et après chaque modification), pour que les deux appareils
 * voient la même liste.
 */
export function useScanList(
  api: ScanApi,
  {
    enabled = true,
    onUnauthorized,
  }: { enabled?: boolean; onUnauthorized?: () => void } = {},
) {
  const [items, setItems] = useState<ScanListItem[]>([]);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const onUnauthorizedRef = useRef(onUnauthorized);
  onUnauthorizedRef.current = onUnauthorized;

  const refresh = useCallback(async () => {
    try {
      const response = await api("/api/scan/list");
      if (response.status === 401) onUnauthorizedRef.current?.();
      if (!response.ok) return;
      const data: { items: ScanListItem[] } = await response.json();
      setItems(data.items);
    } catch {
      // Réseau indisponible : nouvel essai au prochain tour.
    }
  }, [api]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function poll() {
      if (document.visibilityState === "visible") await refresh();
      if (!cancelled) timer = setTimeout(poll, POLL_MS);
    }
    void poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [enabled, refresh]);

  /** Envoie une modification, puis relit la liste. */
  async function send(
    path: string,
    init: RequestInit,
  ): Promise<Response | null> {
    setError(false);
    setBusy(true);
    try {
      const response = await api(path, init);
      if (response.status === 401) onUnauthorizedRef.current?.();
      else if (!response.ok) setError(true);
      await refresh();
      return response.ok ? response : null;
    } catch {
      setError(true);
      return null;
    } finally {
      setBusy(false);
    }
  }

  return {
    items,
    error,
    busy,
    /** Ajoute un exemplaire ; renvoie la ligne ajoutée, ou null en cas d'échec. */
    async add(oracleId: string): Promise<ScanListItem | null> {
      const response = await send("/api/scan/list", {
        method: "POST",
        body: JSON.stringify({ oracleId }),
      });
      if (!response) return null;
      const { item }: { item: ScanListItem } = await response.json();
      return item;
    },
    async update(id: number, change: ScanListChange) {
      await send(`/api/scan/list/${id}`, {
        method: "PATCH",
        body: JSON.stringify(change),
      });
    },
    async remove(id: number) {
      await send(`/api/scan/list/${id}`, { method: "DELETE" });
    },
    /** Ajoute la liste à la collection ; renvoie le nombre d'exemplaires ajoutés. */
    async commit(): Promise<number | null> {
      const response = await send("/api/scan/list/commit", { method: "POST" });
      if (!response) return null;
      const { added }: { added: number } = await response.json();
      return added;
    },
  };
}

export type ScanList = ReturnType<typeof useScanList>;
