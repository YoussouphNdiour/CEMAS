CREATE TABLE "abonnements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"eleve_id" uuid NOT NULL,
	"type_frais_id" uuid NOT NULL,
	"annee_scolaire_id" uuid NOT NULL,
	"mois_debut" integer NOT NULL,
	"mois_fin" integer,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "abonnements_mois_debut_check" CHECK ("abonnements"."mois_debut" BETWEEN 1 AND 12),
	CONSTRAINT "abonnements_mois_fin_check" CHECK ("abonnements"."mois_fin" IS NULL OR "abonnements"."mois_fin" BETWEEN 1 AND 12)
);
--> statement-breakpoint
ALTER TABLE "journal_modifications" DROP CONSTRAINT "journal_entite_check";--> statement-breakpoint
ALTER TABLE "types_frais" ADD COLUMN "abonnement" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "abonnements" ADD CONSTRAINT "abonnements_eleve_id_eleves_id_fk" FOREIGN KEY ("eleve_id") REFERENCES "public"."eleves"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "abonnements" ADD CONSTRAINT "abonnements_type_frais_id_types_frais_id_fk" FOREIGN KEY ("type_frais_id") REFERENCES "public"."types_frais"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "abonnements" ADD CONSTRAINT "abonnements_annee_scolaire_id_annees_scolaires_id_fk" FOREIGN KEY ("annee_scolaire_id") REFERENCES "public"."annees_scolaires"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "abonnements_unique_idx" ON "abonnements" USING btree ("eleve_id","type_frais_id","annee_scolaire_id");--> statement-breakpoint
ALTER TABLE "journal_modifications" ADD CONSTRAINT "journal_entite_check" CHECK ("journal_modifications"."entite" in ('eleve', 'contact', 'paiement', 'employe', 'abonnement', 'service'));