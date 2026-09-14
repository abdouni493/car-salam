import { Car, Language, ReservationDetails, VehicleExpense } from '../../types';
import { VehicleGains, calcPaid, commissionBreakdown } from '../../utils/gainsMath';

/**
 * RAPPORT « BÉNÉFICES PAR VÉHICULE » — document imprimable / PDF.
 *
 * Reprend exactement les agrégats de `computeVehicleGains` (aucun calcul n'est
 * refait ici) et les met en page : en-tête agence + logo, fiche propriétaire
 * pour un véhicule en conciergerie, fiche véhicule, liste des locations avec le
 * détail de la commission ligne à ligne, liste des dépenses, puis le calcul du
 * bénéfice de bout en bout.
 */

const T = (fr: string, ar: string, lang: Language) => (lang === 'fr' ? fr : ar);

const esc = (v: any): string =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** Latin/chiffres forcés en LTR : sans cela une plaque s'inverse en arabe. */
const ltr = (v: any): string =>
  `<span style="unicode-bidi:bidi-override;direction:ltr;display:inline-block">${esc(v)}</span>`;

export interface VehicleBenefitReportInput {
  car: Car;
  gains: VehicleGains;
  reservations: ReservationDetails[];
  expenses: VehicleExpense[];
  startDate: string;
  endDate: string;
  agency: any;
  lang: Language;
}

const STATUS_LABEL: Record<string, { fr: string; ar: string }> = {
  pending: { fr: 'En attente', ar: 'قيد الانتظار' },
  accepted: { fr: 'Acceptée', ar: 'مقبول' },
  confirmed: { fr: 'Confirmée', ar: 'مؤكد' },
  active: { fr: 'En cours', ar: 'جارية' },
  completed: { fr: 'Terminée', ar: 'منتهية' },
  cancelled: { fr: 'Annulée', ar: 'ملغاة' },
};

export const generateVehicleBenefitReportHTML = ({
  car, gains, reservations, expenses, startDate, endDate, agency, lang,
}: VehicleBenefitReportInput): string => {
  const isFrench = lang === 'fr';
  const dir = isFrench ? 'ltr' : 'rtl';
  const align = isFrench ? 'right' : 'left';

  const fmt = (n: number) => Math.round(Number(n) || 0).toLocaleString('fr-DZ');
  const fmtD = (d: string) => {
    if (!d) return '—';
    try {
      return new Date(d).toLocaleDateString(isFrench ? 'fr-FR' : 'ar-DZ');
    } catch {
      return d;
    }
  };
  const pctTxt = (v: number) =>
    `${(Number(v) || 0).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`;

  const owner = gains.owner;
  const c = gains.consignment;
  const isConsignment = gains.isConsignment && !!owner && !!c;

  const scaleLabel = owner
    ? owner.commissionType === 'percentage'
      ? `${owner.commissionValue.toLocaleString('fr-FR')} %`
      : owner.commissionType === 'per_day'
        ? `${fmt(owner.commissionValue)} ${T('DA / jour loué', 'دج / يوم كراء', lang)}`
        : `${fmt(owner.commissionValue)} ${T('DA par location', 'دج لكل إيجار', lang)}`
    : '';

  const activeCount = reservations.filter(r => r.status !== 'cancelled').length;

  // ── Lignes du tableau des locations ──────────────────────────────────────
  const resRows = reservations.map((r, i) => {
    const paid = calcPaid(r);
    const total = Number(r.totalPrice) || 0;
    const cancelled = r.status === 'cancelled';
    const cb = owner && !cancelled ? commissionBreakdown(r, owner) : null;
    const st = STATUS_LABEL[r.status] || STATUS_LABEL.pending;
    return `
      <tr class="${cancelled ? 'row-muted' : ''}">
        <td class="num">${i + 1}</td>
        <td>${esc(`${r.client?.firstName || ''} ${r.client?.lastName || ''}`.trim() || '—')}</td>
        <td class="nowrap">${ltr(fmtD(r.step1?.departureDate))}</td>
        <td class="nowrap">${ltr(fmtD(r.step1?.returnDate))}</td>
        <td class="num">${r.totalDays || 0}</td>
        <td><span class="pill">${esc(T(st.fr, st.ar, lang))}</span></td>
        <td class="num strong">${fmt(total)}</td>
        <td class="num ok">${fmt(paid)}</td>
        ${isConsignment ? `<td class="num accent">${cb ? fmt(cb.commission) : '—'}</td>` : ''}
        ${isConsignment ? `<td class="num muted">${cb ? fmt(cb.ownerPart) : '—'}</td>` : ''}
      </tr>`;
  }).join('');

  const expRows = expenses.map((e, i) => `
    <tr>
      <td class="num">${i + 1}</td>
      <td>${esc(e.type || '—')}</td>
      <td class="nowrap">${ltr(fmtD(e.date))}</td>
      <td>${esc(e.expenseName || e.note || '—')}</td>
      <td class="num bad">−${fmt(Number(e.cost) || 0)}</td>
    </tr>`).join('');

  // ── Calcul final, ligne à ligne ─────────────────────────────────────────
  type CalcLine = { label: string; sub?: string; amount: number; sign: string; tone: string };

  const calcLines: CalcLine[] = isConsignment
    ? [
        {
          sign: '', tone: 'neutral',
          label: T('Chiffre d’affaires des locations', 'رقم أعمال الإيجارات', lang),
          sub: `${gains.rentals} ${T('location(s)', 'إيجار', lang)} · ${gains.daysRented} ${T('jours loués', 'يوم كراء', lang)}`,
          amount: c!.grossAll,
        },
        {
          sign: '−', tone: 'muted',
          label: T('Part reversée au propriétaire', 'الحصة المستحقة للمالك', lang),
          sub: `${pctTxt(c!.grossAll > 0 ? (c!.ownerPayoutTotal / c!.grossAll) * 100 : 0)} ${T('du chiffre d’affaires', 'من رقم الأعمال', lang)}`,
          amount: c!.ownerPayoutTotal,
        },
        {
          sign: '=', tone: 'accent',
          label: T('Revenu de l’agence', 'إيراد الوكالة', lang),
          sub: `${T('commission', 'العمولة', lang)} ${fmt(c!.commissionTotal)}`
            + (c!.ownerDeliveryFeesAll > 0
              ? ` + ${T('livraison propriétaire', 'توصيل المالك', lang)} ${fmt(c!.ownerDeliveryFeesAll)}`
              : ''),
          amount: gains.agencyRevenuePeriod,
        },
        {
          sign: '−', tone: 'bad',
          label: T('Dépenses du véhicule', 'مصاريف المركبة', lang),
          sub: `${expenses.length} ${T('poste(s)', 'بند', lang)}`,
          amount: gains.expenses,
        },
        {
          sign: '=', tone: 'total',
          label: T('BÉNÉFICE NET DE L’AGENCE', 'صافي ربح الوكالة', lang),
          sub: `${T('marge', 'الهامش', lang)} ${pctTxt(
            gains.agencyRevenuePeriod > 0 ? (gains.netBenefitPeriod / gains.agencyRevenuePeriod) * 100 : 0,
          )}`,
          amount: gains.netBenefitPeriod,
        },
      ]
    : [
        {
          sign: '', tone: 'neutral',
          label: T('Total facturé', 'الإجمالي المفوتر', lang),
          sub: `${gains.rentals} ${T('location(s)', 'إيجار', lang)} · ${gains.daysRented} ${T('jours loués', 'يوم كراء', lang)}`,
          amount: gains.invoiced,
        },
        {
          sign: '=', tone: 'accent',
          label: T('Encaissé (gains des locations)', 'المحصّل (أرباح الإيجارات)', lang),
          sub: `${pctTxt(gains.collectionRate)} ${T('du facturé', 'من المفوتر', lang)}`,
          amount: gains.collected,
        },
        {
          sign: '−', tone: 'bad',
          label: T('Dépenses du véhicule', 'مصاريف المركبة', lang),
          sub: `${expenses.length} ${T('poste(s)', 'بند', lang)}`,
          amount: gains.expenses,
        },
        {
          sign: '=', tone: 'total',
          label: T('BÉNÉFICE NET', 'صافي الربح', lang),
          sub: `${T('marge', 'الهامش', lang)} ${pctTxt(gains.margin)}`,
          amount: gains.netBenefit,
        },
      ];

  const calcHtml = calcLines.map(l => `
    <div class="calc-row calc-${l.tone}">
      <span class="calc-sign">${l.sign}</span>
      <div class="calc-label">
        <strong>${esc(l.label)}</strong>
        ${l.sub ? `<span>${esc(l.sub)}</span>` : ''}
      </div>
      <span class="calc-amount">${l.amount < 0 ? '−' : ''}${fmt(Math.abs(l.amount))} DA</span>
    </div>`).join('');

  const kpiCards = [
    {
      label: isConsignment
        ? T('Gains des locations (agence)', 'أرباح الإيجارات (الوكالة)', lang)
        : T('Gains des locations', 'أرباح الإيجارات', lang),
      value: gains.agencyRevenuePeriod,
      cls: 'kpi-gain',
    },
    { label: T('Total des dépenses', 'إجمالي المصاريف', lang), value: gains.expenses, cls: 'kpi-exp' },
    {
      label: T('Bénéfice net', 'صافي الربح', lang),
      value: isConsignment ? gains.netBenefitPeriod : gains.netBenefit,
      cls: 'kpi-net',
    },
  ].map(k => `
    <div class="kpi ${k.cls}">
      <span class="kpi-label">${esc(k.label)}</span>
      <span class="kpi-value">${k.value < 0 ? '−' : ''}${fmt(Math.abs(k.value))} <small>DA</small></span>
    </div>`).join('');

  const commissionNote = !isConsignment ? '' : (
    owner!.commissionType === 'per_day'
      ? T(
          `${fmt(owner!.commissionValue)} DA pour CHAQUE jour loué. Sur la période : ${gains.daysRented} jour(s) loué(s) ⇒ ${fmt(c!.commissionTotal)} DA de commission.`,
          `${fmt(owner!.commissionValue)} دج عن كل يوم كراء. خلال الفترة: ${gains.daysRented} يوم ⇒ ${fmt(c!.commissionTotal)} دج عمولة.`,
          lang)
      : owner!.commissionType === 'percentage'
        ? T(
            `${owner!.commissionValue} % du total de chaque location. Sur la période : ${fmt(c!.grossAll)} DA × ${owner!.commissionValue} % ⇒ ${fmt(c!.commissionTotal)} DA.`,
            `${owner!.commissionValue} % من إجمالي كل إيجار. خلال الفترة: ${fmt(c!.grossAll)} دج × ${owner!.commissionValue} % ⇒ ${fmt(c!.commissionTotal)} دج.`,
            lang)
        : T(
            `${fmt(owner!.commissionValue)} DA par location. Sur la période : ${activeCount} location(s) ⇒ ${fmt(c!.commissionTotal)} DA.`,
            `${fmt(owner!.commissionValue)} دج لكل إيجار. خلال الفترة: ${activeCount} إيجار ⇒ ${fmt(c!.commissionTotal)} دج.`,
            lang)
  );

  const deliveryNote = isConsignment && c!.ownerDeliveryFeesAll > 0
    ? ' ' + T(
        `S'y ajoutent ${fmt(c!.ownerDeliveryFeesAll)} DA de frais de livraison pris en charge par le propriétaire.`,
        `تُضاف ${fmt(c!.ownerDeliveryFeesAll)} دج رسوم توصيل على عاتق المالك.`,
        lang)
    : '';

  const pendingNote = isConsignment && c!.pendingCount > 0
    ? ' ' + T(
        `${c!.pendingCount} location(s) encore en cours : leur commission (${fmt(c!.commissionPending)} DA) est estimée et sera figée à la clôture.`,
        `${c!.pendingCount} إيجار جارٍ: عمولته (${fmt(c!.commissionPending)} دج) تقديرية وتُثبَّت عند الإغلاق.`,
        lang)
    : '';

  return `<!DOCTYPE html>
<html dir="${dir}" lang="${isFrench ? 'fr' : 'ar'}">
<head>
<meta charset="UTF-8" />
<title>${esc(T('Bénéfices par véhicule', 'أرباح المركبة', lang))} — ${esc(car.brand)} ${esc(car.model)}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    font-family: 'Segoe UI', Tahoma, Geneva, sans-serif;
    color:#0f172a; background:#fff; direction:${dir};
    font-size:11px; line-height:1.45; padding:14px;
  }
  .page { width:210mm; margin:0 auto; padding:10px; }

  .head {
    display:flex; gap:14px; align-items:flex-start;
    background:linear-gradient(135deg,#064e3b 0%,#0f766e 55%,#115e59 100%);
    color:#fff; border-radius:10px; padding:14px 16px; margin-bottom:12px;
  }
  .head .logo {
    width:58px; height:58px; border-radius:10px; background:#fff; flex-shrink:0;
    display:flex; align-items:center; justify-content:center; padding:4px;
  }
  .head .logo img { width:100%; height:100%; object-fit:contain; }
  .head .info { flex:1; }
  .head .info h1 { font-size:16px; font-weight:800; letter-spacing:.2px; }
  .head .info p { font-size:9.5px; opacity:.92; margin-top:2px; }
  .head .meta { text-align:${align}; font-size:9.5px; }
  .head .meta .title {
    display:inline-block; background:rgba(255,255,255,.18); border:1px solid rgba(255,255,255,.35);
    border-radius:6px; padding:4px 8px; font-weight:800; letter-spacing:.6px; margin-bottom:5px;
  }

  .band { border-radius:9px; padding:10px 12px; margin-bottom:10px; }
  .band-title {
    font-size:9px; font-weight:800; letter-spacing:1.1px; text-transform:uppercase;
    margin-bottom:7px; opacity:.9;
  }
  .band-owner { background:#ecfdf5; border:1px solid #6ee7b7; }
  .band-owner .band-title { color:#047857; }
  .band-car { background:#f8fafc; border:1px solid #e2e8f0; display:flex; gap:12px; align-items:center; }
  .band-car img { width:104px; height:74px; object-fit:cover; border-radius:7px; border:1px solid #cbd5e1; }
  .band-car .band-title { color:#0f766e; }

  .grid { display:flex; flex-wrap:wrap; gap:6px 18px; }
  .field { min-width:116px; }
  .field .k { display:block; font-size:8px; font-weight:700; text-transform:uppercase; letter-spacing:.7px; color:#64748b; }
  .field .v { display:block; font-size:11px; font-weight:700; color:#0f172a; }

  .kpis { display:flex; gap:9px; margin:12px 0; }
  .kpi { flex:1; border-radius:9px; padding:10px 12px; border:1px solid; }
  .kpi-label { display:block; font-size:8.5px; font-weight:800; text-transform:uppercase; letter-spacing:.8px; }
  .kpi-value { display:block; font-size:18px; font-weight:800; margin-top:3px; }
  .kpi-value small { font-size:9px; font-weight:700; opacity:.6; }
  .kpi-gain { background:#ecfdf5; border-color:#6ee7b7; color:#047857; }
  .kpi-exp  { background:#fff1f2; border-color:#fda4af; color:#be123c; }
  .kpi-net  { background:#eef2ff; border-color:#a5b4fc; color:#3730a3; }

  h2.section {
    font-size:10.5px; font-weight:800; text-transform:uppercase; letter-spacing:1px;
    color:#0f766e; border-bottom:2px solid #0f766e; padding-bottom:4px; margin:14px 0 7px;
  }
  table { width:100%; border-collapse:collapse; font-size:9.5px; }
  thead th {
    background:#0f766e; color:#fff; padding:5px 6px; text-align:${isFrench ? 'left' : 'right'};
    font-weight:700; font-size:8.5px; text-transform:uppercase; letter-spacing:.5px;
  }
  tbody td { padding:4.5px 6px; border-bottom:1px solid #e2e8f0; }
  tbody tr:nth-child(even) { background:#f8fafc; }
  tfoot td { padding:6px; background:#ecfdf5; font-weight:800; border-top:2px solid #0f766e; }
  td.num, th.num { text-align:${align}; font-variant-numeric:tabular-nums; }
  td.nowrap { white-space:nowrap; }
  td.strong { font-weight:800; }
  td.ok { color:#047857; font-weight:700; }
  td.bad, .bad { color:#be123c; font-weight:700; }
  td.accent { color:#b45309; font-weight:800; }
  td.muted { color:#64748b; }
  .row-muted td { opacity:.5; text-decoration:line-through; }
  .pill {
    display:inline-block; padding:1px 5px; border-radius:999px; background:#e2e8f0;
    color:#475569; font-size:8px; font-weight:700;
  }

  .calc { border:1px solid #cbd5e1; border-radius:9px; overflow:hidden; margin-top:8px; }
  .calc-row { display:flex; align-items:center; gap:9px; padding:7px 11px; border-bottom:1px solid #e2e8f0; }
  .calc-row:last-child { border-bottom:none; }
  .calc-sign { width:12px; text-align:center; font-weight:800; color:#94a3b8; }
  .calc-label { flex:1; }
  .calc-label strong { display:block; font-size:10.5px; }
  .calc-label span { display:block; font-size:8.5px; color:#64748b; }
  .calc-amount { font-size:12px; font-weight:800; font-variant-numeric:tabular-nums; white-space:nowrap; }
  .calc-accent { background:#f0fdfa; }
  .calc-accent .calc-amount { color:#0f766e; }
  .calc-bad .calc-amount { color:#be123c; }
  .calc-muted .calc-amount { color:#64748b; }
  .calc-total { background:linear-gradient(135deg,#064e3b,#0f766e); color:#fff; }
  .calc-total .calc-label span { color:rgba(255,255,255,.75); }
  .calc-total .calc-sign { color:rgba(255,255,255,.6); }
  .calc-total .calc-amount { font-size:15px; }

  .note {
    margin-top:9px; font-size:8.5px; color:#475569; background:#f8fafc;
    border:1px solid #e2e8f0; border-inline-start:3px solid #0f766e;
    border-radius:6px; padding:7px 9px;
  }

  .sign-area { display:flex; justify-content:space-between; gap:28px; margin-top:26px; padding-top:12px; border-top:2px solid #e2e8f0; }
  .sign-box { flex:1; text-align:center; }
  .sign-box .lbl { font-size:8.5px; font-weight:800; text-transform:uppercase; letter-spacing:.7px; color:#0f766e; }
  .sign-box .line { border-top:1.5px solid #334155; height:34px; margin-top:16px; }

  @media print { body { padding:0; } .page { margin:0; } }
</style>
</head>
<body>
<div class="page">

  <div class="head">
    <div class="logo">
      ${agency?.logo ? `<img src="${esc(agency.logo)}" alt="logo" />` : '<span style="font-size:26px">&#128663;</span>'}
    </div>
    <div class="info">
      <h1>${esc(agency?.name || 'AUTO LOCATION')}</h1>
      ${agency?.address ? `<p>${T('Adresse', 'العنوان', lang)} : ${esc(agency.address)}</p>` : ''}
      ${agency?.phone ? `<p>${T('Tél.', 'الهاتف', lang)} : ${ltr(agency.phone)}${agency?.phone_number_2 ? ` · ${ltr(agency.phone_number_2)}` : ''}</p>` : ''}
      ${agency?.email ? `<p>${T('Email', 'البريد', lang)} : ${ltr(agency.email)}</p>` : ''}
      ${agency?.bank_number ? `<p>${T('RIB', 'الحساب البنكي', lang)} : ${ltr(agency.bank_number)}</p>` : ''}
    </div>
    <div class="meta">
      <div class="title">${esc(isConsignment
        ? T('RAPPORT DE CONCIERGERIE', 'تقرير الوكالة', lang)
        : T('BÉNÉFICES PAR VÉHICULE', 'أرباح المركبة', lang))}</div>
      <div>${T('Période', 'الفترة', lang)} : ${ltr(fmtD(startDate))} → ${ltr(fmtD(endDate))}</div>
      <div>${T('Édité le', 'حرر في', lang)} ${ltr(fmtD(new Date().toISOString().slice(0, 10)))}</div>
    </div>
  </div>

  ${isConsignment ? `
  <div class="band band-owner">
    <div class="band-title">${T('Propriétaire du véhicule', 'مالك المركبة', lang)}</div>
    <div class="grid">
      <div class="field"><span class="k">${T('Nom', 'الاسم', lang)}</span><span class="v">${esc(owner!.ownerName)}</span></div>
      ${owner!.ownerPhone ? `<div class="field"><span class="k">${T('Téléphone', 'الهاتف', lang)}</span><span class="v">${ltr(owner!.ownerPhone)}</span></div>` : ''}
      ${owner!.internalRef ? `<div class="field"><span class="k">${T('Référence', 'المرجع', lang)}</span><span class="v">${ltr(owner!.internalRef)}</span></div>` : ''}
      ${owner!.consignmentDate ? `<div class="field"><span class="k">${T('Date de dépôt', 'تاريخ الإيداع', lang)}</span><span class="v">${ltr(fmtD(owner!.consignmentDate))}</span></div>` : ''}
      <div class="field"><span class="k">${T('Commission convenue', 'العمولة المتفق عليها', lang)}</span><span class="v">${esc(scaleLabel)}</span></div>
      ${owner!.deliveryFeeEnabled !== false
        ? `<div class="field"><span class="k">${T('Livraison propriétaire', 'توصيل المالك', lang)}</span><span class="v">${fmt(owner!.deliveryFeeAmount ?? 0)} DA ≥ ${owner!.deliveryThresholdDays ?? 10} ${T('j', 'ي', lang)}</span></div>`
        : ''}
    </div>
  </div>` : ''}

  <div class="band band-car">
    ${car.images?.[0] ? `<img src="${esc(car.images[0])}" alt="${esc(car.brand)}" />` : ''}
    <div style="flex:1">
      <div class="band-title">${T('Véhicule', 'المركبة', lang)}</div>
      <div class="grid">
        <div class="field"><span class="k">${T('Marque / Modèle', 'العلامة / الموديل', lang)}</span><span class="v">${esc(car.brand)} ${esc(car.model)}</span></div>
        <div class="field"><span class="k">${T('Immatriculation', 'رقم التسجيل', lang)}</span><span class="v">${ltr(car.registration)}</span></div>
        <div class="field"><span class="k">${T('Année', 'السنة', lang)}</span><span class="v">${ltr(car.year)}</span></div>
        <div class="field"><span class="k">${T('Couleur', 'اللون', lang)}</span><span class="v">${esc(car.color || '—')}</span></div>
        <div class="field"><span class="k">${T('Carburant', 'الوقود', lang)}</span><span class="v">${esc(car.energy || '—')}</span></div>
        <div class="field"><span class="k">${T('Kilométrage', 'المسافة', lang)}</span><span class="v">${ltr(fmt(car.mileage || 0))} km</span></div>
        <div class="field"><span class="k">${T('Régime', 'النظام', lang)}</span><span class="v">${esc(isConsignment ? T('Conciergerie', 'وكالة', lang) : T('Véhicule de l’agence', 'مركبة الوكالة', lang))}</span></div>
      </div>
    </div>
  </div>

  <div class="kpis">${kpiCards}</div>

  <h2 class="section">${T('Liste des locations', 'قائمة الإيجارات', lang)} (${reservations.length})</h2>
  ${reservations.length > 0 ? `
  <table>
    <thead>
      <tr>
        <th class="num">#</th>
        <th>${T('Client', 'العميل', lang)}</th>
        <th>${T('Départ', 'المغادرة', lang)}</th>
        <th>${T('Retour', 'العودة', lang)}</th>
        <th class="num">${T('Jours', 'أيام', lang)}</th>
        <th>${T('Statut', 'الحالة', lang)}</th>
        <th class="num">${T('Total', 'الإجمالي', lang)}</th>
        <th class="num">${T('Encaissé', 'المحصّل', lang)}</th>
        ${isConsignment ? `<th class="num">${T('Commission', 'العمولة', lang)}</th>` : ''}
        ${isConsignment ? `<th class="num">${T('Part propr.', 'حصة المالك', lang)}</th>` : ''}
      </tr>
    </thead>
    <tbody>${resRows}</tbody>
    <tfoot>
      <tr>
        <td colspan="4">${T('TOTAL', 'الإجمالي', lang)}</td>
        <td class="num">${gains.daysRented}</td>
        <td></td>
        <td class="num">${fmt(gains.invoiced)}</td>
        <td class="num">${fmt(gains.collected)}</td>
        ${isConsignment ? `<td class="num">${fmt(c!.commissionTotal)}</td>` : ''}
        ${isConsignment ? `<td class="num">${fmt(c!.ownerPayoutTotal)}</td>` : ''}
      </tr>
    </tfoot>
  </table>` : `<p class="note">${T('Aucune location sur la période.', 'لا توجد إيجارات في هذه الفترة.', lang)}</p>`}

  ${isConsignment ? `
  <div class="note">
    <strong>${T('Mode de calcul de la commission', 'طريقة حساب العمولة', lang)} :</strong>
    ${commissionNote}${deliveryNote}${pendingNote}
  </div>` : ''}

  <h2 class="section">${T('Liste des dépenses', 'قائمة المصاريف', lang)} (${expenses.length})</h2>
  ${expenses.length > 0 ? `
  <table>
    <thead>
      <tr>
        <th class="num">#</th>
        <th>${T('Type', 'النوع', lang)}</th>
        <th>${T('Date', 'التاريخ', lang)}</th>
        <th>${T('Description', 'الوصف', lang)}</th>
        <th class="num">${T('Montant', 'المبلغ', lang)}</th>
      </tr>
    </thead>
    <tbody>${expRows}</tbody>
    <tfoot>
      <tr>
        <td colspan="4">${T('TOTAL DES DÉPENSES', 'إجمالي المصاريف', lang)}</td>
        <td class="num bad">−${fmt(gains.expenses)}</td>
      </tr>
    </tfoot>
  </table>` : `<p class="note">${T('Aucune dépense sur la période.', 'لا توجد مصاريف في هذه الفترة.', lang)}</p>`}

  <h2 class="section">${T('Calcul du bénéfice', 'حساب الربح', lang)}</h2>
  <div class="calc">${calcHtml}</div>

  ${isConsignment ? `
  <div class="note">
    <strong>${T('Récapitulatif du règlement', 'ملخص التسوية', lang)} :</strong>
    ${T(
      `Sur ${fmt(c!.grossAll)} DA de locations pour ce véhicule, l'agence conserve ${fmt(gains.agencyRevenuePeriod)} DA (commission${c!.ownerDeliveryFeesAll > 0 ? ' + livraison à charge du propriétaire' : ''}) et reverse ${fmt(c!.ownerPayoutTotal)} DA au propriétaire. Après ${fmt(gains.expenses)} DA de dépenses véhicule, le bénéfice net de l'agence s'établit à ${fmt(gains.netBenefitPeriod)} DA.`,
      `من أصل ${fmt(c!.grossAll)} دج من إيجارات هذه المركبة، تحتفظ الوكالة بـ ${fmt(gains.agencyRevenuePeriod)} دج وتدفع ${fmt(c!.ownerPayoutTotal)} دج للمالك. وبعد ${fmt(gains.expenses)} دج من مصاريف المركبة، يبلغ صافي ربح الوكالة ${fmt(gains.netBenefitPeriod)} دج.`,
      lang)}
  </div>` : ''}

  <div class="sign-area">
    <div class="sign-box">
      <div class="lbl">${T('Signature de l’agence', 'توقيع الوكالة', lang)}</div>
      <div class="line"></div>
    </div>
    <div class="sign-box">
      <div class="lbl">${isConsignment
        ? T('Signature du propriétaire', 'توقيع المالك', lang)
        : T('Cachet de l’agence', 'ختم الوكالة', lang)}</div>
      <div class="line"></div>
    </div>
  </div>

</div>
</body>
</html>`;
};
