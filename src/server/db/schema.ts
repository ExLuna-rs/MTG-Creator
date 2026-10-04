// Schéma de la base de données (tables Drizzle).
// Les tables des comptes (phase 2) et des decks (phase 3) viendront s'ajouter.
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  serial,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import type { CardFace, CardImageUris } from "../../domain/cards/card";

/** Une ligne par carte (identifiant Oracle de Scryfall). */
export const cards = pgTable(
  "card",
  {
    oracleId: uuid("oracle_id").primaryKey(),
    scryfallId: uuid("scryfall_id").notNull(),
    name: text("name").notNull(),
    // Nom sans accents ni ponctuation, pour la recherche floue (pg_trgm).
    searchName: text("search_name").notNull(),
    layout: text("layout").notNull(),
    manaCost: text("mana_cost"),
    manaValue: real("mana_value").notNull(),
    typeLine: text("type_line").notNull(),
    oracleText: text("oracle_text"),
    colors: text("colors").array().notNull(),
    // Masque de bits WUBRG (W=1, U=2, B=4, R=8, G=16).
    colorIdentity: smallint("color_identity").notNull(),
    keywords: text("keywords").array().notNull(),
    supertypes: text("supertypes").array().notNull(),
    types: text("types").array().notNull(),
    subtypes: text("subtypes").array().notNull(),
    faces: jsonb("faces").$type<CardFace[]>().notNull(),
    imageUris: jsonb("image_uris").$type<CardImageUris | null>(),
    legalities: jsonb("legalities").$type<Record<string, string>>().notNull(),
    commanderLegality: text("commander_legality").notNull(),
    canBeCommander: boolean("can_be_commander").notNull(),
    gameChanger: boolean("game_changer").notNull(),
    edhrecRank: integer("edhrec_rank"),
    producedMana: text("produced_mana").array().notNull(),
    rarity: text("rarity").notNull(),
    setCode: text("set_code").notNull(),
    setName: text("set_name").notNull(),
    collectorNumber: text("collector_number").notNull(),
    releasedAt: date("released_at").notNull(),
    artist: text("artist"),
    priceUsd: real("price_usd"),
    priceEur: real("price_eur"),
    scryfallUri: text("scryfall_uri").notNull(),
    // Date de l'import qui a écrit la ligne : les cartes absentes du dernier
    // import complet sont supprimées.
    syncedAt: timestamp("synced_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("card_search_name_trgm_idx").using(
      "gin",
      table.searchName.op("gin_trgm_ops"),
    ),
    index("card_oracle_text_trgm_idx").using(
      "gin",
      table.oracleText.op("gin_trgm_ops"),
    ),
    index("card_types_idx").using("gin", table.types),
    index("card_mana_value_idx").on(table.manaValue),
    index("card_edhrec_rank_idx").on(table.edhrecRank),
  ],
);

/** Historique des imports de cartes. */
export const cardImports = pgTable("card_import", {
  id: serial("id").primaryKey(),
  // URL du fichier Scryfall, ou chemin du fichier local importé.
  source: text("source").notNull(),
  sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true }),
  cardCount: integer("card_count").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true }).notNull(),
});
