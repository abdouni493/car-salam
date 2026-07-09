import React from 'react';
import { Language } from '../types';
import { getDeliveryFeePayer, DELIVERY_OWNER_THRESHOLD_DAYS } from '../utils/deliveryFee';

interface DeliveryFeeFieldProps {
  lang: Language;
  value: number | '';
  onChange: (value: number | '') => void;
  /** Durée de la location, en jours — elle détermine le payeur. */
  totalDays: number;
}

/**
 * Champ « Frais de livraison » + bandeau informatif du payeur.
 *
 * Le payeur n'est pas modifiable : il découle de la durée de la location.
 * En dessous de 10 jours, la livraison est facturée au client et s'ajoute au
 * total ; à partir de 10 jours, elle est à la charge du propriétaire du
 * véhicule et n'est pas facturée (elle sera déduite de son reversement).
 *
 * La règle est également appliquée par un trigger en base, qui reste la source
 * de vérité pour `reservations.delivery_fee_payer`.
 */
export const DeliveryFeeField: React.FC<DeliveryFeeFieldProps> = ({ lang, value, onChange, totalDays }) => {
  const fee = value === '' ? 0 : value;
  const payer = getDeliveryFeePayer(totalDays);
  const isOwnerPaying = payer === 'owner';

  return (
    <div className="bg-sky-50 rounded-lg p-4 border border-sky-200 space-y-3">
      <label className="block text-sm font-bold text-sky-900">
        🚚 {lang === 'fr' ? 'Frais de livraison (DA)' : 'رسوم التوصيل (دج)'}
      </label>
      <input
        type="number"
        min={0}
        step={100}
        inputMode="decimal"
        dir="ltr"
        value={value === '' ? '' : value}
        onChange={e => {
          const raw = e.target.value.trim();
          if (raw === '') return onChange('');
          onChange(Math.max(0, Number(raw) || 0));
        }}
        placeholder="0"
        className="w-full p-2 border border-sky-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent font-bold"
      />

      {fee > 0 && (
        <div
          role="note"
          className={`rounded-lg px-4 py-3 border text-sm font-bold ${
            isOwnerPaying
              ? 'bg-green-50 border-green-300 text-green-900'
              : 'bg-blue-50 border-blue-300 text-blue-900'
          }`}
        >
          {isOwnerPaying ? (
            <>
              🟢 {lang === 'fr'
                ? `Frais de livraison à la charge du propriétaire du véhicule — location de ${totalDays} jours`
                : `رسوم التوصيل على عاتق مالك المركبة — كراء لمدة ${totalDays} يومًا`}
              <p className="font-medium mt-1 opacity-80">
                {lang === 'fr'
                  ? `À partir de ${DELIVERY_OWNER_THRESHOLD_DAYS} jours, ces frais ne sont pas facturés au client.`
                  : `ابتداءً من ${DELIVERY_OWNER_THRESHOLD_DAYS} أيام، لا تُفوتر هذه الرسوم على العميل.`}
              </p>
            </>
          ) : (
            <>
              🔵 {lang === 'fr'
                ? `Frais de livraison à la charge du locataire (client) — location de ${totalDays} jours`
                : `رسوم التوصيل على عاتق المستأجر (العميل) — كراء لمدة ${totalDays} يومًا`}
              <p className="font-medium mt-1 opacity-80">
                {lang === 'fr'
                  ? `Ajoutés au total : +${fee.toLocaleString()} DA`
                  : `تُضاف إلى الإجمالي: +${fee.toLocaleString()} دج`}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
};
