CREATE TABLE "deck_card_copy" (
	"deck_id" uuid NOT NULL,
	"oracle_id" uuid NOT NULL,
	"quantity" smallint NOT NULL,
	CONSTRAINT "deck_card_copy_deck_id_oracle_id_pk" PRIMARY KEY("deck_id","oracle_id")
);
--> statement-breakpoint
ALTER TABLE "deck" ADD COLUMN "assembled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "deck_card_copy" ADD CONSTRAINT "deck_card_copy_deck_id_deck_id_fk" FOREIGN KEY ("deck_id") REFERENCES "public"."deck"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "deck_card_copy_oracle_id_idx" ON "deck_card_copy" USING btree ("oracle_id");