CREATE TABLE "passage_decisions" (
	"eleve_id" uuid PRIMARY KEY NOT NULL,
	"annee_scolaire_id" uuid NOT NULL,
	"decision" varchar(10) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "passage_decisions" ADD CONSTRAINT "passage_decisions_eleve_id_eleves_id_fk" FOREIGN KEY ("eleve_id") REFERENCES "public"."eleves"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passage_decisions" ADD CONSTRAINT "passage_decisions_annee_scolaire_id_annees_scolaires_id_fk" FOREIGN KEY ("annee_scolaire_id") REFERENCES "public"."annees_scolaires"("id") ON DELETE cascade ON UPDATE no action;