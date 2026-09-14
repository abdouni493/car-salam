import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, X } from 'lucide-react';

/**
 * Les trois chiffres qui résument un véhicule — gains, dépenses, bénéfice — et
 * le tiroir qui montre d'où ils viennent.
 *
 * Chaque carte est un bouton : un total sans son détail se discute, un total
 * qu'on peut ouvrir se vérifie.
 */

export type BenefitTone = 'gain' | 'expense' | 'net' | 'netNegative';

const TONES: Record<BenefitTone, { card: string; label: string; value: string; icon: string; cta: string }> = {
  gain: {
    card: 'bg-gradient-to-br from-teal-500 to-emerald-600 ring-teal-300/40',
    label: 'text-teal-50/80',
    value: 'text-white',
    icon: 'bg-white/15 text-white',
    cta: 'text-teal-50/70 group-hover:text-white',
  },
  expense: {
    card: 'bg-gradient-to-br from-rose-500 to-rose-700 ring-rose-300/40',
    label: 'text-rose-50/80',
    value: 'text-white',
    icon: 'bg-white/15 text-white',
    cta: 'text-rose-50/70 group-hover:text-white',
  },
  net: {
    card: 'bg-gradient-to-br from-slate-800 to-slate-900 ring-slate-500/30',
    label: 'text-slate-400',
    value: 'text-emerald-300',
    icon: 'bg-white/10 text-emerald-300',
    cta: 'text-slate-400 group-hover:text-white',
  },
  netNegative: {
    card: 'bg-gradient-to-br from-slate-800 to-slate-900 ring-slate-500/30',
    label: 'text-slate-400',
    value: 'text-rose-300',
    icon: 'bg-white/10 text-rose-300',
    cta: 'text-slate-400 group-hover:text-white',
  },
};

const fmt = (n: number) => Math.round(Number(n) || 0).toLocaleString('fr-DZ');

export interface BenefitCardProps {
  label: string;
  value: number;
  hint?: string;
  formula?: string;
  tone: BenefitTone;
  icon: React.ReactNode;
  detailLabel: string;
  onOpen: () => void;
  index?: number;
}

export const BenefitCard: React.FC<BenefitCardProps> = ({
  label, value, hint, formula, tone, icon, detailLabel, onOpen, index = 0,
}) => {
  const t = TONES[tone];
  return (
    <motion.button
      type="button"
      onClick={onOpen}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07 }}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.99 }}
      className={`group relative w-full overflow-hidden rounded-3xl p-5 text-start shadow-lg ring-1 transition ${t.card}`}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 85% 12%, #fff 0, transparent 48%)',
        }}
      />
      <div className="relative">
        <div className="mb-4 flex items-start justify-between gap-3">
          <p className={`text-[11px] font-bold uppercase leading-snug tracking-wider ${t.label}`}>{label}</p>
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${t.icon}`}>{icon}</span>
        </div>

        <p className={`text-3xl font-black tabular-nums leading-none ${t.value}`}>
          {value < 0 ? '−' : ''}{fmt(Math.abs(value))}
          <span className="ms-1.5 text-sm font-bold opacity-60">DA</span>
        </p>

        {hint && <p className={`mt-2 text-[11px] font-semibold ${t.label}`}>{hint}</p>}
        {formula && (
          <p className={`mt-1 font-mono text-[10px] tabular-nums ${t.label}`} dir="ltr">{formula}</p>
        )}

        <span className={`mt-4 flex items-center gap-1 text-[11px] font-bold transition ${t.cta}`}>
          {detailLabel}
          <ChevronRight size={13} className="transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </motion.button>
  );
};

/** Tiroir de détail d'une carte — plein écran sur mobile, latéral sur desktop. */
export const BenefitDrawer: React.FC<{
  open: boolean;
  title: string;
  subtitle?: string;
  accent: 'teal' | 'rose' | 'slate';
  onClose: () => void;
  children: React.ReactNode;
}> = ({ open, title, subtitle, accent, onClose, children }) => {
  const head =
    accent === 'teal' ? 'bg-gradient-to-r from-teal-600 to-emerald-600'
    : accent === 'rose' ? 'bg-gradient-to-r from-rose-600 to-rose-700'
    : 'bg-gradient-to-r from-slate-800 to-slate-900';

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/50 backdrop-blur-sm sm:items-center sm:p-6"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 40, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', damping: 26, stiffness: 260 }}
            onClick={e => e.stopPropagation()}
            className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
          >
            <div className={`flex items-start justify-between gap-4 px-6 py-5 text-white ${head}`}>
              <div className="min-w-0">
                <h3 className="text-lg font-extrabold leading-tight">{title}</h3>
                {subtitle && <p className="mt-0.5 text-xs font-medium text-white/75">{subtitle}</p>}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="shrink-0 rounded-xl bg-white/15 p-2 transition hover:bg-white/25"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
