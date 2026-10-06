CREATE TABLE "collection_card" (
	"user_id" text NOT NULL,
	"oracle_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collection_card_user_id_oracle_id_pk" PRIMARY KEY("user_id","oracle_id")
);
--> statement-breakpoint
CREATE TABLE "scan_session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scanned_card" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"scan_session_id" uuid,
	"oracle_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "collection_card" ADD CONSTRAINT "collection_card_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_session" ADD CONSTRAINT "scan_session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scanned_card" ADD CONSTRAINT "scanned_card_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scanned_card" ADD CONSTRAINT "scanned_card_scan_session_id_scan_session_id_fk" FOREIGN KEY ("scan_session_id") REFERENCES "public"."scan_session"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "scan_session_token_hash_idx" ON "scan_session" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "scan_session_user_id_idx" ON "scan_session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "scanned_card_user_id_idx" ON "scanned_card" USING btree ("user_id","id");