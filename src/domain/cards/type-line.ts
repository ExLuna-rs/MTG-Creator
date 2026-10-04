/** Types de cartes proposés dans les filtres de recherche. */
export const CARD_TYPES = [
  "Artifact",
  "Battle",
  "Creature",
  "Enchantment",
  "Instant",
  "Kindred",
  "Land",
  "Planeswalker",
  "Sorcery",
] as const;

export type CardType = (typeof CARD_TYPES)[number];

const SUPERTYPES = new Set([
  "Basic",
  "Elite",
  "Host",
  "Legendary",
  "Ongoing",
  "Snow",
  "World",
]);

export interface ParsedTypeLine {
  supertypes: string[];
  types: string[];
  subtypes: string[];
}

/**
 * Découpe une ligne de type, toutes faces comprises :
 * « Legendary Creature — Elf Druid // Sorcery » donne les surtypes
 * [Legendary], les types [Creature, Sorcery] et les sous-types [Elf, Druid].
 */
export function parseTypeLine(typeLine: string): ParsedTypeLine {
  const supertypes = new Set<string>();
  const types = new Set<string>();
  const subtypes = new Set<string>();

  for (const face of typeLine.split("//")) {
    const [left = "", right = ""] = face.split("—");
    for (const word of left.trim().split(/\s+/).filter(Boolean)) {
      (SUPERTYPES.has(word) ? supertypes : types).add(word);
    }
    for (const word of right.trim().split(/\s+/).filter(Boolean)) {
      subtypes.add(word);
    }
  }

  return {
    supertypes: [...supertypes],
    types: [...types],
    subtypes: [...subtypes],
  };
}
