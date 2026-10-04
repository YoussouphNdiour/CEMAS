ALTER TABLE "annees_scolaires" ADD COLUMN "archived" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "depenses" ADD COLUMN "annee_scolaire_id" uuid;--> statement-breakpoint
ALTER TABLE "recettes" ADD COLUMN "annee_scolaire_id" uuid;--> statement-breakpoint
ALTER TABLE "depenses" ADD CONSTRAINT "depenses_annee_scolaire_id_annees_scolaires_id_fk" FOREIGN KEY ("annee_scolaire_id") REFERENCES "public"."annees_scolaires"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recettes" ADD CONSTRAINT "recettes_annee_scolaire_id_annees_scolaires_id_fk" FOREIGN KEY ("annee_scolaire_id") REFERENCES "public"."annees_scolaires"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "classes_annee_idx" ON "classes" USING btree ("annee_scolaire_id");--> statement-breakpoint
CREATE INDEX "classes_niveau_idx" ON "classes" USING btree ("niveau_id");--> statement-breakpoint
CREATE INDEX "depenses_annee_idx" ON "depenses" USING btree ("annee_scolaire_id");--> statement-breakpoint
CREATE INDEX "depenses_date_idx" ON "depenses" USING btree ("date");--> statement-breakpoint
CREATE INDEX "grille_frais_annee_idx" ON "grille_frais" USING btree ("annee_scolaire_id");--> statement-breakpoint
CREATE INDEX "paiements_annee_mois_idx" ON "paiements" USING btree ("annee_scolaire_id","mois");--> statement-breakpoint
CREATE INDEX "paiements_eleve_annee_idx" ON "paiements" USING btree ("eleve_id","annee_scolaire_id");--> statement-breakpoint
CREATE INDEX "recettes_annee_idx" ON "recettes" USING btree ("annee_scolaire_id");--> statement-breakpoint
CREATE INDEX "recettes_date_idx" ON "recettes" USING btree ("date");--> statement-breakpoint
CREATE INDEX "bulletins_annee_mois_idx" ON "bulletins_paie" USING btree ("annee","mois");--> statement-breakpoint
CREATE INDEX "eleves_annee_classe_idx" ON "eleves" USING btree ("annee_scolaire_id","classe_id");--> statement-breakpoint
CREATE INDEX "eleves_annee_idx" ON "eleves" USING btree ("annee_scolaire_id");--> statement-breakpoint
CREATE INDEX "inscriptions_annee_idx" ON "inscriptions" USING btree ("annee_scolaire_id");--> statement-breakpoint
CREATE INDEX "affectations_itineraire_annee_idx" ON "affectations_transport" USING btree ("itineraire_id","annee_scolaire_id");--> statement-breakpoint
CREATE INDEX "affectations_annee_idx" ON "affectations_transport" USING btree ("annee_scolaire_id");--> statement-breakpoint
CREATE INDEX "arrets_itineraire_idx" ON "arrets" USING btree ("itineraire_id");