import { maxCopies } from "../commander/singleton";
import type { DeckCardData, DeckEntry, DeckZone } from "./deck";

/** Contenu modifiable d'un deck : ce que la sauvegarde envoie au serveur. */
export interface DeckSnapshot {
  name: string;
  entries: DeckEntry[];
}

/** État de l'éditeur : le deck, son historique et les données des cartes. */
export interface EditorState {
  past: DeckSnapshot[];
  present: DeckSnapshot;
  future: DeckSnapshot[];
  /** Données des cartes déjà rencontrées, par `oracleId`. */
  cards: Record<string, DeckCardData>;
}

/** Nombre d'étapes gardées pour « Annuler ». */
export const HISTORY_LIMIT = 100;

/** Quantité maximale saisie pour une ligne (terrains de base compris). */
export const MAX_QUANTITY = 99;

/** Nombre maximal de catégories par carte. */
export const MAX_CATEGORIES = 10;

export type EditorAction =
  | { type: "add"; card: DeckCardData; zone: DeckZone }
  | { type: "setQuantity"; oracleId: string; zone: DeckZone; quantity: number }
  | { type: "remove"; oracleId: string; zone: DeckZone }
  | { type: "move"; oracleId: string; from: DeckZone; to: DeckZone }
  | {
      type: "setCategories";
      oracleId: string;
      zone: DeckZone;
      categories: string[];
    }
  | {
      type: "setPrimaryCategory";
      oracleId: string;
      zone: DeckZone;
      category: string | null;
    }
  | {
      /**
       * Glisser-déposer : change la zone et, si `category` est donnée (null :
       * sans catégorie), la catégorie principale, en une seule étape.
       */
      type: "drop";
      oracleId: string;
      from: DeckZone;
      to: DeckZone;
      category?: string | null;
    }
  | { type: "rename"; name: string }
  | { type: "undo" }
  | { type: "redo" };

export function createEditorState(
  snapshot: DeckSnapshot,
  cards: DeckCardData[],
): EditorState {
  return {
    past: [],
    present: snapshot,
    future: [],
    cards: Object.fromEntries(cards.map((card) => [card.oracleId, card])),
  };
}

const isEntry = (oracleId: string, zone: DeckZone) => (entry: DeckEntry) =>
  entry.oracleId === oracleId && entry.zone === zone;

/** Quantité maximale d'une carte dans une zone. */
function zoneLimit(card: DeckCardData | undefined, zone: DeckZone): number {
  if (zone === "commander") return 1;
  if (!card) return MAX_QUANTITY;
  return Math.min(maxCopies(card), MAX_QUANTITY);
}

/** Nettoie une liste de catégories : espaces, doublons, vides, nombre. */
export function cleanCategories(categories: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of categories) {
    const category = raw.trim().replace(/\s+/g, " ").slice(0, 40);
    const key = category.toLowerCase();
    if (!category || seen.has(key)) continue;
    seen.add(key);
    result.push(category);
  }
  return result.slice(0, MAX_CATEGORIES);
}

function updateEntries(state: EditorState, entries: DeckEntry[]): DeckSnapshot {
  return { ...state.present, entries };
}

/** Applique une modification au deck ; renvoie null si rien ne change. */
function applyEdit(
  state: EditorState,
  action: Exclude<EditorAction, { type: "undo" | "redo" }>,
): DeckSnapshot | null {
  const { entries } = state.present;

  switch (action.type) {
    case "add": {
      const existing = entries.find(isEntry(action.card.oracleId, action.zone));
      if (existing) {
        if (existing.quantity >= zoneLimit(action.card, action.zone)) {
          return null;
        }
        return updateEntries(
          state,
          entries.map((entry) =>
            entry === existing
              ? { ...entry, quantity: entry.quantity + 1 }
              : entry,
          ),
        );
      }
      return updateEntries(state, [
        ...entries,
        {
          oracleId: action.card.oracleId,
          zone: action.zone,
          quantity: 1,
          categories: [],
        },
      ]);
    }

    case "setQuantity": {
      if (!Number.isFinite(action.quantity)) return null;
      const quantity = Math.floor(action.quantity);
      if (quantity <= 0) {
        return applyEdit(state, {
          type: "remove",
          oracleId: action.oracleId,
          zone: action.zone,
        });
      }
      const existing = entries.find(isEntry(action.oracleId, action.zone));
      const limit = action.zone === "commander" ? 1 : MAX_QUANTITY;
      const next = Math.min(quantity, limit);
      if (!existing || existing.quantity === next) return null;
      return updateEntries(
        state,
        entries.map((entry) =>
          entry === existing ? { ...entry, quantity: next } : entry,
        ),
      );
    }

    case "remove": {
      const kept = entries.filter(
        (entry) => !isEntry(action.oracleId, action.zone)(entry),
      );
      return kept.length === entries.length ? null : updateEntries(state, kept);
    }

    case "move": {
      if (action.from === action.to) return null;
      const source = entries.find(isEntry(action.oracleId, action.from));
      if (!source) return null;
      const target = entries.find(isEntry(action.oracleId, action.to));
      const limit = action.to === "commander" ? 1 : MAX_QUANTITY;
      const moved: DeckEntry = target
        ? {
            ...target,
            quantity: Math.min(target.quantity + source.quantity, limit),
            categories: cleanCategories([
              ...target.categories,
              ...source.categories,
            ]),
          }
        : {
            ...source,
            zone: action.to,
            quantity: Math.min(source.quantity, limit),
          };
      return updateEntries(state, [
        ...entries.filter((entry) => entry !== source && entry !== target),
        moved,
      ]);
    }

    case "setCategories": {
      const existing = entries.find(isEntry(action.oracleId, action.zone));
      if (!existing) return null;
      const categories = cleanCategories(action.categories);
      if (categories.join("\n") === existing.categories.join("\n")) return null;
      return updateEntries(
        state,
        entries.map((entry) =>
          entry === existing ? { ...entry, categories } : entry,
        ),
      );
    }

    case "setPrimaryCategory": {
      const existing = entries.find(isEntry(action.oracleId, action.zone));
      if (!existing) return null;
      // Sans catégorie : la catégorie principale est retirée, les autres restent.
      const others =
        action.category === null
          ? existing.categories.slice(1)
          : existing.categories.filter(
              (category) =>
                category.toLowerCase() !== action.category?.toLowerCase(),
            );
      return applyEdit(state, {
        type: "setCategories",
        oracleId: action.oracleId,
        zone: action.zone,
        categories:
          action.category === null ? others : [action.category, ...others],
      });
    }

    case "drop": {
      const moved =
        applyEdit(state, {
          type: "move",
          oracleId: action.oracleId,
          from: action.from,
          to: action.to,
        }) ?? state.present;
      if (action.category === undefined) {
        return moved === state.present ? null : moved;
      }
      const recategorized = applyEdit(
        { ...state, present: moved },
        {
          type: "setPrimaryCategory",
          oracleId: action.oracleId,
          zone: action.to,
          category: action.category,
        },
      );
      if (recategorized) return recategorized;
      return moved === state.present ? null : moved;
    }

    case "rename": {
      const name = action.name.slice(0, 100);
      return name === state.present.name ? null : { ...state.present, name };
    }
  }
}

/**
 * Réducteur de l'éditeur : chaque modification est gardée dans l'historique
 * (« Annuler » / « Rétablir »), sauf si elle ne change rien.
 */
export function editorReducer(
  state: EditorState,
  action: EditorAction,
): EditorState {
  switch (action.type) {
    case "undo": {
      const previous = state.past.at(-1);
      if (!previous) return state;
      return {
        ...state,
        past: state.past.slice(0, -1),
        present: previous,
        future: [state.present, ...state.future],
      };
    }
    case "redo": {
      const [next, ...future] = state.future;
      if (!next) return state;
      return {
        ...state,
        past: [...state.past, state.present],
        present: next,
        future,
      };
    }
    default: {
      const present = applyEdit(state, action);
      if (!present) return state;
      const cards =
        action.type === "add" && !state.cards[action.card.oracleId]
          ? { ...state.cards, [action.card.oracleId]: action.card }
          : state.cards;
      return {
        past: [...state.past, state.present].slice(-HISTORY_LIMIT),
        present,
        future: [],
        cards,
      };
    }
  }
}
