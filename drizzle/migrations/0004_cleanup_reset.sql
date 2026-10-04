-- Nettoyage complet : supprimer toutes les données 2024-2025 et 2025-2026
-- Ordre respectant les contraintes FK (enfants d'abord, parents ensuite)

-- 1. Paiements
DELETE FROM paiements WHERE annee_scolaire_id IN (
  SELECT id FROM annees_scolaires WHERE libelle IN ('2025-2026', '2024 - 2025', '2024-2025')
);--> statement-breakpoint

-- 2. Affectations transport
DELETE FROM affectations_transport WHERE annee_scolaire_id IN (
  SELECT id FROM annees_scolaires WHERE libelle IN ('2025-2026', '2024 - 2025', '2024-2025')
);--> statement-breakpoint

-- 3. Inscriptions
DELETE FROM inscriptions WHERE annee_scolaire_id IN (
  SELECT id FROM annees_scolaires WHERE libelle IN ('2025-2026', '2024 - 2025', '2024-2025')
);--> statement-breakpoint

-- 4. Liens eleve-parent
DELETE FROM eleve_parents WHERE eleve_id IN (
  SELECT id FROM eleves WHERE annee_scolaire_id IN (
    SELECT id FROM annees_scolaires WHERE libelle IN ('2025-2026', '2024 - 2025', '2024-2025')
  )
);--> statement-breakpoint

-- 5. Eleves
DELETE FROM eleves WHERE annee_scolaire_id IN (
  SELECT id FROM annees_scolaires WHERE libelle IN ('2025-2026', '2024 - 2025', '2024-2025')
);--> statement-breakpoint

-- 6. Parents orphelins
DELETE FROM parents WHERE id NOT IN (SELECT parent_id FROM eleve_parents);--> statement-breakpoint

-- 7. Grille de frais
DELETE FROM grille_frais WHERE annee_scolaire_id IN (
  SELECT id FROM annees_scolaires WHERE libelle IN ('2025-2026', '2024 - 2025', '2024-2025')
);--> statement-breakpoint

-- 8. Depenses et recettes (toutes)
DELETE FROM depenses;--> statement-breakpoint
DELETE FROM recettes;--> statement-breakpoint

-- 9. Bulletins de paie (tous)
DELETE FROM bulletins_paie;--> statement-breakpoint

-- 10. Classes
DELETE FROM classes WHERE annee_scolaire_id IN (
  SELECT id FROM annees_scolaires WHERE libelle IN ('2025-2026', '2024 - 2025', '2024-2025')
);--> statement-breakpoint

-- 11. Supprimer les annees scolaires
DELETE FROM annees_scolaires WHERE libelle IN ('2025-2026', '2024 - 2025', '2024-2025');
