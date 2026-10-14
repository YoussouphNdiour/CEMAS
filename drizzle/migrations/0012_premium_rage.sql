CREATE TABLE "journal_modifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid,
	"user_nom" varchar(100) NOT NULL,
	"entite" varchar(20) NOT NULL,
	"entite_id" uuid NOT NULL,
	"action" varchar(20) NOT NULL,
	"libelle" varchar(200) NOT NULL,
	"avant" jsonb,
	"apres" jsonb,
	"motif" varchar(300),
	CONSTRAINT "journal_entite_check" CHECK ("journal_modifications"."entite" in ('eleve', 'contact', 'paiement', 'employe')),
	CONSTRAINT "journal_action_check" CHECK ("journal_modifications"."action" in ('modification', 'suppression'))
);
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'secretaire';--> statement-breakpoint
ALTER TABLE "journal_modifications" ADD CONSTRAINT "journal_modifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "journal_created_idx" ON "journal_modifications" USING btree ("created_at");