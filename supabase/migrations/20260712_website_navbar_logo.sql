-- ─────────────────────────────────────────────────────────────────────────────
-- Logo dédié à la barre de navigation du site public.
--
-- `website_settings.logo` sert déjà à DEUX usages qui n'ont pas les mêmes
-- contraintes : la barre latérale de l'admin et les documents imprimés
-- (contrats, factures) via getAgencyBranding(). Ces supports veulent un logo
-- compact, lisible sur fond CLAIR.
--
-- La navbar du site, elle, est noire et large : elle veut un wordmark étiré,
-- souvent en version claire/chrome. Forcer un seul fichier à servir les deux
-- obligeait à choisir lequel des deux rendus serait mauvais.
--
-- D'où cette colonne : `navbar_logo` est le logo affiché dans la navbar.
-- Vide → le site retombe sur `logo` (les installations existantes ne changent
-- pas de rendu tant qu'aucun logo de navbar n'a été téléversé).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.website_settings
  ADD COLUMN IF NOT EXISTS navbar_logo TEXT DEFAULT '';

COMMENT ON COLUMN public.website_settings.navbar_logo IS
  'Logo affiché dans la barre de navigation du site public (URL du bucket "website"). Vide = repli sur website_settings.logo.';
