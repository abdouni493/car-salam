import { ReservationDetails, CarOwnerInfo, CommissionType } from '../types';

/** Coerce une valeur brute de la DB vers un `CommissionType` connu. */
export const normalizeCommissionType = (raw: any): CommissionType =>
  raw === 'amount' ? 'amount' : raw === 'per_day' ? 'per_day' : 'percentage';

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
  const value = owner.commissionValue || 0;
  if (owner.commissionType === 'percentage') {
    const total = Number(reservation.totalPrice) || 0;
    return Math.round((total * value) / 100 * 100) / 100;
  }
  if (owner.commissionType === 'per_day') {
    // Commission par jour : montant fixe × nombre de jours loués (min. 1 jour).
    const days = Math.max(1, Number(reservation.totalDays) || 0);
    return Math.round(value * days * 100) / 100;
  }
  // 'amount' : commission fixe par location.
  return value;
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
  /** Gain total agence sur les locations TERMINÉES = commission + livraison propriétaire. */
  agencyGain: number;

  // ── Totaux SUR TOUTE LA PÉRIODE (terminées + en cours) ────────────────────
  // Ce que l'agence doit toucher pour ce véhicule sur la période sélectionnée,
  // sans attendre la clôture des locations. C'est la lecture attendue par la
  // page « Gains par véhicule ».
  /** CA de toutes les locations non annulées de la période. */
  grossAll: number;
  /** Commission de l'agence sur toutes les locations non annulées (figée + estimée). */
  commissionTotal: number;
  /** Frais de livraison propriétaire sur toutes les locations non annulées. */
  ownerDeliveryFeesAll: number;
  /** Gain total agence sur la période = commission + livraison propriétaire. */
  agencyGainTotal: number;
  /** À reverser au propriétaire sur la période = grossAll − commission − livraison. */
  ownerPayoutTotal: number;
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

  // Totaux « période » : mêmes formules, mais sur TOUTES les locations non
  // annulées (terminées + en cours), sans attendre la clôture.
  const grossPending = pending.reduce((s, r) => s + (Number(r.totalPrice) || 0), 0);
  const ownerDeliveryPending = pending.reduce((s, r) => s + ownerDeliveryFee(r), 0);
  const grossAll = grossCompleted + grossPending;
  const commissionTotal = commissionEarned + commissionPending;
  const ownerDeliveryFeesAll = ownerDeliveryFees + ownerDeliveryPending;

  return {
    completedCount: completed.length,
    grossCompleted,
    commissionEarned,
    ownerDeliveryFees,
    ownerPayout: grossCompleted - commissionEarned - ownerDeliveryFees,
    pendingCount: pending.length,
    commissionPending,
    agencyGain: commissionEarned + ownerDeliveryFees,
    grossAll,
    commissionTotal,
    ownerDeliveryFeesAll,
    agencyGainTotal: commissionTotal + ownerDeliveryFeesAll,
    ownerPayoutTotal: grossAll - commissionTotal - ownerDeliveryFeesAll,
  };
};
