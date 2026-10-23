import type { DeckCard, DeckZone } from "../deck/deck";

/**
 * Formats d'export d'un deck : sections « Commander » et « Deck » (MTG
 * Arena, Moxfield), catégories entre crochets (Archidekt), texte simple, et
 * liste d'achat pour Cardmarket (« Ajouter une liste » des listes de
 * souhaits).
 */
export const DECK_EXPORT_FORMATS = [
  "arena",
  "archidekt",
  "plain",
  "cardmarket",
] as const;

export type DeckExportFormat = (typeof DECK_EXPORT_FORMATS)[number];

export interface DeckExportOptions {
  /** Ajoute les cartes à considérer (en « Sideboard » pour MTG Arena). */
  includeMaybe: boolean;
  /** Cardmarket : sans les terrains de base, qu'on a toujours sous la main. */
  skipBasicLands: boolean;
}

/** Une ligne d'export : quantité et nom anglais complet. */
interface Line {
  quantity: number;
  name: string;
  categories: string[];
}

const byName = (a: Line, b: Line) => a.name.localeCompare(b.name, "en");

function linesOf(cards: readonly DeckCard[], zone: DeckZone): Line[] {
  return cards
    .filter((entry) => entry.zone === zone)
    .map(({ quantity, card, categories }) => ({
      quantity,
      name: card.name,
      categories,
    }))
    .sort(byName);
}

function isBasicLand(entry: DeckCard): boolean {
  return (
    entry.card.supertypes.includes("Basic") && entry.card.types.includes("Land")
  );
}

/** Mêmes noms dans plusieurs zones : une seule ligne, quantités ajoutées. */
function merged(lines: readonly Line[]): Line[] {
  const result = new Map<string, Line>();
  for (const line of lines) {
    const existing = result.get(line.name);
    result.set(
      line.name,
      existing
        ? { ...existing, quantity: existing.quantity + line.quantity }
        : line,
    );
  }
  return [...result.values()].sort(byName);
}

const plainLine = ({ quantity, name }: Line) => `${quantity} ${name}`;

/**
 * Liste texte d'un deck, avec toujours les noms anglais : les autres outils
 * les reconnaissent. Les cartes sont triées par nom dans chaque section.
 */
export function exportDeck(
  cards: readonly DeckCard[],
  format: DeckExportFormat,
  { includeMaybe, skipBasicLands }: DeckExportOptions,
): string {
  const commanders = linesOf(cards, "commander");
  const main = linesOf(cards, "main");
  const maybe = includeMaybe ? linesOf(cards, "maybe") : [];

  switch (format) {
    case "arena": {
      const sections: [string, Line[]][] = [
        ["Commander", commanders],
        ["Deck", main],
        ["Sideboard", maybe],
      ];
      return sections
        .filter(([, lines]) => lines.length > 0)
        .map(([title, lines]) => [title, ...lines.map(plainLine)].join("\n"))
        .join("\n\n");
    }
    case "archidekt": {
      // Catégories d'Archidekt : « {top} » place le commandant en tête,
      // « {noDeck}{noPrice} » garde le maybeboard hors du deck.
      const line = ({ quantity, name, categories }: Line, extra: string[]) => {
        const all = [...extra, ...categories];
        return `${quantity}x ${name}${all.length > 0 ? ` [${all.join(",")}]` : ""}`;
      };
      return [
        ...commanders.map((item) => line(item, ["Commander{top}"])),
        ...main.map((item) => line(item, [])),
        ...maybe.map((item) =>
          line({ ...item, categories: [] }, ["Maybeboard{noDeck}{noPrice}"]),
        ),
      ].join("\n");
    }
    case "plain":
      return [...commanders, ...main, ...maybe].map(plainLine).join("\n");
    case "cardmarket": {
      const wanted = cards.filter(
        (entry) =>
          (entry.zone !== "maybe" || includeMaybe) &&
          !(skipBasicLands && isBasicLand(entry)),
      );
      return merged(
        wanted.map(({ quantity, card }) => ({
          quantity,
          name: card.name,
          categories: [],
        })),
      )
        .map(plainLine)
        .join("\n");
    }
  }
}

/** Formats d'export de la collection : texte, ou CSV (Moxfield, ManaBox…). */
export const COLLECTION_EXPORT_FORMATS = ["text", "csv"] as const;

export type CollectionExportFormat = (typeof COLLECTION_EXPORT_FORMATS)[number];

/** Champ CSV entre guillemets, guillemets doublés. */
const csvField = (value: string | number) =>
  `"${String(value).replace(/"/g, '""')}"`;

/** Liste de la collection, triée par nom. */
export function exportCollection(
  entries: readonly { name: string; quantity: number }[],
  format: CollectionExportFormat,
): string {
  const lines = [...entries]
    .filter((entry) => entry.quantity > 0)
    .sort((a, b) => a.name.localeCompare(b.name, "en"));
  if (format === "text") {
    return lines.map((entry) => `${entry.quantity} ${entry.name}`).join("\n");
  }
  return [
    `${csvField("Count")},${csvField("Name")}`,
    ...lines.map(
      (entry) => `${csvField(entry.quantity)},${csvField(entry.name)}`,
    ),
  ].join("\n");
}
