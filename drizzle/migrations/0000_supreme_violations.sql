CREATE TABLE "annees_scolaires" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"libelle" varchar(20) NOT NULL,
	"date_debut" date NOT NULL,
	"date_fin" date NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "classes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nom" varchar(100) NOT NULL,
	"niveau_id" uuid NOT NULL,
	"capacite" integer DEFAULT 30 NOT NULL,
	"annee_scolaire_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "matieres" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nom" varchar(100) NOT NULL,
	"coefficient" integer DEFAULT 1 NOT NULL,
	"niveau_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "niveaux" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nom" varchar(50) NOT NULL,
	"ordre" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"nom" varchar(200) NOT NULL,
	"role" varchar(20) DEFAULT 'directeur' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "categories_depenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nom" varchar(100) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories_recettes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nom" varchar(100) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "depenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"categorie_id" uuid NOT NULL,
	"libelle" varchar(200) NOT NULL,
	"montant" integer NOT NULL,
	"date" date DEFAULT now() NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "grille_frais" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"classe_id" uuid NOT NULL,
	"type_frais_id" uuid NOT NULL,
	"annee_scolaire_id" uuid NOT NULL,
	"montant_mensuel" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "paiements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"eleve_id" uuid NOT NULL,
	"type_frais_id" uuid NOT NULL,
	"annee_scolaire_id" uuid NOT NULL,
	"mois" integer NOT NULL,
	"montant" integer NOT NULL,
	"date_paiement" date DEFAULT now() NOT NULL,
	"numero_recu" varchar(20) NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "paiements_numero_recu_unique" UNIQUE("numero_recu")
);
--> statement-breakpoint
CREATE TABLE "recettes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"categorie_id" uuid NOT NULL,
	"libelle" varchar(200) NOT NULL,
	"montant" integer NOT NULL,
	"date" date DEFAULT now() NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "types_frais" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nom" varchar(100) NOT NULL,
	"montant_defaut" integer DEFAULT 0 NOT NULL,
	"obligatoire" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bulletins_paie" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employe_id" uuid NOT NULL,
	"mois" integer NOT NULL,
	"annee" integer NOT NULL,
	"salaire_base" integer NOT NULL,
	"primes" integer DEFAULT 0 NOT NULL,
	"retenues" integer DEFAULT 0 NOT NULL,
	"net_a_payer" integer NOT NULL,
	"date_paiement" date,
	"paye" boolean DEFAULT false NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "employes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"matricule" varchar(20) NOT NULL,
	"prenom" varchar(100) NOT NULL,
	"nom" varchar(100) NOT NULL,
	"telephone" varchar(20),
	"poste" varchar(100) NOT NULL,
	"type" varchar(20) NOT NULL,
	"salaire_base" integer NOT NULL,
	"date_embauche" date NOT NULL,
	"statut" varchar(10) DEFAULT 'actif' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "employes_matricule_unique" UNIQUE("matricule")
);
--> statement-breakpoint
CREATE TABLE "eleve_parents" (
	"eleve_id" uuid NOT NULL,
	"parent_id" uuid NOT NULL,
	CONSTRAINT "eleve_parents_eleve_id_parent_id_pk" PRIMARY KEY("eleve_id","parent_id")
);
--> statement-breakpoint
CREATE TABLE "eleves" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"matricule" varchar(20) NOT NULL,
	"prenom" varchar(100) NOT NULL,
	"nom" varchar(100) NOT NULL,
	"date_naissance" date NOT NULL,
	"lieu_naissance" varchar(200),
	"sexe" varchar(1) NOT NULL,
	"adresse" text,
	"photo_url" text,
	"classe_id" uuid NOT NULL,
	"annee_scolaire_id" uuid NOT NULL,
	"statut" varchar(20) DEFAULT 'actif' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "eleves_matricule_unique" UNIQUE("matricule")
);
--> statement-breakpoint
CREATE TABLE "inscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"eleve_id" uuid NOT NULL,
	"classe_id" uuid NOT NULL,
	"annee_scolaire_id" uuid NOT NULL,
	"date_inscription" date DEFAULT now() NOT NULL,
	"montant_inscription" integer DEFAULT 0 NOT NULL,
	"statut" varchar(20) DEFAULT 'en_attente' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "parents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prenom" varchar(100) NOT NULL,
	"nom" varchar(100) NOT NULL,
	"telephone" varchar(20) NOT NULL,
	"telephone_2" varchar(20),
	"profession" varchar(100),
	"adresse" text,
	"relation" varchar(10) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "affectations_transport" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"eleve_id" uuid NOT NULL,
	"itineraire_id" uuid NOT NULL,
	"arret_id" uuid NOT NULL,
	"annee_scolaire_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "arrets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"itineraire_id" uuid NOT NULL,
	"nom" varchar(100) NOT NULL,
	"ordre" integer NOT NULL,
	"heure_passage" time
);
--> statement-breakpoint
CREATE TABLE "itineraires" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nom" varchar(100) NOT NULL,
	"vehicule_id" uuid,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "vehicules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"immatriculation" varchar(20) NOT NULL,
	"marque" varchar(100),
	"capacite" integer NOT NULL,
	"chauffeur_nom" varchar(100) NOT NULL,
	"chauffeur_tel" varchar(20) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "vehicules_immatriculation_unique" UNIQUE("immatriculation")
);
--> statement-breakpoint
ALTER TABLE "classes" ADD CONSTRAINT "classes_niveau_id_niveaux_id_fk" FOREIGN KEY ("niveau_id") REFERENCES "public"."niveaux"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classes" ADD CONSTRAINT "classes_annee_scolaire_id_annees_scolaires_id_fk" FOREIGN KEY ("annee_scolaire_id") REFERENCES "public"."annees_scolaires"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matieres" ADD CONSTRAINT "matieres_niveau_id_niveaux_id_fk" FOREIGN KEY ("niveau_id") REFERENCES "public"."niveaux"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "depenses" ADD CONSTRAINT "depenses_categorie_id_categories_depenses_id_fk" FOREIGN KEY ("categorie_id") REFERENCES "public"."categories_depenses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grille_frais" ADD CONSTRAINT "grille_frais_classe_id_classes_id_fk" FOREIGN KEY ("classe_id") REFERENCES "public"."classes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grille_frais" ADD CONSTRAINT "grille_frais_type_frais_id_types_frais_id_fk" FOREIGN KEY ("type_frais_id") REFERENCES "public"."types_frais"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grille_frais" ADD CONSTRAINT "grille_frais_annee_scolaire_id_annees_scolaires_id_fk" FOREIGN KEY ("annee_scolaire_id") REFERENCES "public"."annees_scolaires"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paiements" ADD CONSTRAINT "paiements_eleve_id_eleves_id_fk" FOREIGN KEY ("eleve_id") REFERENCES "public"."eleves"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paiements" ADD CONSTRAINT "paiements_type_frais_id_types_frais_id_fk" FOREIGN KEY ("type_frais_id") REFERENCES "public"."types_frais"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paiements" ADD CONSTRAINT "paiements_annee_scolaire_id_annees_scolaires_id_fk" FOREIGN KEY ("annee_scolaire_id") REFERENCES "public"."annees_scolaires"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recettes" ADD CONSTRAINT "recettes_categorie_id_categories_recettes_id_fk" FOREIGN KEY ("categorie_id") REFERENCES "public"."categories_recettes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bulletins_paie" ADD CONSTRAINT "bulletins_paie_employe_id_employes_id_fk" FOREIGN KEY ("employe_id") REFERENCES "public"."employes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eleve_parents" ADD CONSTRAINT "eleve_parents_eleve_id_eleves_id_fk" FOREIGN KEY ("eleve_id") REFERENCES "public"."eleves"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eleve_parents" ADD CONSTRAINT "eleve_parents_parent_id_parents_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."parents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eleves" ADD CONSTRAINT "eleves_classe_id_classes_id_fk" FOREIGN KEY ("classe_id") REFERENCES "public"."classes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eleves" ADD CONSTRAINT "eleves_annee_scolaire_id_annees_scolaires_id_fk" FOREIGN KEY ("annee_scolaire_id") REFERENCES "public"."annees_scolaires"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inscriptions" ADD CONSTRAINT "inscriptions_eleve_id_eleves_id_fk" FOREIGN KEY ("eleve_id") REFERENCES "public"."eleves"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inscriptions" ADD CONSTRAINT "inscriptions_classe_id_classes_id_fk" FOREIGN KEY ("classe_id") REFERENCES "public"."classes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inscriptions" ADD CONSTRAINT "inscriptions_annee_scolaire_id_annees_scolaires_id_fk" FOREIGN KEY ("annee_scolaire_id") REFERENCES "public"."annees_scolaires"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affectations_transport" ADD CONSTRAINT "affectations_transport_eleve_id_eleves_id_fk" FOREIGN KEY ("eleve_id") REFERENCES "public"."eleves"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affectations_transport" ADD CONSTRAINT "affectations_transport_itineraire_id_itineraires_id_fk" FOREIGN KEY ("itineraire_id") REFERENCES "public"."itineraires"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affectations_transport" ADD CONSTRAINT "affectations_transport_arret_id_arrets_id_fk" FOREIGN KEY ("arret_id") REFERENCES "public"."arrets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affectations_transport" ADD CONSTRAINT "affectations_transport_annee_scolaire_id_annees_scolaires_id_fk" FOREIGN KEY ("annee_scolaire_id") REFERENCES "public"."annees_scolaires"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arrets" ADD CONSTRAINT "arrets_itineraire_id_itineraires_id_fk" FOREIGN KEY ("itineraire_id") REFERENCES "public"."itineraires"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "itineraires" ADD CONSTRAINT "itineraires_vehicule_id_vehicules_id_fk" FOREIGN KEY ("vehicule_id") REFERENCES "public"."vehicules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "grille_frais_unique_idx" ON "grille_frais" USING btree ("classe_id","type_frais_id","annee_scolaire_id");--> statement-breakpoint
CREATE UNIQUE INDEX "paiements_unique_idx" ON "paiements" USING btree ("eleve_id","type_frais_id","annee_scolaire_id","mois");--> statement-breakpoint
CREATE UNIQUE INDEX "bulletins_paie_unique_idx" ON "bulletins_paie" USING btree ("employe_id","mois","annee");--> statement-breakpoint
CREATE UNIQUE INDEX "inscriptions_eleve_annee_idx" ON "inscriptions" USING btree ("eleve_id","annee_scolaire_id");--> statement-breakpoint
CREATE UNIQUE INDEX "affectations_transport_unique_idx" ON "affectations_transport" USING btree ("eleve_id","annee_scolaire_id");