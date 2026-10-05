import { normalizeCardName } from "../cards/normalize";
import { maxCopies } from "../commander/singleton";
import type { DeckCardData, DeckEntry, DeckZone } from "../deck/deck";
import { cleanCategories, MAX_QUANTITY } from "../deck/editor";
import { MAX_DECK_ENTRIES } from "../deck/schema";
import type { DeckListLine } from "./deck-list";

/** Nombre maximal de noms différents envoyés au serveur pour un import. */
export const MAX_IMPORT_NAMES = 300;

/** Noms à faire reconnaître par le serveur, sans doublons (après normalisation). */
export function uniqueNames(lines: readonly DeckListLine[]): string[] {
  const names = new Map<string, string>();
  for (const { name } of lines) {
    const key = normalizeCardName(name);
    if (key && !names.has(key)) names.set(key, name);
  }
  return [...names.values()];
}

/** Lignes du deck tirées des cartes reconnues, regroupées par carte et par zone. */
export function importEntries(
  lines: readonly DeckListLine[],
  resolve: (line: DeckListLine) => DeckCardData | null,
): DeckEntry[] {
  const entries = new Map<string, DeckEntry>();
  for (const line of lines) {
    const card = resolve(line);
    if (!card) continue;
    const key = `${line.zone}:${card.oracleId}`;
    const existing = entries.get(key);
    entries.set(
      key,
      existing
        ? {
            ...existing,
            quantity: existing.quantity + line.quantity,
            categories: [...existing.categories, ...line.categories],
          }
        : {
            oracleId: card.oracleId,
            zone: line.zone,
            quantity: line.quantity,
            categories: line.categories,
          },
    );
  }
  return [...entries.values()];
}

function zoneLimit(card: DeckCardData | undefined, zone: DeckZone): number {
  if (zone === "commander") return 1;
  return card ? Math.min(maxCopies(card), MAX_QUANTITY) : MAX_QUANTITY;
}

/**
 * Ajoute les lignes importées au deck. Avec `replace`, le deck est d'abord
 * vidé ; ses commandants restent si la liste n'en indique aucun. Comme pour
 * un ajout à la main, les quantités respectent la règle du singleton, et une
 * carte déjà commandant n'est pas ajoutée une seconde fois au deck (les
 * exports sans section la listent souvent avec les autres cartes).
 */
export function mergeImport(
  current: readonly DeckEntry[],
  imported: readonly DeckEntry[],
  cards: Readonly<Record<string, DeckCardData>>,
  { replace }: { replace: boolean },
): DeckEntry[] {
  const importsCommanders = imported.some(
    (entry) => entry.zone === "commander",
  );
  const result: DeckEntry[] = replace
    ? importsCommanders
      ? []
      : current.filter((entry) => entry.zone === "commander")
    : [...current];

  for (const entry of imported) {
    const isCommander = result.some(
      (item) => item.zone === "commander" && item.oracleId === entry.oracleId,
    );
    if (entry.zone !== "commander" && isCommander) continue;

    const limit = zoneLimit(cards[entry.oracleId], entry.zone);
    const index = result.findIndex(
      (item) => item.zone === entry.zone && item.oracleId === entry.oracleId,
    );
    if (index >= 0) {
      const existing = result[index];
      result[index] = {
        ...existing,
        quantity: Math.min(existing.quantity + entry.quantity, limit),
        categories: cleanCategories([
          ...existing.categories,
          ...entry.categories,
        ]),
      };
    } else if (result.length < MAX_DECK_ENTRIES) {
      result.push({
        ...entry,
        quantity: Math.min(entry.quantity, limit),
        categories: cleanCategories(entry.categories),
      });
    }
  }
  return result;
}
