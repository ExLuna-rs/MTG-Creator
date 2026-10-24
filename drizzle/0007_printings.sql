CREATE TABLE "card_set" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"search_name" text NOT NULL,
	"set_type" text NOT NULL,
	"released_at" date NOT NULL,
	"card_count" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "printing" (
	"id" uuid PRIMARY KEY NOT NULL,
	"oracle_id" uuid NOT NULL,
	"set_code" text NOT NULL,
	"set_name" text NOT NULL,
	"set_type" text NOT NULL,
	"collector_number" text NOT NULL,
	"rarity" text NOT NULL,
	"released_at" date NOT NULL,
	"special" boolean NOT NULL,
	"finishes" text[] NOT NULL,
	"image_uris" jsonb,
	"back_image_uris" jsonb,
	"artist" text,
	"cardmarket_id" integer,
	"tcgplayer_id" integer,
	"price_eur" real,
	"price_usd" real,
	"price_eur_foil" real,
	"price_usd_foil" real,
	"synced_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "deck_card" ADD COLUMN "printing_id" uuid;--> statement-breakpoint
CREATE INDEX "card_set_search_name_trgm_idx" ON "card_set" USING gin ("search_name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "printing_oracle_id_idx" ON "printing" USING btree ("oracle_id","released_at");--> statement-breakpoint
CREATE INDEX "printing_set_code_idx" ON "printing" USING btree ("set_code");