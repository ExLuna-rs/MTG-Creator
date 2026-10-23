import { MAX_COLLECTION_QUANTITY } from "../collection/schema";
import { parseDeckList } from "./deck-list";

/** Taille maximale d'une liste ou d'un fichier importé dans la collection. */
export const MAX_COLLECTION_IMPORT_LENGTH = 1_000_000;

/** Nombre maximal de lignes de cartes lues dans un import. */
export const MAX_COLLECTION_IMPORT_LINES = 5000;

/** Une carte lue dans une liste ou un fichier CSV. */
export interface CollectionListLine {
  /** Numéro de la ligne dans le texte, à partir de 1. */
  line: number;
  text: string;
  quantity: number;
  name: string;
}

export interface ParsedCollectionList {
  format: "text" | "csv";
  cards: CollectionListLine[];
  invalid: { line: number; text: string }[];
  /** Plus de lignes que `MAX_COLLECTION_IMPORT_LINES` : la suite est ignorée. */
  truncated: boolean;
}

/** En-têtes des colonnes du nom et de la quantité (Moxfield, ManaBox, Archidekt, Deckbox…). */
const NAME_HEADERS = ["name", "card name", "card", "card_name"];
const QUANTITY_HEADERS = ["count", "quantity", "qty", "amount"];
const DELIMITERS = [",", ";", "\t"];

/** Découpe une ligne CSV (champs entre guillemets, guillemets doublés). */
export function splitCsvLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < line.length; index++) {
    const char = line[index];
    if (quoted) {
      if (char === '"' && line[index + 1] === '"') {
        field += '"';
        index++;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      fields.push(field);
      field = "";
    } else {
      field += char;
    }
  }
  fields.push(field);
  return fields.map((item) => item.trim());
}

/** Colonnes d'un fichier CSV, si la première ligne en est l'en-tête. */
function csvColumns(header: string) {
  for (const delimiter of DELIMITERS) {
    const headers = splitCsvLine(header, delimiter).map((item) =>
      item.toLowerCase(),
    );
    const name = headers.findIndex((item) => NAME_HEADERS.includes(item));
    if (name < 0 || headers.length < 2) continue;
    const quantity = headers.findIndex((item) =>
      QUANTITY_HEADERS.includes(item),
    );
    return { delimiter, name, quantity };
  }
  return null;
}

function parseCsv(
  rows: string[],
  headerIndex: number,
  columns: NonNullable<ReturnType<typeof csvColumns>>,
): ParsedCollectionList {
  const cards: CollectionListLine[] = [];
  const invalid: ParsedCollectionList["invalid"] = [];
  let truncated = false;
  rows.forEach((raw, index) => {
    const text = raw.trim();
    if (index <= headerIndex || !text) return;
    if (cards.length >= MAX_COLLECTION_IMPORT_LINES) {
      truncated = true;
      return;
    }
    const fields = splitCsvLine(text, columns.delimiter);
    const name = fields[columns.name] ?? "";
    const rawQuantity = columns.quantity < 0 ? "1" : fields[columns.quantity];
    const quantity = /^\d+$/.test(rawQuantity ?? "") ? Number(rawQuantity) : 0;
    if (
      quantity < 1 ||
      quantity > MAX_COLLECTION_QUANTITY ||
      name.length > 200 ||
      !/\p{L}/u.test(name)
    ) {
      invalid.push({ line: index + 1, text });
      return;
    }
    cards.push({ line: index + 1, text, quantity, name });
  });
  return { format: "csv", cards, invalid, truncated };
}

/**
 * Lit une liste à ajouter à la collection : un export CSV (Moxfield,
 * ManaBox, Archidekt, Deckbox : colonnes du nom et de la quantité repérées
 * par l'en-tête), sinon une liste texte comme celles des decks (EDHREC,
 * Moxfield, MTG Arena…). Les sections (Commander, Sideboard…) n'ont pas de
 * sens ici : toutes les cartes vont dans la collection.
 */
export function parseCollectionList(text: string): ParsedCollectionList {
  const content = text.slice(0, MAX_COLLECTION_IMPORT_LENGTH);
  const rows = content.split(/\r?\n/);
  const headerIndex = rows.findIndex((row) => row.trim());
  const columns = headerIndex < 0 ? null : csvColumns(rows[headerIndex]);
  if (columns) return parseCsv(rows, headerIndex, columns);

  const list = parseDeckList(content, {
    maxLength: MAX_COLLECTION_IMPORT_LENGTH,
  });
  return {
    format: "text",
    cards: list.cards
      .slice(0, MAX_COLLECTION_IMPORT_LINES)
      .map(({ line, text, quantity, name }) => ({
        line,
        text,
        quantity,
        name,
      })),
    invalid: list.invalid,
    truncated: list.cards.length > MAX_COLLECTION_IMPORT_LINES,
  };
}

/** Exemplaires à ajouter, par carte reconnue (quantités additionnées). */
export function collectionImportEntries(
  lines: readonly CollectionListLine[],
  resolve: (line: CollectionListLine) => string | null,
): { oracleId: string; quantity: number }[] {
  const totals = new Map<string, number>();
  for (const line of lines) {
    const oracleId = resolve(line);
    if (!oracleId) continue;
    totals.set(
      oracleId,
      Math.min(
        (totals.get(oracleId) ?? 0) + line.quantity,
        MAX_COLLECTION_QUANTITY,
      ),
    );
  }
  return [...totals].map(([oracleId, quantity]) => ({ oracleId, quantity }));
}
