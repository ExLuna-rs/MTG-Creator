CREATE TABLE "collection_printing" (
	"user_id" text NOT NULL,
	"oracle_id" uuid NOT NULL,
	"printing_id" uuid NOT NULL,
	"foil" boolean NOT NULL,
	"quantity" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collection_printing_user_id_printing_id_foil_pk" PRIMARY KEY("user_id","printing_id","foil")
);
--> statement-breakpoint
ALTER TABLE "collection_printing" ADD CONSTRAINT "collection_printing_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "collection_printing_user_oracle_idx" ON "collection_printing" USING btree ("user_id","oracle_id");