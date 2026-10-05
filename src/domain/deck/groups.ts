import {
  type DeckCard,
  PRIMARY_TYPES,
  type PrimaryType,
  primaryType,
} from "./deck";
import { CARD_ROLES, type CardRole, entryRoles } from "./roles";

/** Regroupement des cartes du deck : par rôle, par type ou par catégorie. */
export const GROUP_MODES = ["role", "type", "category"] as const;

export type GroupMode = (typeof GROUP_MODES)[number];

export type DeckGroup =
  | { kind: "role"; id: string; role: CardRole | null; cards: DeckCard[] }
  | { kind: "type"; id: string; type: PrimaryType; cards: DeckCard[] }
  | {
      kind: "category";
      id: string;
      category: string | null;
      cards: DeckCard[];
    };

export interface GroupedDeck {
  commanders: DeckCard[];
  groups: DeckGroup[];
  maybe: DeckCard[];
}

const byName = (a: DeckCard, b: DeckCard) =>
  a.card.name.localeCompare(b.card.name, "en");

/** Catégorie principale d'une carte (la première), ou null. */
export function primaryCategory(entry: {
  categories: string[];
}): string | null {
  return entry.categories[0] ?? null;
}

/** Identifiant du groupe d'une catégorie (null : sans catégorie). */
export function categoryGroupId(category: string | null): string {
  return category === null ? "category:" : `category:${category}`;
}

/** Identifiant du groupe d'un rôle (null : autres cartes). */
export function roleGroupId(role: CardRole | null): string {
  return `role:${role ?? ""}`;
}

/**
 * Range les cartes : commandant(s), deck regroupé par rôle principal (dans
 * l'ordre de `CARD_ROLES`, « autres » en dernier), par type (dans l'ordre de
 * `PRIMARY_TYPES`) ou par catégorie principale (ordre alphabétique, « sans
 * catégorie » en dernier), puis cartes à considérer. Tri par nom dans
 * chaque groupe ; les groupes vides sont omis.
 */
export function groupDeck(
  deck: readonly DeckCard[],
  mode: GroupMode,
): GroupedDeck {
  const commanders = deck.filter((entry) => entry.zone === "commander");
  const main = deck.filter((entry) => entry.zone === "main");
  const maybe = deck.filter((entry) => entry.zone === "maybe");

  let groups: DeckGroup[];
  if (mode === "role") {
    const primaryRoles = new Map(
      main.map((entry) => [entry, entryRoles(entry)[0] ?? null]),
    );
    groups = [...CARD_ROLES, null].map(
      (role): DeckGroup => ({
        kind: "role",
        id: roleGroupId(role),
        role,
        cards: main
          .filter((entry) => primaryRoles.get(entry) === role)
          .sort(byName),
      }),
    );
  } else if (mode === "type") {
    groups = PRIMARY_TYPES.map(
      (type): DeckGroup => ({
        kind: "type",
        id: `type:${type}`,
        type,
        cards: main
          .filter((entry) => primaryType(entry.card) === type)
          .sort(byName),
      }),
    );
  } else {
    const categories = [
      ...new Set(main.map(primaryCategory).filter((c) => c !== null)),
    ].sort((a, b) => a.localeCompare(b));
    groups = [...categories, null].map(
      (category): DeckGroup => ({
        kind: "category",
        id: categoryGroupId(category),
        category,
        cards: main
          .filter((entry) => primaryCategory(entry) === category)
          .sort(byName),
      }),
    );
  }

  return {
    commanders: commanders.sort(byName),
    groups: groups.filter((group) => group.cards.length > 0),
    maybe: maybe.sort(byName),
  };
}
