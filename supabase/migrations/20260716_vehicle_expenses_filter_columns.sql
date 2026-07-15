-- ─────────────────────────────────────────────────────────────────────────────
-- Suivi des filtres changés lors d'une vidange.
--
-- Le modal « Dépense Véhicule » (type = vidange) propose quatre cases à cocher :
-- filtre à huile, filtre à air, filtre à carburant et filtre de climatisation.
-- Le front envoie ces quatre booléens à chaque enregistrement, mais la table
-- `vehicle_expenses` ne possédait pas les colonnes correspondantes.
--
-- Résultat : PostgREST rejetait l'INSERT avec l'erreur
--   PGRST204 — Could not find the 'ac_filter_changed' column of
--   'vehicle_expenses' in the schema cache
-- et AUCUNE dépense véhicule ne pouvait être enregistrée (maintenance,
-- bouton « Dépenses » d'une voiture, page Dépenses).
--
-- Cette migration ajoute les quatre colonnes (défaut = false, donc les lignes
-- existantes restent valides) puis force PostgREST à recharger son cache de
-- schéma pour que l'API les reconnaisse immédiatement.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.vehicle_expenses
  ADD COLUMN IF NOT EXISTS oil_filter_changed  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS air_filter_changed  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fuel_filter_changed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ac_filter_changed   boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.vehicle_expenses.oil_filter_changed  IS 'Vidange : filtre à huile remplacé.';
COMMENT ON COLUMN public.vehicle_expenses.air_filter_changed  IS 'Vidange : filtre à air remplacé.';
COMMENT ON COLUMN public.vehicle_expenses.fuel_filter_changed IS 'Vidange : filtre à carburant remplacé.';
COMMENT ON COLUMN public.vehicle_expenses.ac_filter_changed   IS 'Vidange : filtre de climatisation remplacé.';

-- Recharge immédiate du cache de schéma PostgREST (sinon l'API continue de
-- renvoyer PGRST204 jusqu'au prochain redémarrage automatique).
NOTIFY pgrst, 'reload schema';
