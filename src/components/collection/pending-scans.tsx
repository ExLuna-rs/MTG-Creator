"use client";

import { ScanListView } from "@/components/scan/scan-list-view";
import { useScanList } from "@/components/scan/use-scan-list";
import { useRouter } from "@/i18n/navigation";

const api = (path: string, init: RequestInit = {}) =>
  fetch(path, {
    ...init,
    headers: init.body ? { "Content-Type": "application/json" } : undefined,
  });

/**
 * Liste de scan sur la page de la collection : les cartes scannées par le
 * téléphone y arrivent en direct, modifiables, avant d'être ajoutées à la
 * collection. Avec `always`, la liste vide est aussi affichée.
 */
export function PendingScans({ always = false }: { always?: boolean }) {
  const router = useRouter();
  const list = useScanList(api);
  if (!always && list.items.length === 0 && !list.error) return null;
  return (
    <div className="rounded-xl border bg-card p-4 text-card-foreground">
      <ScanListView list={list} onCommitted={() => router.refresh()} />
    </div>
  );
}
