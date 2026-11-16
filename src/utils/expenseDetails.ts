import { ExpenseType, Language, VehicleExpense } from '../types';

/**
 * DÉPENSES VÉHICULE — libellés et détails partagés par la page
 * « Bénéfices par véhicule » et son rapport PDF.
 */

const TYPE_LABELS: Record<ExpenseType, { fr: string; ar: string }> = {
  vidange: { fr: 'Vidange', ar: 'تغيير الزيت' },
  assurance: { fr: 'Assurance', ar: 'التأمين' },
  controle: { fr: 'Contrôle technique', ar: 'الفحص التقني' },
  chaine: { fr: 'Chaîne de distribution', ar: 'سلسلة التوزيع' },
  autre: { fr: 'Autre', ar: 'أخرى' },
};

export const expenseTypeLabel = (type: string, lang: Language): string => {
  const l = TYPE_LABELS[type as ExpenseType];
  if (!l) return type || '—';
  return lang === 'fr' ? l.fr : l.ar;
};

/** Filtres changés lors d'une vidange, en libellés lisibles. */
export const expenseFilters = (e: VehicleExpense, lang: Language): string[] => {
  const T = (fr: string, ar: string) => (lang === 'fr' ? fr : ar);
  return [
    e.oilFilterChanged && T('Filtre à huile', 'فلتر الزيت'),
    e.airFilterChanged && T('Filtre à air', 'فلتر الهواء'),
    e.fuelFilterChanged && T('Filtre à carburant', 'فلتر الوقود'),
    e.acFilterChanged && T('Filtre climatisation', 'فلتر المكيف'),
  ].filter(Boolean) as string[];
};

export interface ExpenseDetailField {
  label: string;
  value: string;
}

/**
 * Tous les détails connus d'une dépense (hors montant/date/type, affichés à
 * part). Seuls les champs renseignés sont retournés.
 */
export const expenseDetailFields = (
  e: VehicleExpense,
  lang: Language,
  fmtDate: (d: string) => string,
): ExpenseDetailField[] => {
  const T = (fr: string, ar: string) => (lang === 'fr' ? fr : ar);
  const n = (v: number) => Math.round(Number(v) || 0).toLocaleString('fr-DZ');
  const out: ExpenseDetailField[] = [];
  if (e.expenseName) out.push({ label: T('Désignation', 'التسمية'), value: e.expenseName });
  if (e.currentMileage) out.push({ label: T('Kilométrage', 'المسافة'), value: `${n(e.currentMileage)} km` });
  if (e.nextVidangeKm) out.push({ label: T('Prochaine vidange', 'التغيير القادم'), value: `${n(e.nextVidangeKm)} km` });
  if (e.expirationDate) out.push({ label: T('Expiration', 'تاريخ الانتهاء'), value: fmtDate(e.expirationDate) });
  const filters = expenseFilters(e, lang);
  if (filters.length) out.push({ label: T('Filtres changés', 'الفلاتر المغيّرة'), value: filters.join(', ') });
  if (e.note) out.push({ label: T('Note', 'ملاحظة'), value: e.note });
  if (e.createdAt) out.push({ label: T('Enregistrée le', 'سُجّلت في'), value: fmtDate(e.createdAt) });
  return out;
};

export interface ExpenseTypeSummary {
  type: string;
  label: string;
  count: number;
  total: number;
}

/** Totaux par type de dépense, du plus coûteux au moins coûteux. */
export const summarizeExpensesByType = (
  expenses: VehicleExpense[],
  lang: Language,
): ExpenseTypeSummary[] => {
  const map = new Map<string, ExpenseTypeSummary>();
  for (const e of expenses) {
    const key = e.type || 'autre';
    const row = map.get(key) || { type: key, label: expenseTypeLabel(key, lang), count: 0, total: 0 };
    row.count += 1;
    row.total += Number(e.cost) || 0;
    map.set(key, row);
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
};
