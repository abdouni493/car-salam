import { Car } from '../types';

export type Currency = 'DZD' | 'EUR';

/** Taux de repli quand aucun taux n'est saisi (DA pour 1 €). */
export const DEFAULT_EUR_RATE = 145;

/** Un taux invalide (0, vide, négatif) ferait diverger toutes les conversions. */
export const safeRate = (rate: number | '' | null | undefined): number => {
  const n = Number(rate);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_EUR_RATE;
};

export const eurToDzd = (eur: number, rate: number | ''): number =>
  Math.round(eur * safeRate(rate));

export const dzdToEur = (dzd: number, rate: number | ''): number =>
  roundEur(dzd / safeRate(rate));

/** Les dinars s'affichent sans décimale, les euros au centime près. */
export const roundDzd = (n: number): number => Math.round(n);
export const roundEur = (n: number): number => Math.round(n * 100) / 100;
export const roundIn = (n: number, currency: Currency): number =>
  currency === 'EUR' ? roundEur(n) : roundDzd(n);

export const currencySymbol = (currency: Currency): string =>
  currency === 'EUR' ? '€' : 'DA';

export const formatMoney = (amount: number, currency: Currency): string => {
  const n = Number(amount) || 0;
  return currency === 'EUR'
    ? `${roundEur(n).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
    : `${roundDzd(n).toLocaleString('fr-FR')} DA`;
};

/** Convertit un montant DZD vers la devise demandée. */
export const fromDzd = (dzd: number, currency: Currency, rate: number | ''): number =>
  currency === 'EUR' ? dzdToEur(dzd, rate) : roundDzd(dzd);

/**
 * Convertit un montant exprimé dans `currency` vers le DZD (colonne de référence en base).
 *
 * Un aller-retour DZD → EUR → DZD n'est pas exact : l'euro est arrondi au centime,
 * donc `toDzd(fromDzd(x))` peut dériver de moins d'un centime converti (≈ 1 DA au
 * taux courant). C'est voulu : quand le client règle en euros, c'est le montant en
 * euros qui fait foi, et le DZD n'est que sa contre-valeur au taux convenu.
 */
export const toDzd = (amount: number, currency: Currency, rate: number | ''): number =>
  currency === 'EUR' ? eurToDzd(amount, rate) : roundDzd(amount);

type CarLike = Partial<Pick<Car,
  'priceDay' | 'priceWeek' | 'priceMonth' | 'deposit' |
  'priceDayEur' | 'priceWeekEur' | 'priceMonthEur' | 'depositEur'>> | null | undefined;

export interface UnitPrices {
  day: number;
  week: number;
  month: number;
  deposit: number;
}

/**
 * Tarifs d'un véhicule dans la devise demandée.
 *
 * Les tarifs EUR sont saisis librement par l'agence (ce ne sont pas forcément
 * les tarifs DZD convertis). Quand ils sont absents, on retombe sur la
 * conversion du tarif DZD au taux courant.
 */
export const carUnitPrices = (car: CarLike, currency: Currency, rate: number | ''): UnitPrices => {
  const day = Number(car?.priceDay) || 0;
  const week = Number(car?.priceWeek) || day * 7;
  const month = Number(car?.priceMonth) || day * 30;
  const deposit = Number(car?.deposit) || 0;

  if (currency === 'DZD') return { day, week, month, deposit };

  const dayEur = numOrNull(car?.priceDayEur) ?? dzdToEur(day, rate);
  return {
    day: dayEur,
    week: numOrNull(car?.priceWeekEur) ?? (numOrNull(car?.priceWeek) ? dzdToEur(week, rate) : roundEur(dayEur * 7)),
    month: numOrNull(car?.priceMonthEur) ?? (numOrNull(car?.priceMonth) ? dzdToEur(month, rate) : roundEur(dayEur * 30)),
    deposit: numOrNull(car?.depositEur) ?? dzdToEur(deposit, rate),
  };
};

/**
 * Tarifs euros d'un véhicule pour le site public, où aucune réservation n'existe
 * encore et donc aucun taux n'a été convenu : on réutilise le taux implicite des
 * tarifs de la fiche, à défaut le taux de repli.
 */
export const carPricesEur = (car: CarLike): UnitPrices =>
  carUnitPrices(car, 'EUR', impliedEurRate(car) ?? DEFAULT_EUR_RATE);

/** Taux DA/€ retenu pour un véhicule côté site public. */
export const carEurRate = (car: CarLike): number =>
  impliedEurRate(car) ?? DEFAULT_EUR_RATE;

/**
 * Taux DA/€ déduit des tarifs du véhicule, ou `null` si l'agence n'a saisi aucun
 * couple DZD/EUR exploitable.
 *
 * Quand l'agence fixe « 5 000 DA ou 35 € la journée », elle a implicitement
 * convenu d'un taux de 142,86 DA/€. Le réutiliser évite d'afficher un total euro
 * incohérent avec les tarifs annoncés sur la fiche du véhicule.
 *
 * On teste les paires du tarif le plus courant au plus rare ; un montant nul des
 * deux côtés (0 DA / 0 €) ne renseigne aucun taux et est donc ignoré.
 */
export const impliedEurRate = (car: CarLike): number | null => {
  const pairs: Array<[unknown, unknown]> = [
    [car?.priceDay, car?.priceDayEur],
    [car?.priceWeek, car?.priceWeekEur],
    [car?.priceMonth, car?.priceMonthEur],
    [car?.deposit, car?.depositEur],
  ];
  for (const [dzd, eur] of pairs) {
    const d = numOrNull(dzd);
    const e = numOrNull(eur);
    if (d !== null && e !== null && d > 0 && e > 0) {
      return Math.round((d / e) * 100) / 100;
    }
  }
  return null;
};

/** `0` est une valeur saisie légitime : seuls null/undefined/'' déclenchent le repli. */
const numOrNull = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Lit une colonne `*_eur` de la base : null/vide ⇒ undefined (tarif non défini). */
export const eurOrUndefined = (v: unknown): number | undefined => {
  const n = numOrNull(v);
  return n === null ? undefined : roundEur(n);
};
