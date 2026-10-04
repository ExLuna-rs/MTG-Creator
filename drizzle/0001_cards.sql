CREATE TABLE "card_import" (
	"id" serial PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"source_updated_at" timestamp with time zone,
	"card_count" integer NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "card" (
	"oracle_id" uuid PRIMARY KEY NOT NULL,
	"scryfall_id" uuid NOT NULL,
	"name" text NOT NULL,
	"search_name" text NOT NULL,
	"layout" text NOT NULL,
	"mana_cost" text,
	"mana_value" real NOT NULL,
	"type_line" text NOT NULL,
	"oracle_text" text,
	"colors" text[] NOT NULL,
	"color_identity" smallint NOT NULL,
	"keywords" text[] NOT NULL,
	"supertypes" text[] NOT NULL,
	"types" text[] NOT NULL,
	"subtypes" text[] NOT NULL,
	"faces" jsonb NOT NULL,
	"image_uris" jsonb,
	"legalities" jsonb NOT NULL,
	"commander_legality" text NOT NULL,
	"can_be_commander" boolean NOT NULL,
	"game_changer" boolean NOT NULL,
	"edhrec_rank" integer,
	"produced_mana" text[] NOT NULL,
	"rarity" text NOT NULL,
	"set_code" text NOT NULL,
	"set_name" text NOT NULL,
	"collector_number" text NOT NULL,
	"released_at" date NOT NULL,
	"artist" text,
	"price_usd" real,
	"price_eur" real,
	"scryfall_uri" text NOT NULL,
	"synced_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "card_search_name_trgm_idx" ON "card" USING gin ("search_name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "card_oracle_text_trgm_idx" ON "card" USING gin ("oracle_text" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "card_types_idx" ON "card" USING gin ("types");--> statement-breakpoint
CREATE INDEX "card_mana_value_idx" ON "card" USING btree ("mana_value");--> statement-breakpoint
CREATE INDEX "card_edhrec_rank_idx" ON "card" USING btree ("edhrec_rank");