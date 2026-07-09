import { ReservationDetails, CarOwnerInfo } from '../types';

/**
 * CONCIERGERIE — calculs partagés (admin uniquement).
 *
 * Miroir exact des règles côté base :
 *  - trigger `snapshot_reservation_commission` : à la clôture d'une location,
 *    commission = total_price × valeur/100 (percentage) ou montant fixe (amount),
 *    figée dans `reservations.commission_amount` ;
 *  - vue `consignment_earnings` :
 *      gross_revenue      = Σ total_price               (status = completed)
 *      agency_commission  = Σ commission_amount         (status = completed)
 *      owner_delivery_fees= Σ delivery_fee              (completed & payer = owner)
 *      owner_payout       = gross − commission − livraison propriétaire
 */

/** Commission théorique d'une location selon le barème actuel du propriétaire. */
export const estimateCommission = (
  reservation: ReservationDetails,
  owner: Pick<CarOwnerInfo, 'commissionType' | 'commissionValue'>
): number => {
  const total = Number(reservation.totalPrice) || 0;
  if (owner.commissionType === 'percentage') {
    return Math.round((total * (owner.commissionValue || 0)) / 100 * 100) / 100;
  }
  return owner.commissionValue || 0;
};

/**
 * Commission d'une location : snapshot figé en priorité (source de vérité,
 * identique à la DB), sinon estimation avec le barème actuel — utile pour les
 * locations pas encore clôturées ou antérieures à la migration.
 */
export const reservationCommission = (
  reservation: ReservationDetails,
  owner: Pick<CarOwnerInfo, 'commissionType' | 'commissionValue'>
): number => {
  if (reservation.commissionAmount != null && reservation.commissionAmount > 0) {
    return Number(reservation.commissionAmount);
  }
  return estimateCommission(reservation, owner);
};

/** Frais de livraison à la charge du propriétaire (locations >= 10 jours). */
export const ownerDeliveryFee = (reservation: ReservationDetails): number =>
  reservation.deliveryFeePayer === 'owner' ? Number(reservation.deliveryFee) || 0 : 0;

export interface ConsignmentSummary {
  /** Locations terminées (celles qui génèrent les montants figés). */
  completedCount: number;
  /** CA des locations terminées — même définition que `gross_revenue` en DB. */
  grossCompleted: number;
  /** Commission de l'agence sur les locations terminées. */
  commissionEarned: number;
  /** Frais de livraison pris en charge par le propriétaire (terminées). */
  ownerDeliveryFees: number;
  /** À reverser au propriétaire = gross − commission − livraison propriétaire. */
  ownerPayout: number;
  /** Locations en cours / confirmées / en attente (non annulées, non terminées). */
  pendingCount: number;
  /** Commission estimée sur ces locations à venir (barème actuel). */
  commissionPending: number;
  /** Gain total agence = commission + livraison propriétaire (terminées). */
  agencyGain: number;
}

/** Agrège les gains conciergerie d'UN véhicule sur un jeu de réservations. */
export const computeConsignmentSummary = (
  reservations: ReservationDetails[],
  owner: Pick<CarOwnerInfo, 'commissionType' | 'commissionValue'>
): ConsignmentSummary => {
  const completed = reservations.filter(r => r.status === 'completed');
  const pending = reservations.filter(r => !['completed', 'cancelled'].includes(r.status));

  const grossCompleted = completed.reduce((s, r) => s + (Number(r.totalPrice) || 0), 0);
  const commissionEarned = completed.reduce((s, r) => s + reservationCommission(r, owner), 0);
  const ownerDeliveryFees = completed.reduce((s, r) => s + ownerDeliveryFee(r), 0);
  const commissionPending = pending.reduce((s, r) => s + estimateCommission(r, owner), 0);

  return {
    completedCount: completed.length,
    grossCompleted,
    commissionEarned,
    ownerDeliveryFees,
    ownerPayout: grossCompleted - commissionEarned - ownerDeliveryFees,
    pendingCount: pending.length,
    commissionPending,
    agencyGain: commissionEarned + ownerDeliveryFees,
  };
};
