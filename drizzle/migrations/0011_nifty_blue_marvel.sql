ALTER TABLE "echeancier" DROP CONSTRAINT "echeancier_niveau_id_niveaux_id_fk";
--> statement-breakpoint
ALTER TABLE "forfait_lignes" DROP CONSTRAINT "forfait_lignes_niveau_id_niveaux_id_fk";
--> statement-breakpoint
ALTER TABLE "echeancier" ADD CONSTRAINT "echeancier_niveau_id_niveaux_id_fk" FOREIGN KEY ("niveau_id") REFERENCES "public"."niveaux"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forfait_lignes" ADD CONSTRAINT "forfait_lignes_niveau_id_niveaux_id_fk" FOREIGN KEY ("niveau_id") REFERENCES "public"."niveaux"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reductions" ADD CONSTRAINT "reductions_type_check" CHECK ("reductions"."type" in ('fratrie', 'personnel', 'negociee', 'bourse'));--> statement-breakpoint
ALTER TABLE "reductions" ADD CONSTRAINT "reductions_portee_check" CHECK ("reductions"."portee" in ('forfait', 'mensualites', 'les_deux'));--> statement-breakpoint
ALTER TABLE "reductions" ADD CONSTRAINT "reductions_mode_check" CHECK ("reductions"."mode" in ('montant', 'pourcentage'));--> statement-breakpoint
ALTER TABLE "reductions" ADD CONSTRAINT "reductions_valeur_check" CHECK ("reductions"."valeur" >= 1 and ("reductions"."mode" <> 'pourcentage' or "reductions"."valeur" <= 100));