// Schéma de la base de données (tables Drizzle).
// Les tables des decks (phase 3) viendront s'ajouter.
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
  uniqueIndex,
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

// -----------------------------------------------------------------------------
// Comptes : tables gérées par Better Auth (src/server/auth/auth.ts). Les noms
// des champs TypeScript sont ceux qu'attend Better Auth ; les colonnes restent
// en snake_case comme le reste de la base.
// -----------------------------------------------------------------------------

/** Utilisateurs. `name` est le pseudo affiché. */
export const users = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  // Langue préférée (fr ou en) : langue des emails envoyés à l'utilisateur.
  locale: text("locale").notNull().default("fr"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Sessions ouvertes (cookie de session). */
export const sessions = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    token: text("token").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("session_token_idx").on(table.token),
    index("session_user_id_idx").on(table.userId),
  ],
);

/**
 * Moyens de connexion d'un utilisateur : mot de passe (`providerId` =
 * « credential », mot de passe haché), puis Discord et Google.
 */
export const accounts = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      withTimezone: true,
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("account_user_id_idx").on(table.userId)],
);

/** Jetons à usage unique : vérification de l'email, mot de passe oublié. */
export const verifications = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);
