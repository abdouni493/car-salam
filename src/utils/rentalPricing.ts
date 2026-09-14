/**
 * TARIFICATION D'UNE LOCATION — décomposition mois / semaines / jours.
 *
 * L'ancien calcul ne savait facturer qu'au forfait hebdomadaire : le tarif
 * mensuel de la fiche véhicule n'était utilisé que pour une durée EXACTEMENT
 * égale à 30 jours. Une location de 31 jours repassait donc à
 * `4 semaines + 3 jours`, soit largement plus cher que le mois — et un client
 * qui louait 13 jours payait `1 semaine + 6 jours`, parfois plus cher que
 * deux semaines.
 *
 * Règle appliquée ici : on décompose la durée en mois (30 j), puis semaines
 * (7 j), puis jours, et on « remonte » tout reliquat qui coûterait plus cher
 * que le forfait supérieur. Le client ne paie jamais plus que le forfait
 * immédiatement supérieur.
 */

export const DAYS_PER_WEEK = 7;
export const DAYS_PER_MONTH = 30;

export interface RentalUnitPrices {
  day: number;
  week: number;
  month: number;
}

export interface RentalPriceBreakdown {
  /** Durée retenue (jamais négative, arrondie au jour). */
  totalDays: number;
  months: number;
  weeks: number;
  days: number;
  monthsPrice: number;
  weeksPrice: number;
  daysPrice: number;
  /** Somme des trois lignes ci-dessus. */
  total: number;
}

const EMPTY: RentalPriceBreakdown = {
  totalDays: 0, months: 0, weeks: 0, days: 0,
  monthsPrice: 0, weeksPrice: 0, daysPrice: 0, total: 0,
};

/** Tarif positif, ou repli sur le forfait inférieur quand la fiche est vide. */
const resolveUnits = (unit: Partial<RentalUnitPrices> | null | undefined): RentalUnitPrices => {
  const day = Math.max(0, Number(unit?.day) || 0);
  const week = Number(unit?.week) > 0 ? Number(unit!.week) : day * DAYS_PER_WEEK;
  const month = Number(unit?.month) > 0 ? Number(unit!.month) : week * 4;
  return { day, week, month };
};

/**
 * Décompose une durée en forfaits et calcule le prix de base du véhicule.
 * Le résultat est exprimé dans la devise des tarifs fournis.
 */
export const computeRentalBasePrice = (
  totalDays: number,
  unit: Partial<RentalUnitPrices> | null | undefined,
): RentalPriceBreakdown => {
  const d = Math.max(0, Math.round(Number(totalDays) || 0));
  if (d <= 0) return EMPTY;

  const { day, week, month } = resolveUnits(unit);

  let months = Math.floor(d / DAYS_PER_MONTH);
  let rest = d - months * DAYS_PER_MONTH;
  let weeks = Math.floor(rest / DAYS_PER_WEEK);
  let days = rest - weeks * DAYS_PER_WEEK;

  // Un reliquat de jours plus cher qu'une semaine est facturé à la semaine.
  if (week > 0 && days * day > week) {
    weeks += 1;
    days = 0;
  }
  // Idem d'un cran au-dessus : ce qui dépasse le prix du mois devient un mois.
  if (month > 0 && weeks * week + days * day > month) {
    months += 1;
    weeks = 0;
    days = 0;
  }

  const monthsPrice = months * month;
  const weeksPrice = weeks * week;
  const daysPrice = days * day;

  return {
    totalDays: d,
    months, weeks, days,
    monthsPrice, weeksPrice, daysPrice,
    total: monthsPrice + weeksPrice + daysPrice,
  };
};

/** Libellé lisible de la décomposition : « 1 mois + 2 semaines + 3 jours ». */
export const describeRentalBreakdown = (
  b: RentalPriceBreakdown,
  lang: 'fr' | 'ar' = 'fr',
): string => {
  const parts: string[] = [];
  const L = (fr: string, ar: string) => (lang === 'fr' ? fr : ar);
  if (b.months > 0) parts.push(`${b.months} ${L(b.months > 1 ? 'mois' : 'mois', 'شهر')}`);
  if (b.weeks > 0) parts.push(`${b.weeks} ${L(b.weeks > 1 ? 'semaines' : 'semaine', 'أسبوع')}`);
  if (b.days > 0) parts.push(`${b.days} ${L(b.days > 1 ? 'jours' : 'jour', 'يوم')}`);
  return parts.join(' + ') || `0 ${L('jour', 'يوم')}`;
};
