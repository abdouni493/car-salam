import React from 'react';
import { Language } from '../../types';

/**
 * Logo du site, tel qu'il apparaît dans la navbar.
 *
 * Le logo téléversé est un **wordmark large** (type "CAR SALAM", ratio ≈ 3:2),
 * pas une icône carrée : on le rend donc en `object-contain` à hauteur fixe et
 * largeur libre. L'ancienne navbar le posait en `object-cover` dans un carré de
 * 44 px, ce qui décapitait le lettrage et n'en montrait qu'une tranche centrale.
 *
 * Ce composant est partagé par la navbar publique ET l'aperçu des Paramètres du
 * site : l'aperçu de l'admin montre donc exactement ce que verra le visiteur.
 */
export const SiteLogo: React.FC<{
  logo?: string;
  name?: string;
  lang: Language;
  /** Hauteur du logo en px (navbar = 44). */
  height?: number;
  className?: string;
}> = ({ logo, name, lang, height = 44, className = '' }) => {
  const shortName = name ? name.split(/\s+/).slice(0, 3).join(' ') : 'Car Salam';

  // Un logo téléversé porte déjà le nom de l'agence : le répéter en texte à côté
  // ferait doublon. On l'expose donc aux lecteurs d'écran via l'alt, pas à l'œil.
  if (logo) {
    return (
      <img
        src={logo}
        alt={shortName}
        className={`w-auto object-contain ${className}`}
        style={{ height, maxWidth: 200 }}
        referrerPolicy="no-referrer"
      />
    );
  }

  // Repli sans logo : monogramme CS chrome sur bouclier rouge + nom.
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div
        className="flex items-center justify-center font-black shrink-0"
        style={{
          width: height,
          height,
          fontFamily: 'var(--font-display)',
          fontSize: height * 0.4,
          color: '#FFFFFF',
          background: 'linear-gradient(135deg, var(--color-vel-cta), var(--color-vel-cta-deep))',
          clipPath: 'polygon(50% 0%, 100% 18%, 100% 68%, 50% 100%, 0% 68%, 0% 18%)',
        }}
        aria-hidden="true"
      >
        CS
      </div>
      <div className="hidden sm:block leading-tight">
        <div className="font-black text-xl text-vel-ink" style={{ fontFamily: 'var(--font-display)' }}>
          {shortName}
        </div>
        <div
          className="text-[10px] font-bold tracking-[0.2em] uppercase text-vel-cta-bright"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {{ fr: 'Location de Voitures', ar: 'تأجير السيارات' }[lang]}
        </div>
      </div>
    </div>
  );
};
