"use client";

import { Check, ListChecks, Undo2, X } from "lucide-react";
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
import type { ScanListItem, ScanMatch } from "@/server/collection/scan";
import { CameraView } from "./camera-view";
import type { Reading } from "./name-reader";
import { ScanListView } from "./scan-list-view";
import { useScanList } from "./use-scan-list";

/** Durée d'affichage de la dernière carte ajoutée sur la caméra. */
const TOAST_MS = 5000;
/** Durée pendant laquelle le cadre reste vert après un ajout. */
const FLASH_MS = 700;

/** Réponse de /api/scan/match pour un texte lu. */
interface MatchResult {
  candidates: ScanMatch[];
  match: string | null;
}

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
  const token = useRef<string | null>(null);
  const [linkState, setLinkState] = useState<LinkState>("checking");
  const [owner, setOwner] = useState<{ name: string; linked: boolean } | null>(
    null,
  );
  const [reading, setReading] = useState("");
  const [choices, setChoices] = useState<ScanMatch[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const autoAdd = useRef<AutoAddState>(INITIAL_AUTO_ADD);
  // Un même texte lu plusieurs fois n'est envoyé qu'une fois au serveur.
  const matches = useRef(new Map<string, MatchResult>());
  const [cameraActive, setCameraActive] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [lastAdded, setLastAdded] = useState<ScanListItem | null>(null);
  const [flash, setFlash] = useState(false);
  const listDialog = useRef<HTMLDialogElement>(null);

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

  // La dernière carte ajoutée reste affichée quelques secondes sur la caméra.
  useEffect(() => {
    if (!lastAdded) return;
    const timer = setTimeout(() => setLastAdded(null), TOAST_MS);
    return () => clearTimeout(timer);
  }, [lastAdded]);

  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(false), FLASH_MS);
    return () => clearTimeout(timer);
  }, [flash]);

  async function addCard(oracleId: string) {
    const item = await list.add(oracleId);
    if (!item) return;
    setChoices([]);
    setMessage(t("added", { name: item.name }));
    setLastAdded(item);
    setFlash(true);
    navigator.vibrate?.(50);
  }

  /** Annule le dernier ajout : un exemplaire de moins (la ligne part à zéro). */
  async function undo(item: ScanListItem) {
    setLastAdded(null);
    const current = list.items.find((row) => row.id === item.id) ?? item;
    await list.update(item.id, { quantity: current.quantity - 1 });
    setMessage(t("undone", { name: item.name }));
  }

  async function match(name: string): Promise<MatchResult | null> {
    const cached = matches.current.get(name);
    if (cached) return cached;
    const response = await api("/api/scan/match", {
      method: "POST",
      body: JSON.stringify({ text: name }),
    });
    if (response.status === 401) {
      expire();
      return null;
    }
    if (!response.ok) return null;
    const result: MatchResult = await response.json();
    matches.current.set(name, result);
    return result;
  }

  async function onReading(reading: Reading) {
    const name =
      reading.verdict === "read" ? cleanScannedName(reading.text) : "";
    if (reading.verdict === "read") setReading(name);
    if (!name) {
      // Plus de carte lisible : l'ajout est réarmé.
      autoAdd.current = nextAutoAdd(autoAdd.current, null).state;
      return;
    }
    const result = await match(name);
    if (!result) return;
    const best = result.candidates.find(
      (card) => card.oracleId === result.match,
    );
    const next = nextAutoAdd(autoAdd.current, result.match, best?.similarity);
    autoAdd.current = next.state;
    if (next.add) await addCard(next.add);
    else if (!result.match && result.candidates.length > 0) {
      setChoices(result.candidates);
    }
  }

  function openList() {
    setListOpen(true);
    listDialog.current?.showModal();
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

  const total = list.items.reduce((sum, item) => sum + item.quantity, 0);
  const ownerText =
    owner && (owner.linked ? t("linked", { name: owner.name }) : t("signedIn"));

  const choicesView = choices.length > 0 && (
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
  );

  // Sur la caméra : dernière carte ajoutée, sinon choix, sinon consigne.
  const overlay = (
    <div role="status" aria-live="polite">
      {lastAdded ? (
        <div className="mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-neutral-900/90 p-2.5 pr-3 shadow-xl backdrop-blur">
          <span className="w-16 shrink-0">
            <CardImage
              imageUris={lastAdded.imageUris}
              name={lastAdded.name}
              decorative
              sizes="64px"
            />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1 text-green-400 text-xs">
              <Check className="size-3.5" aria-hidden />
              {t("addedShort")}
            </span>
            <span className="line-clamp-2 font-semibold">{lastAdded.name}</span>
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => undo(lastAdded)}
            aria-label={t("undo", { name: lastAdded.name })}
          >
            <Undo2 aria-hidden />
            {t("undoShort")}
          </Button>
        </div>
      ) : choices.length > 0 ? (
        <div className="mx-auto max-w-md rounded-2xl bg-neutral-900/90 p-3 backdrop-blur">
          {choicesView}
        </div>
      ) : (
        <p className="mx-auto w-fit max-w-full truncate rounded-full bg-neutral-900/80 px-4 py-2 text-sm text-white/90">
          {reading ? t("reading", { text: reading }) : t("aim")}
        </p>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {ownerText && (
        <p className="text-muted-foreground text-sm">{ownerText}</p>
      )}

      <CameraView
        onReading={onReading}
        onActiveChange={setCameraActive}
        paused={listOpen}
        recognized={flash}
        actions={
          <Button
            variant="ghost"
            size="icon"
            className="relative size-11 rounded-full text-white hover:bg-white/15 hover:text-white"
            onClick={openList}
            aria-label={t("openList", { count: total })}
          >
            <ListChecks aria-hidden className="size-6" />
            {total > 0 && (
              <span
                aria-hidden
                className="absolute -right-0.5 -bottom-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-400 px-1 font-semibold text-black text-xs tabular-nums"
              >
                {total}
              </span>
            )}
          </Button>
        }
        overlay={overlay}
      />

      {!cameraActive && (
        <>
          <div role="status" className="min-h-6 space-y-1 text-sm">
            {message && (
              <p className="flex items-center gap-1.5 font-medium">
                <Check className="size-4 text-primary" aria-hidden />
                {message}
              </p>
            )}
          </div>

          {choicesView}

          <AddByName onSelect={addCard} />

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
        </>
      )}

      {/* Liste de scan par-dessus la caméra : la lecture est suspendue. */}
      <dialog
        ref={listDialog}
        aria-labelledby="scan-list-title"
        onClose={() => setListOpen(false)}
        className="mx-auto mt-auto mb-0 max-h-[88dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-background p-0 text-foreground shadow-xl backdrop:bg-black/60"
      >
        {listOpen && (
          <div className="space-y-5 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="relative flex justify-end">
              <span
                aria-hidden
                className="absolute top-0 left-1/2 h-1.5 w-12 -translate-x-1/2 rounded-full bg-muted-foreground/30"
              />
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("closeList")}
                onClick={() => listDialog.current?.close()}
              >
                <X aria-hidden />
              </Button>
            </div>
            <ScanListView
              list={list}
              onCommitted={() => {
                setMessage(null);
                setChoices([]);
                setLastAdded(null);
              }}
            />
            <AddByName onSelect={addCard} />
          </div>
        )}
      </dialog>
    </div>
  );
}

/** Ajout d'une carte par son nom, quand la caméra ne la lit pas. */
function AddByName({ onSelect }: { onSelect: (oracleId: string) => void }) {
  const t = useTranslations("Scanner");
  const searchId = useId();
  const [search, setSearch] = useState("");
  return (
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
        onSelect={(suggestion) => {
          setSearch("");
          onSelect(suggestion.oracleId);
        }}
      />
    </div>
  );
}
