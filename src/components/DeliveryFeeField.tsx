import React from 'react';
import { Language } from '../types';
import {
  getDeliveryFeePayer,
  DELIVERY_OWNER_THRESHOLD_DAYS,
  DELIVERY_DEFAULT_FEE_DZD,
} from '../utils/deliveryFee';

interface DeliveryFeeFieldProps {
  lang: Language;
  value: number | '';
  onChange: (value: number | '') => void;
  /** Durée de la location, en jours — elle détermine le payeur. */
  totalDays: number;
  /** Seuil (jours) au-delà duquel la livraison passe à la charge du propriétaire. */
  thresholdDays?: number;
  /**
   * Présent pour un véhicule en conciergerie avec livraison automatique : affiche
   * une case « Activer / désactiver » et propose le montant configuré du véhicule.
   */
  autoConfig?: { amount: number } | null;
}

/**
 * Champ « Frais de livraison » + bandeau informatif du payeur.
 *
 * Le payeur n'est pas modifiable : il découle de la durée de la location. En
 * dessous du seuil, la livraison est facturée au client et s'ajoute au total ;
 * au-delà, elle est à la charge du propriétaire du véhicule et n'est pas facturée
 * (elle sera déduite de son reversement).
 *
 * Pour un véhicule en conciergerie, les frais sont pré-remplis automatiquement
 * (montant du véhicule) : l'agence peut les désactiver ou ajuster ici, au dernier
 * écran de création de réservation.
 *
 * La règle est également appliquée par un trigger en base, qui reste la source de
 * vérité pour `reservations.delivery_fee_payer`.
 */
export const DeliveryFeeField: React.FC<DeliveryFeeFieldProps> = ({
  lang,
  value,
  onChange,
  totalDays,
  thresholdDays = DELIVERY_OWNER_THRESHOLD_DAYS,
  autoConfig = null,
}) => {
  const fee = value === '' ? 0 : value;
  const payer = getDeliveryFeePayer(totalDays, thresholdDays);
  const isOwnerPaying = payer === 'owner';
  const active = fee > 0;

  const toggle = (on: boolean) =>
    onChange(on ? (autoConfig?.amount ?? DELIVERY_DEFAULT_FEE_DZD) : 0);

  return (
    <div className="bg-sky-50 rounded-lg p-4 border border-sky-200 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <label className="block text-sm font-bold text-sky-900">
          🚚 {lang === 'fr' ? 'Frais de livraison (DA)' : 'رسوم التوصيل (دج)'}
        </label>

        {autoConfig && (
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={active}
              onChange={e => toggle(e.target.checked)}
              className="w-4 h-4 accent-sky-600"
            />
            <span className="text-xs font-bold text-sky-800">
              {active
                ? (lang === 'fr' ? 'Activés' : 'مفعّلة')
                : (lang === 'fr' ? 'Désactivés' : 'معطّلة')}
            </span>
          </label>
        )}
      </div>

      {autoConfig && (
        <p className="text-[11px] font-medium text-sky-700/80">
          {lang === 'fr'
            ? `Ajoutés automatiquement à partir de ${thresholdDays} jours de location (véhicule en conciergerie).`
            : `تُضاف تلقائيًا ابتداءً من ${thresholdDays} أيام كراء (مركبة بالوكالة).`}
        </p>
      )}

      {/* Le montant reste masqué quand la livraison auto est désactivée. */}
      {(!autoConfig || active) && (
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
      )}

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
                  ? `À partir de ${thresholdDays} jours, ces frais ne sont pas facturés au client.`
                  : `ابتداءً من ${thresholdDays} أيام، لا تُفوتر هذه الرسوم على العميل.`}
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
