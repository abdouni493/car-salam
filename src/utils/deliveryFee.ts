/**
 * Règle des frais de livraison.
 *
 * À partir de 10 jours de location, la livraison est prise en charge par le
 * propriétaire du véhicule ; en dessous, elle est facturée au client.
 *
 * ⚠️ Cette règle est également appliquée par un trigger en base
 * (`set_delivery_fee_payer`), qui reste la source de vérité. Les helpers
 * ci-dessous servent à afficher le payeur en direct dans les formulaires,
 * avant l'enregistrement.
 */
export const DELIVERY_OWNER_THRESHOLD_DAYS = 10;

export type DeliveryFeePayer = 'client' | 'owner';

export const getDeliveryFeePayer = (totalDays: number): DeliveryFeePayer =>
  totalDays >= DELIVERY_OWNER_THRESHOLD_DAYS ? 'owner' : 'client';

/**
 * Les frais de livraison ne sont ajoutés au total facturé au client que
 * lorsqu'ils sont à sa charge (< 10 jours). Au-delà, ils sont déduits du
 * reversement au propriétaire et n'apparaissent pas sur sa facture.
 */
export const getClientDeliveryFee = (deliveryFee: number, totalDays: number): number =>
  deliveryFee > 0 && getDeliveryFeePayer(totalDays) === 'client' ? deliveryFee : 0;
