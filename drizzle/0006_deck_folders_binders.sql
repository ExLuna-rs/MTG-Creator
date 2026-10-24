CREATE TABLE "binder_card" (
	"binder_id" uuid NOT NULL,
	"oracle_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	CONSTRAINT "binder_card_binder_id_oracle_id_pk" PRIMARY KEY("binder_id","oracle_id")
);
--> statement-breakpoint
CREATE TABLE "binder" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deck_folder" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "deck" ADD COLUMN "folder_id" uuid;--> statement-breakpoint
ALTER TABLE "deck" ADD COLUMN "favorite" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "binder_card" ADD CONSTRAINT "binder_card_binder_id_binder_id_fk" FOREIGN KEY ("binder_id") REFERENCES "public"."binder"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "binder" ADD CONSTRAINT "binder_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deck_folder" ADD CONSTRAINT "deck_folder_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "binder_card_oracle_id_idx" ON "binder_card" USING btree ("oracle_id");--> statement-breakpoint
CREATE UNIQUE INDEX "binder_user_name_idx" ON "binder" USING btree ("user_id",lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "deck_folder_user_name_idx" ON "deck_folder" USING btree ("user_id",lower("name"));--> statement-breakpoint
ALTER TABLE "deck" ADD CONSTRAINT "deck_folder_id_deck_folder_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."deck_folder"("id") ON DELETE set null ON UPDATE no action;