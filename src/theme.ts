import { useEffect, useState } from 'react';

/**
 * Thème du back-office.
 *
 * - `carbon` : la peau noir & rouge du site public (cf. src/styles/theme-carbon.css).
 *              C'est le DÉFAUT : le back-office est carbone tant que l'utilisateur
 *              n'a pas demandé le clair.
 * - `light`  : le SaaS clair d'origine, désormais opt-in via le bouton de la navbar.
 *
 * Le thème vit sur <html data-admin-theme>, pas dans un contexte React : la
 * feuille de style fait tout le travail, donc aucun composant n'a besoin de
 * connaître la couleur courante — seul le bouton de la navbar la lit.
 */
export type AdminTheme = 'light' | 'carbon';

const STORAGE_KEY = 'salam:admin-theme';
export const ADMIN_THEME_EVENT = 'salam:admin-theme-change';

// Seul 'light' explicitement stocké fait sortir du carbone : une valeur absente
// (première visite) ou corrompue retombe sur le thème de la marque.
const readStoredTheme = (): AdminTheme => {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'carbon';
  } catch {
    // Mode privé / stockage bloqué : on reste en carbone.
    return 'carbon';
  }
};

export const getAdminTheme = (): AdminTheme =>
  document.documentElement.dataset.adminTheme === 'carbon' ? 'carbon' : 'light';

export const setAdminTheme = (theme: AdminTheme) => {
  document.documentElement.dataset.adminTheme = theme;
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* le thème reste appliqué pour la session, il ne survivra pas au rechargement */
  }
  window.dispatchEvent(new CustomEvent(ADMIN_THEME_EVENT, { detail: theme }));
};

export const toggleAdminTheme = () =>
  setAdminTheme(getAdminTheme() === 'carbon' ? 'light' : 'carbon');

// Filet de sécurité : index.html pose déjà l'attribut avant le premier pixel.
// Ici on ne fait que garantir l'invariant si le script inline saute (page de
// test, autre point d'entrée) — l'opération est idempotente.
document.documentElement.dataset.adminTheme = readStoredTheme();

/** Rend le composant à chaque bascule (pour l'icône et le libellé du bouton). */
export const useAdminTheme = (): [AdminTheme, () => void] => {
  const [theme, setTheme] = useState<AdminTheme>(getAdminTheme);

  useEffect(() => {
    const sync = () => setTheme(getAdminTheme());
    window.addEventListener(ADMIN_THEME_EVENT, sync);
    return () => window.removeEventListener(ADMIN_THEME_EVENT, sync);
  }, []);

  return [theme, toggleAdminTheme];
};
