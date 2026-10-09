ALTER TABLE "classes" ADD COLUMN "classe_suivante_id" uuid;--> statement-breakpoint
ALTER TABLE "classes" ADD COLUMN "fin_de_cycle" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "classes" ADD CONSTRAINT "classes_classe_suivante_id_classes_id_fk" FOREIGN KEY ("classe_suivante_id") REFERENCES "public"."classes"("id") ON DELETE set null ON UPDATE no action;