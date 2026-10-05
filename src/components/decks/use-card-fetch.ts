"use client";

import { useEffect, useState } from "react";

const DEBOUNCE_MS = 200;

/**
 * Charge du JSON depuis `url` après une courte pause (saisie au clavier), en
 * annulant la requête précédente. `url` null : rien à charger.
 */
export function useDebouncedJson<T>(url: string | null): {
  data: T | null;
  loading: boolean;
  error: boolean;
} {
  const [state, setState] = useState<{
    url: string | null;
    data: T | null;
    error: boolean;
  }>({ url: null, data: null, error: false });

  useEffect(() => {
    if (url === null) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error(String(response.status));
        const data = (await response.json()) as T;
        setState({ url, data, error: false });
      } catch {
        if (!controller.signal.aborted) {
          setState((previous) => ({ ...previous, url, error: true }));
        }
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [url]);

  return {
    data: url === null ? null : state.data,
    loading: url !== null && state.url !== url,
    error: url !== null && state.url === url && state.error,
  };
}
