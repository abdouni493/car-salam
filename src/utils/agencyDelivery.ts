/**
 * Frais de livraison par AGENCE (aller / retour).
 *
 * Chaque agence porte deux montants :
 *   - « aller »  : facturé quand elle est l'agence de DÉPART de la location ;
 *   - « retour » : facturé quand elle est l'agence de RETOUR.
 * Même agence au départ et au retour → les deux montants de cette agence.
 *
 * Aucune colonne n'a été ajoutée en base :
 *   - les montants de l'agence vivent dans `services` (cf. DatabaseService
 *     .getAgencyDeliveryPrices) ;
 *   - les frais retenus pour une réservation sont deux lignes de
 *     `reservation_services` (catégorie `livraison`), écrites aussi bien par le
 *     planificateur que par la RPC `create_website_reservation` du site public.
 *   Le total de la réservation (`total_price`) les inclut déjà.
 */
import type { Agency } from '../types';

/** Catégorie des lignes `services` qui stockent les tarifs d'une agence. */
export const AGENCY_DELIVERY_CATEGORY = 'agency_delivery';
/** Catégorie des lignes `reservation_services` des frais de livraison. */
export const RESERVATION_DELIVERY_CATEGORY = 'livraison';

export type DeliveryLeg = 'aller' | 'retour';

export interface AgencyDeliverySelection {
  aller: { enabled: boolean; amount: number; agencyName?: string };
  retour: { enabled: boolean; amount: number; agencyName?: string };
}

const num = (v: unknown) => Math.max(0, Math.round(Number(v) || 0));

/** Tarifs proposés pour un couple agence de départ / agence de retour. */
export function defaultDeliveryForAgencies(
  agencies: Agency[],
  departureAgencyId?: string | null,
  returnAgencyId?: string | null,
): AgencyDeliverySelection {
  const dep = agencies.find(a => a.id === departureAgencyId);
  // Pas d'agence de retour distincte : on revient à l'agence de départ.
  const ret = agencies.find(a => a.id === (returnAgencyId || departureAgencyId));
  const aller = num(dep?.deliveryPriceAller);
  const retour = num(ret?.deliveryPriceRetour);
  return {
    aller: { enabled: aller > 0, amount: aller, agencyName: dep?.name },
    retour: { enabled: retour > 0, amount: retour, agencyName: ret?.name },
  };
}

/** Montant effectivement facturé (DA). */
export function deliverySelectionTotal(sel: AgencyDeliverySelection | null | undefined): number {
  if (!sel) return 0;
  return (sel.aller.enabled ? num(sel.aller.amount) : 0) + (sel.retour.enabled ? num(sel.retour.amount) : 0);
}

export const deliveryLegLabel = (leg: DeliveryLeg, lang: 'fr' | 'ar' | string = 'fr') =>
  lang === 'ar'
    ? (leg === 'aller' ? 'رسوم التوصيل (ذهاب)' : 'رسوم التوصيل (إياب)')
    : (leg === 'aller' ? 'Frais de livraison (aller)' : 'Frais de livraison (retour)');

/** Lignes `reservation_services` à enregistrer pour une sélection. */
export function deliverySelectionToServices(sel: AgencyDeliverySelection | null | undefined) {
  if (!sel) return [];
  const out: { category: string; service_name: string; description: string; price: number }[] = [];
  (['aller', 'retour'] as DeliveryLeg[]).forEach(leg => {
    const l = sel[leg];
    if (l.enabled && num(l.amount) > 0) {
      out.push({
        category: RESERVATION_DELIVERY_CATEGORY,
        service_name: deliveryLegLabel(leg) + (l.agencyName ? ` — ${l.agencyName}` : ''),
        description: leg,
        price: num(l.amount),
      });
    }
  });
  return out;
}

/** Une ligne de service (snapshot DB ou objet du wizard) est-elle un frais de livraison d'agence ? */
export const isAgencyDeliveryService = (s: any): boolean =>
  !!s && s.category === RESERVATION_DELIVERY_CATEGORY;

export interface ReservationDeliveryLine {
  leg: DeliveryLeg;
  label: string;
  amount: number;
}

/** Frais de livraison d'une réservation enregistrée, lus depuis ses services. */
export function getReservationDeliveryLines(services: any[] | null | undefined): ReservationDeliveryLine[] {
  return (services || [])
    .filter(isAgencyDeliveryService)
    .map(s => {
      const leg: DeliveryLeg = s.description === 'retour' ? 'retour' : 'aller';
      return {
        leg,
        label: s.service_name || s.name || deliveryLegLabel(leg),
        amount: num(s.price),
      };
    })
    .sort((a, b) => (a.leg === b.leg ? 0 : a.leg === 'aller' ? -1 : 1));
}

export const reservationDeliveryTotal = (services: any[] | null | undefined) =>
  getReservationDeliveryLines(services).reduce((sum, l) => sum + l.amount, 0);

/** Sélection reconstruite depuis les services d'une réservation déjà enregistrée. */
export function selectionFromServices(services: any[] | null | undefined): AgencyDeliverySelection {
  const lines = getReservationDeliveryLines(services);
  const pick = (leg: DeliveryLeg) => {
    const l = lines.find(x => x.leg === leg);
    const agencyName = l?.label.split(' — ')[1];
    return { enabled: !!l, amount: l?.amount ?? 0, agencyName };
  };
  return { aller: pick('aller'), retour: pick('retour') };
}
