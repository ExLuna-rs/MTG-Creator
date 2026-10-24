"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import { ManaSymbol } from "@/components/cards/mana-text";
import { COLORS, type Color } from "@/domain/cards/colors";
import type { DeckStatus } from "@/domain/collection/ownership";
import {
  DECK_SORTS,
  DECK_VALIDITIES,
  type DeckFolderView,
  type DeckSort,
  type DeckValidity,
  deckListQueryToParams,
} from "@/domain/deck/deck-list";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { FolderItem, FolderViewKey } from "./deck-organizer";

const DEBOUNCE_MS = 250;

const selectClassName =
  "h-10 rounded-md border border-input bg-background px-3 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:text-sm";

/** Ce que les réglages lisent et écrivent dans l'adresse de la page. */
export interface DeckListSettings {
  folder: FolderViewKey;
  q: string;
  colors: Color[];
  status: DeckStatus | null;
  validity: DeckValidity | null;
  sort: DeckSort;
}

function toQuery(settings: DeckListSettings): Record<string, string> {
  const { folder } = settings;
  const view: DeckFolderView =
    folder === "all"
      ? "all"
      : folder === "favorites"
        ? "favorites"
        : folder === "none"
          ? "none"
          : { id: folder };
  return deckListQueryToParams({ ...settings, folder: view });
}

/**
 * Recherche, couleurs, validité et tri de « Mes decks », gardés dans
 * l'adresse de la page. Sur téléphone, le dossier se choisit ici aussi.
 */
export function DeckListControls({
  settings,
  folders,
  counts,
}: {
  settings: DeckListSettings;
  folders: readonly FolderItem[];
  counts: { all: number; favorites: number; none: number };
}) {
  const t = useTranslations("DecksPage");
  const tColors = useTranslations("Colors");
  const router = useRouter();
  const id = useId();
  const [value, setValue] = useState(settings.q);
  // Recherche changée hors du champ (lien, retour arrière) : le champ suit.
  const [shownQuery, setShownQuery] = useState(settings.q);
  if (settings.q !== shownQuery) {
    setShownQuery(settings.q);
    if (settings.q !== value.trim()) setValue(settings.q);
  }

  // Couleurs cochées tout de suite, sans attendre la page rechargée : deux
  // clics rapprochés partent chacun de l'état laissé par le précédent.
  const [colors, setColors] = useState(settings.colors);
  const colorKey = settings.colors.join("");
  const [shownColors, setShownColors] = useState(colorKey);
  if (colorKey !== shownColors) {
    setShownColors(colorKey);
    setColors(settings.colors);
  }

  // Réglages demandés en dernier : un réglage changé avant que la page
  // rechargée n'arrive part de ceux-là, pas de ceux encore affichés.
  const latest = useRef(settings);
  const settingsKey = JSON.stringify(settings);
  // biome-ignore lint/correctness/useExhaustiveDependencies: settingsKey résume settings
  useEffect(() => {
    latest.current = settings;
  }, [settingsKey]);

  function go(next: Partial<DeckListSettings>) {
    latest.current = { ...latest.current, ...next };
    router.replace(
      { pathname: "/decks", query: toQuery(latest.current) },
      { scroll: false },
    );
  }

  // Recherche après une courte pause de frappe.
  useEffect(() => {
    if (value.trim() === settings.q) return;
    const timer = setTimeout(() => go({ q: value }), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  });

  return (
    <div className="space-y-3">
      <div className="space-y-1 md:hidden">
        <label htmlFor={`${id}-folder`} className="font-medium text-sm">
          {t("folderLabel")}
        </label>
        <select
          id={`${id}-folder`}
          value={settings.folder}
          onChange={(event) => go({ folder: event.target.value })}
          className={cn(selectClassName, "block w-full")}
        >
          <option value="all">
            {t("allDecks")} ({counts.all})
          </option>
          <option value="favorites">
            {t("favorites")} ({counts.favorites})
          </option>
          {folders.map((folder) => (
            <option key={folder.id} value={folder.id}>
              {folder.name} ({folder.count})
            </option>
          ))}
          <option value="none">
            {t("noFolder")} ({counts.none})
          </option>
        </select>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-48 flex-1 space-y-1">
          <label htmlFor={`${id}-q`} className="font-medium text-sm">
            {t("search")}
          </label>
          <input
            id={`${id}-q`}
            type="search"
            value={value}
            maxLength={100}
            placeholder={t("searchPlaceholder")}
            onChange={(event) => setValue(event.target.value)}
            className={cn(selectClassName, "block w-full")}
          />
        </div>
        <fieldset className="space-y-1">
          <legend className="mb-1 font-medium text-sm">{t("colors")}</legend>
          <div className="flex h-10 items-center gap-1">
            {COLORS.map((color) => {
              const pressed = colors.includes(color);
              return (
                <button
                  key={color}
                  type="button"
                  aria-pressed={pressed}
                  aria-label={t("colorToggle", { color: tColors(color) })}
                  title={t("colorToggle", { color: tColors(color) })}
                  onClick={() => {
                    const next = pressed
                      ? colors.filter((item) => item !== color)
                      : COLORS.filter(
                          (item) => item === color || colors.includes(item),
                        );
                    setColors(next);
                    go({ colors: next });
                  }}
                  className={cn(
                    "grid size-9 place-items-center rounded-full border-2 border-transparent outline-none transition-[opacity,border-color] focus-visible:ring-[3px] focus-visible:ring-ring/50",
                    pressed
                      ? "border-primary"
                      : colors.length > 0 && "opacity-50",
                  )}
                >
                  <span aria-hidden>
                    <ManaSymbol symbol={`{${color}}`} />
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>
        <div className="space-y-1">
          <label htmlFor={`${id}-valid`} className="font-medium text-sm">
            {t("validityLabel")}
          </label>
          <select
            id={`${id}-valid`}
            value={settings.validity ?? ""}
            onChange={(event) =>
              go({
                validity: (event.target.value || null) as DeckValidity | null,
              })
            }
            className={cn(selectClassName, "block")}
          >
            <option value="">{t("validity.all")}</option>
            {DECK_VALIDITIES.map((validity) => (
              <option key={validity} value={validity}>
                {t(`validity.${validity}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor={`${id}-sort`} className="font-medium text-sm">
            {t("sortLabel")}
          </label>
          <select
            id={`${id}-sort`}
            value={settings.sort}
            onChange={(event) => go({ sort: event.target.value as DeckSort })}
            className={cn(selectClassName, "block")}
          >
            {DECK_SORTS.map((sort) => (
              <option key={sort} value={sort}>
                {t(`sorts.${sort}`)}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
