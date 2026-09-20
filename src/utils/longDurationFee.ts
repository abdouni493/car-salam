/**
 * FRAIS SUPPLÉMENTAIRES « LONGUE DURÉE » — À LA CHARGE DU PROPRIÉTAIRE.
 *
 * À partir de 10 jours de location, l'agence facture au PROPRIÉTAIRE d'un
 * véhicule en conciergerie un supplément forfaitaire (3 000 DA par défaut) pour
 * chaque location concernée. Ce supplément n'apparaît plus dans la création de
 * réservation (il n'est PLUS facturé au client) : il est proposé, désactivable
 * et modifiable dans la page « Bénéfices par véhicule », où il s'ajoute au
 * bénéfice de l'agence sur la période.
 *
 * ⚠️ Réservé aux véhicules en conciergerie : un véhicule de l'agence n'a pas de
 * propriétaire tiers à qui refacturer ce supplément.
 */

/** Durée (jours) à partir de laquelle le supplément est proposé. */
export const LONG_DURATION_THRESHOLD_DAYS = 10;

/** Montant par défaut du supplément longue durée (DA), à la charge du propriétaire. */
export const LONG_DURATION_FEE_DZD = 3000;

/** La durée atteint-elle le seuil du supplément longue durée ? */
export const isLongDuration = (
  totalDays: number,
  thresholdDays: number = LONG_DURATION_THRESHOLD_DAYS,
): boolean => (Number(totalDays) || 0) >= Math.max(1, Number(thresholdDays) || LONG_DURATION_THRESHOLD_DAYS);
