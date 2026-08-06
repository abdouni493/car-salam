/**
 * Règle des frais de livraison.
 *
 * À partir du seuil de jours de location, la livraison est prise en charge par le
 * propriétaire du véhicule ; en dessous, elle est facturée au client.
 *
 * Le seuil vaut 10 jours par défaut, mais chaque véhicule en conciergerie peut
 * fixer le sien (`car_owners.delivery_threshold_days`).
 *
 * ⚠️ Cette règle est également appliquée par un trigger en base
 * (`set_delivery_fee_payer`), qui reste la source de vérité. Les helpers
 * ci-dessous servent à afficher le payeur en direct dans les formulaires,
 * avant l'enregistrement.
 */
export const DELIVERY_OWNER_THRESHOLD_DAYS = 10;

/** Montant par défaut des frais de livraison automatiques (DA). */
export const DELIVERY_DEFAULT_FEE_DZD = 300;

export type DeliveryFeePayer = 'client' | 'owner';

/** Normalise un seuil de jours (valeur positive), en retombant sur le défaut. */
export const resolveDeliveryThreshold = (thresholdDays?: number): number => {
  const n = Number(thresholdDays);
  return Number.isFinite(n) && n > 0 ? n : DELIVERY_OWNER_THRESHOLD_DAYS;
};

export const getDeliveryFeePayer = (
  totalDays: number,
  thresholdDays: number = DELIVERY_OWNER_THRESHOLD_DAYS,
): DeliveryFeePayer =>
  totalDays >= resolveDeliveryThreshold(thresholdDays) ? 'owner' : 'client';

/**
 * Les frais de livraison ne sont ajoutés au total facturé au client que
 * lorsqu'ils sont à sa charge (durée < seuil). Au-delà, ils sont déduits du
 * reversement au propriétaire et n'apparaissent pas sur sa facture.
 */
export const getClientDeliveryFee = (
  deliveryFee: number,
  totalDays: number,
  thresholdDays: number = DELIVERY_OWNER_THRESHOLD_DAYS,
): number =>
  deliveryFee > 0 && getDeliveryFeePayer(totalDays, thresholdDays) === 'client' ? deliveryFee : 0;
