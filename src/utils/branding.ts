/**
 * BRANDING DU NAVIGATEUR — titre de l'onglet et favicon.
 *
 * Seule source : le nom et le logo de l'agence saisis dans Paramètres
 * (`website_settings`). Aucun nom de site n'est codé en dur.
 *
 * Le dernier branding appliqué est mis en cache dans localStorage : le script
 * inline d'`index.html` le relit avant le premier rendu, pour que l'onglet
 * affiche tout de suite le nom et le logo de l'agence (pas de titre générique
 * le temps que Supabase réponde).
 */

export const BRANDING_CACHE_KEY = 'salam:branding';

interface BrandingCache {
  name: string;
  /** Favicon prêt à l'emploi (PNG réduit en data URL, ou URL du logo). */
  icon: string;
}

const readCache = (): BrandingCache | null => {
  try {
    const raw = localStorage.getItem(BRANDING_CACHE_KEY);
    return raw ? (JSON.parse(raw) as BrandingCache) : null;
  } catch {
    return null;
  }
};

const writeCache = (cache: BrandingCache) => {
  try {
    localStorage.setItem(BRANDING_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Stockage plein ou bloqué : le branding reste appliqué pour cette session.
  }
};

/** Remplace toutes les icônes de la page par `href` (favicon + icône iOS). */
const setIcon = (href: string) => {
  document
    .querySelectorAll("link[rel='icon'], link[rel='shortcut icon'], link[rel='apple-touch-icon']")
    .forEach(l => l.parentNode?.removeChild(l));
  if (!href) return;
  for (const rel of ['icon', 'apple-touch-icon']) {
    const link = document.createElement('link');
    link.rel = rel;
    link.href = href;
    document.head.appendChild(link);
  }
};

/**
 * Réduit le logo en carré 64×64 (centré, proportions conservées) : un logo
 * importé peut peser plusieurs centaines de Ko, inutile comme favicon et trop
 * lourd pour le cache. Si l'image est sur un autre domaine sans CORS, le
 * canvas est « teinté » : on retombe sur l'URL d'origine.
 */
const toFavicon = (src: string): Promise<string> =>
  new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const size = 64;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx || !img.width || !img.height) return resolve(src);
        const scale = Math.min(size / img.width, size / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        resolve(canvas.toDataURL('image/png'));
      } catch {
        resolve(src);
      }
    };
    img.onerror = () => resolve(src);
    img.src = src;
  });

let lastLogo: string | null = null;

/** Applique le nom et le logo de l'agence à l'onglet du navigateur. */
export const applyBranding = async (settings: { name?: string | null; logo?: string | null } | null | undefined) => {
  if (typeof document === 'undefined' || !settings) return;
  const name = (settings.name || '').trim();
  const logo = (settings.logo || '').trim();
  // Réglages vides = base injoignable ou jamais remplie (getWebsiteSettings
  // renvoie alors un objet vide) : on garde le branding déjà affiché.
  if (!name && !logo) return;

  if (name) document.title = name;

  const cached = readCache();
  let icon = cached?.icon || '';
  if (logo !== lastLogo) {
    lastLogo = logo;
    icon = logo ? await toFavicon(logo) : '';
    setIcon(icon);
  }

  writeCache({ name: name || cached?.name || '', icon });
};
