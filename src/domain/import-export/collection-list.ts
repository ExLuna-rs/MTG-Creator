import { z } from "zod";
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
  /** Édition indiquée (« (CMM) 410 », colonnes du CSV), si elle l'est. */
  set: string | null;
  collectorNumber: string | null;
  foil: boolean;
  /** Identifiant Scryfall de l'édition (colonne « Scryfall ID »). */
  printingId: string | null;
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
const SET_HEADERS = ["edition", "set code", "set", "edition code", "set_code"];
const NUMBER_HEADERS = [
  "collector number",
  "collector_number",
  "card number",
  "number",
];
const FOIL_HEADERS = ["foil", "finish", "printing"];
const SCRYFALL_ID_HEADERS = ["scryfall id", "scryfall_id", "scryfallid"];
/** Valeurs de la colonne de finition qui désignent une carte brillante. */
const FOIL_VALUES = ["foil", "etched", "true", "yes", "1"];
const SET_CODE = /^[a-z0-9]{2,6}$/i;
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
    const column = (names: string[]) =>
      headers.findIndex((item) => names.includes(item));
    return {
      delimiter,
      name,
      quantity: column(QUANTITY_HEADERS),
      set: column(SET_HEADERS),
      number: column(NUMBER_HEADERS),
      foil: column(FOIL_HEADERS),
      scryfallId: column(SCRYFALL_ID_HEADERS),
    };
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
    const field = (column: number) =>
      column < 0 ? "" : (fields[column] ?? "");
    const set = field(columns.set);
    const scryfallId = field(columns.scryfallId);
    cards.push({
      line: index + 1,
      text,
      quantity,
      name,
      set: SET_CODE.test(set) ? set.toUpperCase() : null,
      collectorNumber: field(columns.number).slice(0, 12) || null,
      foil: FOIL_VALUES.includes(field(columns.foil).toLowerCase()),
      printingId: z.uuid().safeParse(scryfallId).success ? scryfallId : null,
    });
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
      .map(({ line, text, quantity, name, set, collectorNumber, foil }) => ({
        line,
        text,
        quantity,
        name,
        set,
        collectorNumber,
        foil,
        printingId: null,
      })),
    invalid: list.invalid,
    truncated: list.cards.length > MAX_COLLECTION_IMPORT_LINES,
  };
}

/** Exemplaires d'une carte à ajouter, avec leur édition si elle est connue. */
export interface CollectionImportEntry {
  oracleId: string;
  quantity: number;
  printingId?: string;
  foil?: boolean;
}

/**
 * Exemplaires à ajouter, par carte reconnue et par édition (quantités
 * additionnées). `printingOf` donne l'édition reconnue d'une ligne.
 */
export function collectionImportEntries(
  lines: readonly CollectionListLine[],
  resolve: (line: CollectionListLine) => string | null,
  printingOf: (
    line: CollectionListLine,
    oracleId: string,
  ) => string | null = () => null,
): CollectionImportEntry[] {
  const entries = new Map<string, CollectionImportEntry>();
  for (const line of lines) {
    const oracleId = resolve(line);
    if (!oracleId) continue;
    const printingId = printingOf(line, oracleId);
    const key = printingId
      ? `${oracleId}:${printingId}:${line.foil}`
      : oracleId;
    const quantity = Math.min(
      (entries.get(key)?.quantity ?? 0) + line.quantity,
      MAX_COLLECTION_QUANTITY,
    );
    entries.set(
      key,
      printingId
        ? { oracleId, quantity, printingId, foil: line.foil }
        : { oracleId, quantity },
    );
  }
  return [...entries.values()];
}
