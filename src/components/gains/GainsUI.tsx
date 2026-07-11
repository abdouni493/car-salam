import React from 'react';
import { motion } from 'motion/react';
import { Percent } from 'lucide-react';

/**
 * Briques d'affichage partagées par « Gains par véhicule » et « Rapports ».
 *
 * Les deux pages présentent les mêmes notions (revenu, commission, part du
 * propriétaire, marge) : elles doivent les présenter de la même façon, sinon le
 * même chiffre paraît différent d'un écran à l'autre.
 */

export type Tone = 'emerald' | 'rose' | 'amber' | 'slate' | 'indigo';

export const fmtDZD = (n: number): string => Math.round(Number(n) || 0).toLocaleString('fr-DZ');

export const fmtPctValue = (value: number): string =>
  `${(Number(value) || 0).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`;

const CHIP_TONES: Record<Tone, string> = {
  emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  rose:    'bg-rose-50 text-rose-700 ring-rose-200',
  amber:   'bg-amber-50 text-amber-700 ring-amber-200',
  slate:   'bg-slate-100 text-slate-600 ring-slate-200',
  indigo:  'bg-indigo-50 text-indigo-700 ring-indigo-200',
};

/** Pastille de pourcentage — « combien ça pèse » en un coup d'œil. */
export const PctChip: React.FC<{ value: number; tone?: Tone }> = ({ value, tone = 'slate' }) => (
  <span
    className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ring-1 ${CHIP_TONES[tone]}`}
  >
    <Percent size={9} strokeWidth={3} />
    {(Number(value) || 0).toLocaleString('fr-FR', { maximumFractionDigits: 1 })}
  </span>
);

export interface Segment {
  value: number;
  label: string;
  cls: string;
}

/** Barre de répartition empilée : la part de chacun, sans lire un seul chiffre. */
export const SplitBar: React.FC<{ segments: Segment[]; height?: string }> = ({
  segments,
  height = 'h-2.5',
}) => {
  const total = segments.reduce((s, x) => s + Math.max(0, x.value), 0);
  if (total <= 0) return null;
  return (
    <div className={`flex w-full overflow-hidden rounded-full bg-slate-100 ${height}`}>
      {segments.map((s, i) => (
        <motion.div
          key={i}
          initial={{ width: 0 }}
          animate={{ width: `${(Math.max(0, s.value) / total) * 100}%` }}
          transition={{ duration: 0.5, delay: i * 0.08 }}
          className={s.cls}
          title={`${s.label} — ${fmtDZD(s.value)} DZD`}
        />
      ))}
    </div>
  );
};

/** Légende d'une `SplitBar`. */
export const SplitLegend: React.FC<{
  items: { label: string; cls: string; pct: number; tone: Tone }[];
}> = ({ items }) => (
  <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5">
    {items.map(item => (
      <span key={item.label} className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
        <span className={`h-2.5 w-2.5 rounded-sm ${item.cls}`} />
        {item.label}
        <PctChip value={item.pct} tone={item.tone} />
      </span>
    ))}
  </div>
);

const TEXT_TONES: Record<Tone, string> = {
  emerald: 'text-emerald-700',
  rose:    'text-rose-700',
  amber:   'text-amber-700',
  slate:   'text-slate-900',
  indigo:  'text-indigo-700',
};

/**
 * Une ligne du détail de calcul : signe, libellé, formule littérale, poids en %
 * et montant. Empilées, elles reconstituent le calcul de bout en bout.
 */
export const CalcRow: React.FC<{
  sign?: '+' | '−' | '=';
  label: string;
  formula?: string;
  amount: number;
  share?: number;
  tone?: Tone;
  strong?: boolean;
}> = ({ sign, label, formula, amount, share, tone = 'slate', strong }) => (
  <div className={`flex items-center gap-3 py-2.5 ${strong ? 'border-t border-slate-200 pt-3' : ''}`}>
    <span
      className={`w-4 shrink-0 text-center font-bold tabular-nums ${strong ? 'text-slate-900' : 'text-slate-400'}`}
    >
      {sign}
    </span>
    <div className="min-w-0 flex-1">
      <p className={`truncate text-sm ${strong ? 'font-bold text-slate-900' : 'font-medium text-slate-600'}`}>
        {label}
      </p>
      {formula && (
        <p className="mt-0.5 truncate font-mono text-[11px] tabular-nums text-slate-400" dir="ltr">
          {formula}
        </p>
      )}
    </div>
    {share !== undefined && <PctChip value={share} tone={tone} />}
    <span
      className={`shrink-0 tabular-nums ${strong ? 'text-lg font-extrabold' : 'text-sm font-bold'} ${TEXT_TONES[tone]}`}
    >
      {fmtDZD(amount)}
      <span className="ml-1 text-[10px] font-semibold text-slate-400">DZD</span>
    </span>
  </div>
);

const CARD_TONES: Record<Tone, { ring: string; ico: string; val: string }> = {
  emerald: { ring: 'ring-emerald-100', ico: 'bg-emerald-50 text-emerald-600', val: 'text-emerald-700' },
  rose:    { ring: 'ring-rose-100',    ico: 'bg-rose-50 text-rose-600',       val: 'text-rose-700' },
  amber:   { ring: 'ring-amber-100',   ico: 'bg-amber-50 text-amber-600',     val: 'text-amber-700' },
  slate:   { ring: 'ring-slate-200',   ico: 'bg-slate-100 text-slate-600',    val: 'text-slate-800' },
  indigo:  { ring: 'ring-indigo-100',  ico: 'bg-indigo-50 text-indigo-600',   val: 'text-indigo-700' },
};

/** Carte KPI : un montant, et le pourcentage qui lui donne du sens. */
export const StatCard: React.FC<{
  label: string;
  value: number;
  hint?: string;
  share?: number;
  shareLabel?: string;
  tone: Tone;
  icon: React.ReactNode;
  index?: number;
}> = ({ label, value, hint, share, shareLabel, tone, icon, index = 0 }) => {
  const t = CARD_TONES[tone];
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className={`rounded-2xl bg-white p-4 shadow-sm ring-1 ${t.ring}`}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase leading-tight tracking-wide text-slate-500">{label}</p>
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${t.ico}`}>{icon}</div>
      </div>
      <p className={`text-2xl font-extrabold tabular-nums leading-none ${t.val}`}>
        {fmtDZD(value)}
        <span className="ml-1 text-xs font-semibold text-slate-400">DZD</span>
      </p>
      <div className="mt-2 flex items-center gap-1.5">
        {share !== undefined && <PctChip value={share} tone={tone} />}
        {(shareLabel || hint) && (
          <p className="truncate text-[11px] font-medium text-slate-400">{shareLabel || hint}</p>
        )}
      </div>
    </motion.div>
  );
};
