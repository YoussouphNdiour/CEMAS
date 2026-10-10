CREATE TABLE "reductions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"eleve_id" uuid NOT NULL,
	"annee_scolaire_id" uuid NOT NULL,
	"type" varchar(20) NOT NULL,
	"portee" varchar(12) NOT NULL,
	"mode" varchar(12) NOT NULL,
	"valeur" integer NOT NULL,
	"motif" varchar(200),
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "reductions" ADD CONSTRAINT "reductions_eleve_id_eleves_id_fk" FOREIGN KEY ("eleve_id") REFERENCES "public"."eleves"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reductions" ADD CONSTRAINT "reductions_annee_scolaire_id_annees_scolaires_id_fk" FOREIGN KEY ("annee_scolaire_id") REFERENCES "public"."annees_scolaires"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "reductions_eleve_annee_idx" ON "reductions" USING btree ("eleve_id","annee_scolaire_id");