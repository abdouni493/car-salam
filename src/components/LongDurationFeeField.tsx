import React from 'react';
import { Language } from '../types';
import {
  LONG_DURATION_THRESHOLD_DAYS,
  LONG_DURATION_FEE_DZD,
  isLongDuration,
} from '../utils/longDurationFee';

interface LongDurationFeeFieldProps {
  lang: Language;
  /** Montant en DA. 0 (ou '') ⇒ supplément désactivé. */
  value: number | '';
  onChange: (value: number | '') => void;
  /** Durée de la location, en jours. */
  totalDays: number;
  thresholdDays?: number;
  /** Montant proposé quand l'agence réactive le supplément. */
  defaultAmount?: number;
}

/**
 * Supplément « longue durée » : à partir de 10 jours, le client paie des frais
 * supplémentaires forfaitaires (3 000 DA par défaut) EN PLUS du prix de la
 * location. Activable/désactivable et librement modifiable ici ; le montant
 * retenu entre dans le total de la réservation.
 *
 * Sous le seuil, le bloc reste affiché mais grisé : il explique pourquoi rien
 * n'est facturé, plutôt que de disparaître sans laisser de trace.
 */
export const LongDurationFeeField: React.FC<LongDurationFeeFieldProps> = ({
  lang,
  value,
  onChange,
  totalDays,
  thresholdDays = LONG_DURATION_THRESHOLD_DAYS,
  defaultAmount = LONG_DURATION_FEE_DZD,
}) => {
  const fee = value === '' ? 0 : Number(value) || 0;
  const eligible = isLongDuration(totalDays, thresholdDays);
  const active = fee > 0;
  const billed = eligible && active;

  return (
    <div
      className={`rounded-lg p-4 border space-y-3 transition-colors ${
        billed ? 'bg-violet-50 border-violet-300' : 'bg-slate-50 border-slate-200'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className={`block text-sm font-bold ${billed ? 'text-violet-900' : 'text-slate-700'}`}>
          ➕ {lang === 'fr' ? 'Frais supplémentaires (longue durée)' : 'رسوم إضافية (مدة طويلة)'}
        </label>

        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={active}
            onChange={e => onChange(e.target.checked ? defaultAmount : 0)}
            disabled={!eligible}
            className="w-4 h-4 accent-violet-600 disabled:opacity-40"
          />
          <span className={`text-xs font-bold ${billed ? 'text-violet-800' : 'text-slate-500'}`}>
            {active
              ? (lang === 'fr' ? 'Activés' : 'مفعّلة')
              : (lang === 'fr' ? 'Désactivés' : 'معطّلة')}
          </span>
        </label>
      </div>

      <p className={`text-[11px] font-medium ${billed ? 'text-violet-700/80' : 'text-slate-500'}`}>
        {lang === 'fr'
          ? `Proposés automatiquement à partir de ${thresholdDays} jours de location. Facturés au client EN PLUS du prix de la location.`
          : `تُقترح تلقائيًا ابتداءً من ${thresholdDays} أيام كراء. تُفوتر على العميل زيادةً على سعر الكراء.`}
      </p>

      {eligible ? (
        <>
          {active && (
            <div className="relative">
              <input
                type="number"
                min={0}
                step={500}
                inputMode="decimal"
                dir="ltr"
                value={value === '' ? '' : value}
                onChange={e => {
                  const raw = e.target.value.trim();
                  if (raw === '') return onChange('');
                  onChange(Math.max(0, Number(raw) || 0));
                }}
                placeholder={String(defaultAmount)}
                className="w-full p-2 pe-12 border border-violet-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent font-bold"
              />
              <span className="absolute end-3 top-1/2 -translate-y-1/2 text-xs font-black text-violet-700">DA</span>
            </div>
          )}

          <div
            role="note"
            className={`rounded-lg px-4 py-3 border text-sm font-bold ${
              billed
                ? 'bg-violet-100 border-violet-300 text-violet-900'
                : 'bg-white border-slate-200 text-slate-500'
            }`}
          >
            {billed ? (
              <>
                🟣 {lang === 'fr'
                  ? `Location de ${totalDays} jours (≥ ${thresholdDays}) — supplément à la charge du client`
                  : `كراء ${totalDays} يومًا (≥ ${thresholdDays}) — الرسوم على عاتق العميل`}
                <p className="font-medium mt-1 opacity-80">
                  {lang === 'fr'
                    ? `Ajoutés au total : +${fee.toLocaleString('fr-DZ')} DA`
                    : `تُضاف إلى الإجمالي: +${fee.toLocaleString('fr-DZ')} دج`}
                </p>
              </>
            ) : (
              <>
                {lang === 'fr'
                  ? 'Supplément désactivé — rien n’est ajouté au total.'
                  : 'الرسوم معطّلة — لا يُضاف شيء إلى الإجمالي.'}
              </>
            )}
          </div>
        </>
      ) : (
        <p className="rounded-lg bg-white border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-500">
          {lang === 'fr'
            ? `Non applicable : la location dure ${totalDays} jour(s), le supplément démarre à ${thresholdDays} jours.`
            : `غير مطبّق: مدة الكراء ${totalDays} يوم، وتبدأ الرسوم من ${thresholdDays} أيام.`}
        </p>
      )}
    </div>
  );
};
