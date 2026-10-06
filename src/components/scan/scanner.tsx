"use client";

import { Check, Undo2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { CardImage } from "@/components/cards/card-image";
import { CardNameInput } from "@/components/cards/card-name-input";
import { Button, buttonVariants } from "@/components/ui/button";
import { scanTokenSchema } from "@/domain/collection/schema";
import {
  type AutoAddState,
  INITIAL_AUTO_ADD,
  nextAutoAdd,
} from "@/domain/scan/auto-add";
import { cleanScannedName } from "@/domain/scan/ocr-name";
import { Link } from "@/i18n/navigation";
import type { ScanMatch, ScannedCard } from "@/server/collection/scan";
import { CameraView } from "./camera-view";

/** Jeton du lien de scan, gardé le temps de l'onglet. */
const TOKEN_KEY = "mtg-creator:scan-token";
/** Intervalle entre deux signes de vie envoyés à l'ordinateur. */
const PING_MS = 30_000;

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
  const [recent, setRecent] = useState<ScannedCard[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");
  const autoAdd = useRef<AutoAddState>(INITIAL_AUTO_ADD);

  const api = useCallback((path: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    if (token.current) headers.set("Authorization", `Bearer ${token.current}`);
    if (init.body) headers.set("Content-Type", "application/json");
    return fetch(path, { ...init, headers });
  }, []);

  // Vérifie le lien (ou la session), puis donne régulièrement signe de vie.
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
          try {
            sessionStorage.removeItem(TOKEN_KEY);
          } catch {}
          setLinkState("expired");
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
    const timer = setInterval(check, PING_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [api, signedIn]);

  async function addCard(oracleId: string) {
    setError(false);
    const response = await api("/api/scan/cards", {
      method: "POST",
      body: JSON.stringify({ oracleId }),
    }).catch(() => null);
    if (!response?.ok) {
      if (response?.status === 401) setLinkState("expired");
      else setError(true);
      return;
    }
    const { card }: { card: ScannedCard } = await response.json();
    setRecent((cards) => [card, ...cards]);
    setChoices([]);
    setMessage(t("added", { name: card.name }));
    navigator.vibrate?.(50);
  }

  async function undo(card: ScannedCard) {
    setError(false);
    const response = await api(`/api/scan/cards/${card.id}`, {
      method: "DELETE",
    }).catch(() => null);
    if (!response?.ok && response?.status !== 404) {
      setError(true);
      return;
    }
    setRecent((cards) => cards.filter((other) => other.id !== card.id));
    setMessage(null);
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
      setLinkState("expired");
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
        {error ? (
          <p className="text-destructive">{t("error")}</p>
        ) : (
          message && (
            <p className="flex items-center gap-1.5 font-medium">
              <Check className="size-4 text-primary" aria-hidden />
              {message}
            </p>
          )
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

      {recent.length > 0 && (
        <section aria-labelledby="scan-recent" className="space-y-2">
          <h2 id="scan-recent" className="font-medium text-sm">
            {t("recent")}
          </h2>
          <ul className="divide-y rounded-md border">
            {recent.map((card) => (
              <li
                key={card.id}
                data-card={card.name}
                className="flex items-center gap-3 px-3 py-2 text-sm"
              >
                <span className="w-8 shrink-0">
                  <CardImage
                    imageUris={card.imageUris}
                    name={card.name}
                    decorative
                    sizes="32px"
                  />
                </span>
                <span className="min-w-0 flex-1 truncate">{card.name}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={t("undoLabel", { name: card.name })}
                  onClick={() => undo(card)}
                >
                  <Undo2 aria-hidden />
                  {t("undo")}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

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
