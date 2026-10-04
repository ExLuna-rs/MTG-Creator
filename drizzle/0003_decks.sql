CREATE TABLE "deck_card" (
	"deck_id" uuid NOT NULL,
	"oracle_id" uuid NOT NULL,
	"zone" text NOT NULL,
	"quantity" smallint NOT NULL,
	"categories" text[] DEFAULT '{}' NOT NULL,
	CONSTRAINT "deck_card_deck_id_zone_oracle_id_pk" PRIMARY KEY("deck_id","zone","oracle_id")
);
--> statement-breakpoint
CREATE TABLE "deck" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"format" text DEFAULT 'commander' NOT NULL,
	"visibility" text DEFAULT 'private' NOT NULL,
	"cover_oracle_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "deck_card" ADD CONSTRAINT "deck_card_deck_id_deck_id_fk" FOREIGN KEY ("deck_id") REFERENCES "public"."deck"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deck" ADD CONSTRAINT "deck_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "deck_user_id_idx" ON "deck" USING btree ("user_id","updated_at");