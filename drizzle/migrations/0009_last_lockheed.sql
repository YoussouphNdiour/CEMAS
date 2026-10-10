CREATE TABLE "echeancier" (
	"niveau_id" uuid NOT NULL,
	"annee_scolaire_id" uuid NOT NULL,
	"mois" integer NOT NULL,
	"montant" integer NOT NULL,
	CONSTRAINT "echeancier_niveau_id_annee_scolaire_id_mois_pk" PRIMARY KEY("niveau_id","annee_scolaire_id","mois")
);
--> statement-breakpoint
CREATE TABLE "forfait_lignes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"niveau_id" uuid NOT NULL,
	"annee_scolaire_id" uuid NOT NULL,
	"libelle" varchar(60) NOT NULL,
	"montant" integer NOT NULL,
	"ordre" integer NOT NULL,
	"type_frais_id" uuid
);
--> statement-breakpoint
ALTER TABLE "echeancier" ADD CONSTRAINT "echeancier_niveau_id_niveaux_id_fk" FOREIGN KEY ("niveau_id") REFERENCES "public"."niveaux"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "echeancier" ADD CONSTRAINT "echeancier_annee_scolaire_id_annees_scolaires_id_fk" FOREIGN KEY ("annee_scolaire_id") REFERENCES "public"."annees_scolaires"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forfait_lignes" ADD CONSTRAINT "forfait_lignes_niveau_id_niveaux_id_fk" FOREIGN KEY ("niveau_id") REFERENCES "public"."niveaux"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forfait_lignes" ADD CONSTRAINT "forfait_lignes_annee_scolaire_id_annees_scolaires_id_fk" FOREIGN KEY ("annee_scolaire_id") REFERENCES "public"."annees_scolaires"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forfait_lignes" ADD CONSTRAINT "forfait_lignes_type_frais_id_types_frais_id_fk" FOREIGN KEY ("type_frais_id") REFERENCES "public"."types_frais"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "forfait_lignes_niveau_annee_idx" ON "forfait_lignes" USING btree ("niveau_id","annee_scolaire_id");