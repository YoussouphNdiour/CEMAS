CREATE TABLE "parametres_ecole" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"nom" varchar(150) NOT NULL,
	"sigle" varchar(30) NOT NULL,
	"adresse" varchar(255),
	"telephone1" varchar(30),
	"telephone2" varchar(30),
	"email" varchar(150),
	"contacts_entete" text,
	"prefixe_matricule" varchar(10) NOT NULL,
	"prefixe_recu" varchar(10) NOT NULL,
	"prefixe_employe" varchar(10) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "parametres_ecole_single_row" CHECK ("parametres_ecole"."id" = 1)
);
--> statement-breakpoint
INSERT INTO "parametres_ecole" ("id", "nom", "sigle", "adresse", "telephone1", "telephone2", "email", "contacts_entete", "prefixe_matricule", "prefixe_recu", "prefixe_employe")
VALUES (1, 'Complexe Educatif Mame Anta Sidibe', 'CEMAS', 'Quartier Zac Ba, Thies, Senegal', '77 300 08 31', NULL, 'admin@cemas.online', 'DG: M. Ndiour 77 300 08 31 | Dir. Elem.: M. Bass 77 521 37 19 | Dir. Presc.: Mme Cissokho 77 649 03 75', 'CEMAS', 'REC', 'EMP')
ON CONFLICT ("id") DO NOTHING;
