import React from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Language } from '../../../types';

// ─── Palette "Car Salam — noir & rouge sang" (voir design-system/car_salam/MASTER.md) ──
// `accent` est le rouge de TEXTE (AA en petit corps sur le noir) ;
// `gold` (nom historique) est le rouge de REMPLISSAGE des aplats et dégradés.
export const C = {
  accent:    'var(--color-vel-cta-bright)',
  gold:      'var(--color-vel-cta)',
  black:     '#FFFFFF',   // texte posé sur les aplats rouges (5.9:1)
  amber:     'var(--color-vel-cta-deep)',
  bg:        'var(--color-vel-void)',
  surface:   'var(--color-vel-surface)',
  elevated:  'var(--color-vel-elevated)',
};

export const ALGERIAN_WILAYAS = [
  '01 - Adrar','02 - Chlef','03 - Laghouat','04 - Oum El Bouaghi','05 - Batna',
  '06 - Béjaïa','07 - Biskra','08 - Béchar','09 - Blida','10 - Boumerdès',
  '11 - Teboussem','12 - Tlemcen','13 - Tiaret','14 - Tizi Ouzou','15 - Alger (urban)',
  '16 - Alger','17 - Sétif','18 - Saïda','19 - Skikda','20 - Sidi Bel Abbès',
  '21 - Annaba','22 - Guelma','23 - Constantine','24 - Médéa','25 - Mostaganem',
  "26 - M'sila",'27 - Mascara','28 - Ouargla','29 - Oran','30 - El Bayadh',
  '31 - Illizi','32 - Bordj Baji Mokhtar','33 - Ouled Djellal','34 - Béni Abbès',
  '35 - In Salah','36 - In Guezzam','37 - Touggourt','38 - Djanet',
];

// ─── Helpers dates locales (évite le décalage UTC de toISOString) ────────────
export const toYmd = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const fromYmd = (s: string): Date => {
  const [y, m, d] = s.substring(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
};

// ─── Styles d'inputs partagés ─────────────────────────────────────────────────
export const inputStyle: React.CSSProperties = {
  background: 'var(--color-vel-deep)',
  border: '1px solid var(--color-vel-border-strong)',
  color: 'var(--color-vel-ink)',
};
export const focusInput = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
  (e.target as HTMLElement).style.borderColor = 'var(--color-vel-cta)';
  (e.target as HTMLElement).style.boxShadow = '0 0 0 3px rgba(200, 16, 46, 0.22)';
};
export const blurInput = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
  (e.target as HTMLElement).style.borderColor = 'var(--color-vel-border-strong)';
  (e.target as HTMLElement).style.boxShadow = 'none';
};

export const inputClass = 'w-full px-4 py-3 rounded-xl outline-none transition-all font-medium placeholder:text-vel-dim';

// ─── Section card wrapper ─────────────────────────────────────────────────────
export const SectionCard: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div
    className={`rounded-2xl p-6 sm:p-8 space-y-6 ${className}`}
    style={{
      background: C.surface,
      border: '1px solid var(--color-vel-border)',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 12px 32px rgba(0,0,0,0.5)',
    }}
  >
    {children}
  </div>
);

export const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h2 className="text-xl font-black text-vel-ink flex items-center gap-2" style={{ fontFamily: 'var(--font-display)' }}>
    {children}
  </h2>
);

export const FieldLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <label className="block text-xs font-bold text-vel-muted mb-2 uppercase tracking-wider" style={{ fontFamily: 'var(--font-display)' }}>
    {children}
  </label>
);

// ─── Boutons Précédent / Suivant ──────────────────────────────────────────────
export function NavButtons({ onBack, onNext, backLabel, nextLabel, nextDisabled = false, lang }: {
  onBack?: () => void;
  onNext: () => void;
  backLabel?: string;
  nextLabel?: string;
  nextDisabled?: boolean;
  lang: Language;
}) {
  return (
    <div className="flex gap-4 pt-2">
      {onBack && (
        <button
          onClick={onBack}
          className="btn-vel-ghost flex-1 py-4 flex items-center justify-center gap-2 text-sm font-bold"
        >
          <ChevronLeft size={18} /> {backLabel || { fr: 'Précédent', ar: 'السابق' }[lang]}
        </button>
      )}
      <motion.button
        onClick={onNext}
        disabled={nextDisabled}
        whileHover={nextDisabled ? {} : { scale: 1.02 }}
        whileTap={nextDisabled ? {} : { scale: 0.98 }}
        className={`btn-vel-cta flex-1 py-4 flex items-center justify-center gap-2 text-sm ${nextDisabled ? 'opacity-40 cursor-not-allowed' : ''}`}
      >
        {nextLabel || { fr: 'Suivant', ar: 'التالي' }[lang]} <ChevronRight size={18} />
      </motion.button>
    </div>
  );
}
