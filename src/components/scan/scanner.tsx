"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { CardImage } from "@/components/cards/card-image";
import { CardNameInput } from "@/components/cards/card-name-input";
import { buttonVariants } from "@/components/ui/button";
import { scanTokenSchema } from "@/domain/collection/schema";
import {
  type AutoAddState,
  INITIAL_AUTO_ADD,
  nextAutoAdd,
} from "@/domain/scan/auto-add";
import { cleanScannedName } from "@/domain/scan/ocr-name";
import { Link } from "@/i18n/navigation";
import type { ScanMatch } from "@/server/collection/scan";
import { CameraView } from "./camera-view";
import { ScanListView } from "./scan-list-view";
import { useScanList } from "./use-scan-list";

/** Jeton du lien de scan, gardé le temps de l'onglet. */
const TOKEN_KEY = "mtg-creator:scan-token";

type LinkState = "checking" | "ready" | "expired" | "none";

/**
 * Lit le jeton du lien de scan dans le fragment de l'adresse (#…), le garde
 * pour l'onglet, puis l'efface de l'adresse affichée.
 */
function takeToken(): string | null {
  const fromHash = window.location.hash.slice(1);
  try {
    if (scanTokenSchema.safeParse(fromHash).success) {
      sessionStorage.setItem(TOKEN_KEY, fromHash);
      window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search,
      );
      return fromHash;
    }
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    // Stockage indisponible (navigation privée) : le jeton de l'adresse suffit.
    return scanTokenSchema.safeParse(fromHash).success ? fromHash : null;
  }
}

/**
 * Page de scan sur le téléphone : la caméra lit le nom des cartes, qui sont
 * ajoutées à la collection de l'utilisateur connecté, ou de celui dont
 * l'ordinateur a affiché le QR code.
 */
export function Scanner({ signedIn }: { signedIn: boolean }) {
  const t = useTranslations("Scanner");
  const searchId = useId();
  const token = useRef<string | null>(null);
  const [linkState, setLinkState] = useState<LinkState>("checking");
  const [owner, setOwner] = useState<{ name: string; linked: boolean } | null>(
    null,
  );
  const [reading, setReading] = useState("");
  const [choices, setChoices] = useState<ScanMatch[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const autoAdd = useRef<AutoAddState>(INITIAL_AUTO_ADD);

  const api = useCallback((path: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    if (token.current) headers.set("Authorization", `Bearer ${token.current}`);
    if (init.body) headers.set("Content-Type", "application/json");
    return fetch(path, { ...init, headers });
  }, []);

  const expire = useCallback(() => {
    try {
      sessionStorage.removeItem(TOKEN_KEY);
    } catch {}
    setLinkState("expired");
  }, []);
  // La liste, relue régulièrement, sert aussi de signe de vie pour l'ordinateur.
  const list = useScanList(api, {
    enabled: linkState === "ready",
    onUnauthorized: expire,
  });

  // Vérifie le lien (ou la session).
  useEffect(() => {
    token.current = takeToken();
    if (!token.current && !signedIn) {
      setLinkState("none");
      return;
    }
    let cancelled = false;
    async function check() {
      try {
        const response = await api("/api/scan/me");
        if (cancelled) return;
        if (response.status === 401) {
          expire();
          return;
        }
        if (response.ok) {
          setOwner(await response.json());
          setLinkState("ready");
        }
      } catch {
        // Réseau indisponible : nouvel essai au prochain signe de vie.
      }
    }
    void check();
    return () => {
      cancelled = true;
    };
  }, [api, signedIn, expire]);

  async function addCard(oracleId: string) {
    const item = await list.add(oracleId);
    if (!item) return;
    setChoices([]);
    setMessage(t("added", { name: item.name }));
    navigator.vibrate?.(50);
  }

  async function onReading(text: string) {
    const name = cleanScannedName(text);
    setReading(name);
    if (!name) {
      autoAdd.current = nextAutoAdd(autoAdd.current, null).state;
      return;
    }
    const response = await api("/api/scan/match", {
      method: "POST",
      body: JSON.stringify({ text: name }),
    });
    if (response.status === 401) {
      expire();
      return;
    }
    if (!response.ok) return;
    const {
      candidates,
      match,
    }: { candidates: ScanMatch[]; match: string | null } =
      await response.json();
    const next = nextAutoAdd(autoAdd.current, match);
    autoAdd.current = next.state;
    if (next.add) await addCard(next.add);
    else if (!match && candidates.length > 0) setChoices(candidates);
  }

  if (linkState === "none" || linkState === "expired") {
    return (
      <div className="space-y-4">
        <p role="alert">
          {linkState === "expired" ? t("expired") : t("needLink")}
        </p>
        {!signedIn && (
          <Link
            href={{ pathname: "/sign-in", query: { next: "/scan" } }}
            className={buttonVariants()}
          >
            {t("signIn")}
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {owner && (
        <p className="text-muted-foreground text-sm">
          {owner.linked ? t("linked", { name: owner.name }) : t("signedIn")}
        </p>
      )}

      <CameraView onReading={onReading} />

      <div role="status" className="min-h-6 space-y-1 text-sm">
        {message && (
          <p className="flex items-center gap-1.5 font-medium">
            <Check className="size-4 text-primary" aria-hidden />
            {message}
          </p>
        )}
        {reading && (
          <p className="truncate text-muted-foreground">
            {t("reading", { text: reading })}
          </p>
        )}
      </div>

      {choices.length > 0 && (
        <section aria-labelledby="scan-choices" className="space-y-2">
          <h2 id="scan-choices" className="font-medium text-sm">
            {t("choose")}
          </h2>
          <ul className="grid grid-cols-3 gap-2">
            {choices.map((card) => (
              <li key={card.oracleId}>
                <button
                  type="button"
                  aria-label={t("add", { name: card.name })}
                  onClick={() => addCard(card.oracleId)}
                  className="w-full space-y-1 rounded-md text-left text-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <CardImage
                    imageUris={card.imageUris}
                    name={card.name}
                    decorative
                    sizes="33vw"
                  />
                  <span className="line-clamp-2">{card.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="space-y-2">
        <label htmlFor={searchId} className="font-medium text-sm">
          {t("searchLabel")}
        </label>
        <CardNameInput
          id={searchId}
          name="name"
          value={search}
          onValueChange={setSearch}
          placeholder={t("searchPlaceholder")}
          suggestionsLabel={t("searchLabel")}
          onSelect={async (suggestion) => {
            setSearch("");
            await addCard(suggestion.oracleId);
          }}
        />
      </div>

      <ScanListView
        list={list}
        onCommitted={() => {
          setMessage(null);
          setChoices([]);
        }}
      />

      {signedIn && (
        <Link
          href="/collection"
          className={buttonVariants({ variant: "link", className: "px-0" })}
        >
          {t("collection")}
        </Link>
      )}
    </div>
  );
}
