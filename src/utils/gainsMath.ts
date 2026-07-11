import { Car, CarOwnerInfo, ReservationDetails, VehicleExpense } from '../types';
import {
  ConsignmentSummary,
  computeConsignmentSummary,
  estimateCommission,
  ownerDeliveryFee,
  reservationCommission,
} from './consignmentMath';

/**
 * GAINS — socle de calcul partagé par « Gains par véhicule » et « Rapports ».
 *
 * Les deux pages calculaient auparavant les mêmes agrégats chacune de leur côté,
 * et avaient fini par diverger : le rapport global comptait l'intégralité de
 * l'encaissé d'une conciergerie comme un gain de l'agence tant que la location
 * n'était pas clôturée, alors que la fiche véhicule ne comptait que la
 * commission. Une seule définition ici ⇒ plus de dérive possible.
 */

/** Pourcentage à une décimale, 0 quand la base est nulle (jamais de NaN/∞). */
export const pct = (part: number, whole: number): number => {
  const w = Number(whole) || 0;
  if (w <= 0) return 0;
  return Math.round(((Number(part) || 0) / w) * 1000) / 10;
};

/** Formate un pourcentage pour l'affichage : `12,5 %`. */
export const fmtPct = (value: number): string =>
  `${(Number(value) || 0).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`;

/** Partie YYYY-MM-DD d'une date ISO ou date-only. */
export const dateKey = (d: string): string => (d || '').substring(0, 10);

/** Date comprise dans [start, end] (bornes incluses), comparée en texte pour
 *  éviter les décalages de fuseau horaire. */
export const inRange = (dateStr: string, startDate: string, endDate: string): boolean => {
  if (!dateStr) return false;
  const d = dateKey(dateStr);
  return (!startDate || d >= startDate) && (!endDate || d <= endDate);
};

/**
 * Encaissé réel d'une location :
 *  1. somme des paiements enregistrés (inclut les sur-paiements) ;
 *  2. à défaut, total facturé − reste à payer.
 */
export const calcPaid = (r: ReservationDetails): number => {
  const payments = (r.payments || []) as any[];
  if (payments.length > 0) {
    const total = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    if (total > 0) return total;
  }
  return Math.max(0, (Number(r.totalPrice) || 0) - (Number(r.remainingPayment) || 0));
};

/** Location encore ouverte : ni clôturée, ni annulée (celle qui porte une dette). */
export const isOpenRental = (r: ReservationDetails): boolean =>
  !['completed', 'cancelled'].includes(r.status);

/** Le véhicule est-il confié par un tiers (avec un barème exploitable) ? */
export const isConsignmentCar = (car: Pick<Car, 'ownershipType' | 'ownerInfo'> | null | undefined): boolean =>
  car?.ownershipType === 'consignment' && !!car?.ownerInfo;

export interface VehicleGains {
  isConsignment: boolean;
  owner: CarOwnerInfo | null;

  /** Locations non annulées de la période. */
  rentals: number;
  cancelled: number;
  /** Jours loués cumulés (locations non annulées). */
  daysRented: number;

  /** Σ total_price des locations non annulées. */
  invoiced: number;
  /** Σ encaissé des locations non annulées. */
  collected: number;
  /** Σ reste à payer des locations encore ouvertes. */
  outstanding: number;
  /** Σ dépenses véhicule de la période. */
  expenses: number;

  /** Détail conciergerie (null pour un véhicule de l'agence). */
  consignment: ConsignmentSummary | null;

  /**
   * Revenu qui revient réellement à l'agence, AVANT dépenses.
   *  - véhicule agence      → tout l'encaissé ;
   *  - véhicule conciergerie → commission + livraison à charge du propriétaire,
   *    sur les locations clôturées (mêmes bornes que la vue DB).
   */
  agencyRevenue: number;
  /** Part à reverser au propriétaire (0 pour un véhicule de l'agence). */
  ownerPayout: number;
  /** agencyRevenue − expenses. */
  netBenefit: number;

  // ── Pourcentages ──────────────────────────────────────────────────────────
  /** Encaissé / facturé — taux de recouvrement. */
  collectionRate: number;
  /** Dépenses / revenu agence. */
  expenseRatio: number;
  /** Bénéfice net / revenu agence — marge. */
  margin: number;
  /** Part agence dans le CA clôturé (conciergerie uniquement). */
  agencyShare: number;
  /** Part propriétaire dans le CA clôturé (conciergerie uniquement). */
  ownerShare: number;
  /** Taux de commission RÉEL constaté = commission / CA clôturé. Peut différer
   *  du barème actuel : les commissions sont figées à la clôture. */
  effectiveCommissionRate: number;
}

/**
 * Agrège les gains d'UN véhicule sur un jeu de locations + dépenses déjà
 * filtrées sur la période.
 */
export const computeVehicleGains = (
  car: Pick<Car, 'ownershipType' | 'ownerInfo'> | null | undefined,
  reservations: ReservationDetails[],
  expenses: VehicleExpense[],
): VehicleGains => {
  const active = reservations.filter(r => r.status !== 'cancelled');
  const owner = car?.ownerInfo ?? null;
  const consignmentCar = isConsignmentCar(car);

  const invoiced = active.reduce((s, r) => s + (Number(r.totalPrice) || 0), 0);
  const collected = active.reduce((s, r) => s + calcPaid(r), 0);
  const outstanding = reservations
    .filter(isOpenRental)
    .reduce((s, r) => s + (Number(r.remainingPayment) || 0), 0);
  const expensesTotal = expenses.reduce((s, e) => s + (Number(e.cost) || 0), 0);
  const daysRented = active.reduce((s, r) => s + (Number(r.totalDays) || 0), 0);

  const consignment = consignmentCar && owner ? computeConsignmentSummary(active, owner) : null;

  const agencyRevenue = consignment ? consignment.agencyGain : collected;
  const ownerPayout = consignment ? consignment.ownerPayout : 0;
  const netBenefit = agencyRevenue - expensesTotal;

  return {
    isConsignment: consignmentCar,
    owner,
    rentals: active.length,
    cancelled: reservations.length - active.length,
    daysRented,
    invoiced,
    collected,
    outstanding,
    expenses: expensesTotal,
    consignment,
    agencyRevenue,
    ownerPayout,
    netBenefit,
    collectionRate: pct(collected, invoiced),
    expenseRatio: pct(expensesTotal, agencyRevenue),
    margin: pct(netBenefit, agencyRevenue),
    agencyShare: consignment ? pct(consignment.agencyGain, consignment.grossCompleted) : 100,
    ownerShare: consignment ? pct(consignment.ownerPayout, consignment.grossCompleted) : 0,
    effectiveCommissionRate: consignment
      ? pct(consignment.commissionEarned, consignment.grossCompleted)
      : 0,
  };
};

/** Ligne de gains d'un véhicule, pour les tableaux récapitulatifs multi-véhicules. */
export interface VehicleGainsRow {
  car: Car;
  gains: VehicleGains;
}

/** Agrège les gains de PLUSIEURS véhicules (locations/dépenses déjà filtrées). */
export const computeFleetGains = (
  cars: Car[],
  reservations: ReservationDetails[],
  expenses: VehicleExpense[],
): VehicleGainsRow[] =>
  cars.map(car => ({
    car,
    gains: computeVehicleGains(
      car,
      reservations.filter(r => (r.carId || r.car?.id) === car.id),
      expenses.filter(e => e.carId === car.id),
    ),
  }));

export interface FleetTotals {
  /** Revenu agence toutes voitures confondues (conciergerie déjà nettoyée). */
  agencyRevenue: number;
  /** Encaissé brut, part propriétaire incluse — trésorerie, pas un gain. */
  collected: number;
  invoiced: number;
  outstanding: number;
  /** Dépenses véhicules uniquement (les frais showroom s'ajoutent à part). */
  vehicleExpenses: number;
  ownerPayout: number;
  commissionEarned: number;
  ownerDeliveryFees: number;
  commissionPending: number;
  consignmentGross: number;
  consignmentCars: number;
  pendingRentals: number;
}

/** Totaux d'une flotte à partir des lignes calculées par `computeFleetGains`. */
export const sumFleetGains = (rows: VehicleGainsRow[]): FleetTotals => {
  const sum = (pick: (r: VehicleGainsRow) => number) => rows.reduce((s, r) => s + pick(r), 0);

  return {
    agencyRevenue: sum(r => r.gains.agencyRevenue),
    collected: sum(r => r.gains.collected),
    invoiced: sum(r => r.gains.invoiced),
    outstanding: sum(r => r.gains.outstanding),
    vehicleExpenses: sum(r => r.gains.expenses),
    ownerPayout: sum(r => r.gains.ownerPayout),
    commissionEarned: sum(r => r.gains.consignment?.commissionEarned ?? 0),
    ownerDeliveryFees: sum(r => r.gains.consignment?.ownerDeliveryFees ?? 0),
    commissionPending: sum(r => r.gains.consignment?.commissionPending ?? 0),
    consignmentGross: sum(r => r.gains.consignment?.grossCompleted ?? 0),
    consignmentCars: rows.filter(r => r.gains.isConsignment).length,
    pendingRentals: sum(r => r.gains.consignment?.pendingCount ?? 0),
  };
};

/** Détail du calcul de commission d'UNE location, prêt à afficher. */
export interface CommissionBreakdown {
  /** Base de calcul = total facturé de la location. */
  base: number;
  /** Commission retenue (snapshot figé si la location est clôturée). */
  commission: number;
  /** Livraison à charge du propriétaire (locations >= 10 jours). */
  ownerDelivery: number;
  /** Ce qui revient au propriétaire pour cette location. */
  ownerPart: number;
  /** Ce qui revient à l'agence pour cette location. */
  agencyPart: number;
  /** Taux effectif de cette location (commission / base). */
  rate: number;
  /** `true` quand la commission est figée en base (location clôturée). */
  locked: boolean;
  /** La commission diffère du barème actuel (barème modifié après clôture). */
  differsFromScale: boolean;
}

/** Décompose une location conciergerie : base → commission → part propriétaire. */
export const commissionBreakdown = (
  reservation: ReservationDetails,
  owner: Pick<CarOwnerInfo, 'commissionType' | 'commissionValue'>,
): CommissionBreakdown => {
  const base = Number(reservation.totalPrice) || 0;
  const commission = reservationCommission(reservation, owner);
  const ownerDelivery = ownerDeliveryFee(reservation);
  const locked = reservation.commissionAmount != null && reservation.commissionAmount > 0;

  return {
    base,
    commission,
    ownerDelivery,
    ownerPart: Math.max(0, base - commission - ownerDelivery),
    agencyPart: commission + ownerDelivery,
    rate: pct(commission, base),
    locked,
    differsFromScale: locked && Math.abs(commission - estimateCommission(reservation, owner)) > 0.5,
  };
};
