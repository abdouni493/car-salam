/**
 * FRAIS SUPPLÉMENTAIRES « LONGUE DURÉE ».
 *
 * À partir de 10 jours de location, l'agence facture au client un supplément
 * forfaitaire (3 000 DA par défaut) EN PLUS du prix de la location. Le montant
 * est proposé automatiquement au dernier écran de création de réservation, où
 * l'agence peut le désactiver ou le modifier à la main.
 *
 * ⚠️ À ne pas confondre avec les frais de livraison (cf. `utils/deliveryFee`) :
 * ceux-là passent à la charge du PROPRIÉTAIRE au-delà du seuil, alors que ce
 * supplément est toujours facturé au CLIENT et s'ajoute au total.
 */

/** Durée (jours) à partir de laquelle le supplément est proposé. */
export const LONG_DURATION_THRESHOLD_DAYS = 10;

/** Montant par défaut du supplément longue durée (DA). */
export const LONG_DURATION_FEE_DZD = 3000;

/** La durée atteint-elle le seuil du supplément longue durée ? */
export const isLongDuration = (
  totalDays: number,
  thresholdDays: number = LONG_DURATION_THRESHOLD_DAYS,
): boolean => (Number(totalDays) || 0) >= Math.max(1, Number(thresholdDays) || LONG_DURATION_THRESHOLD_DAYS);

/**
 * Supplément réellement facturé au client : il n'est dû que si la durée atteint
 * le seuil. Repasser sous le seuil l'annule, même s'il avait été saisi.
 */
export const getClientLongDurationFee = (
  fee: number,
  totalDays: number,
  thresholdDays: number = LONG_DURATION_THRESHOLD_DAYS,
): number => {
  const amount = Math.max(0, Number(fee) || 0);
  return amount > 0 && isLongDuration(totalDays, thresholdDays) ? amount : 0;
};
