import { Car, Language, ReservationDetails, VehicleExpense } from '../../types';
import { VehicleGains, calcPaid, commissionBreakdown, computeConsignmentSplit } from '../../utils/gainsMath';
import { expenseTypeLabel, expenseDetailFields, summarizeExpensesByType } from '../../utils/expenseDetails';

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
  /** Total des frais « longue durée » refacturés au propriétaire (conciergerie). */
  ownerLongDurationTotal?: number;
  /** Détail des locations concernées par le supplément longue durée. */
  ownerLongDurationItems?: { name: string; totalDays: number; amount: number }[];
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
  ownerLongDurationTotal = 0, ownerLongDurationItems = [],
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
  const fmtDT = (d?: string, t?: string) => {
    if (!d) return '—';
    const time = (t || '').slice(0, 5);
    return time ? `${fmtD(d)} ${time}` : fmtD(d);
  };
  const fmtStamp = (d?: string) => {
    if (!d) return '—';
    try {
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return d;
      return `${dt.toLocaleDateString(isFrench ? 'fr-FR' : 'ar-DZ')} ${dt.toTimeString().slice(0, 5)}`;
    } catch {
      return d;
    }
  };
  const pctTxt = (v: number) =>
    `${(Number(v) || 0).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`;

  const owner = gains.owner;
  const c = gains.consignment;
  const isConsignment = gains.isConsignment && !!owner && !!c;

  // Frais « longue durée » refacturés au propriétaire : n'existent que pour une
  // conciergerie ; ils s'ajoutent à la part de l'agence et se déduisent de celle
  // du propriétaire. Les dépenses du véhicule sont à la charge du propriétaire :
  // la part de l'agence est calculée indépendamment, sans les toucher.
  const longFee = isConsignment ? Math.max(0, Number(ownerLongDurationTotal) || 0) : 0;
  const split = isConsignment ? computeConsignmentSplit(gains, longFee) : null;
  const netFinal = split ? split.agencyPart : gains.netBenefit;

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
        <td>${ltr(fmtDT(r.step1?.departureDate, r.step1?.departureTime))}</td>
        <td>${ltr(fmtDT(r.step1?.returnDate, r.step1?.returnTime))}</td>
        <td class="num">${r.totalDays || 0}</td>
        <td><span class="pill">${esc(T(st.fr, st.ar, lang))}</span></td>
        <td class="num strong">${fmt(total)}</td>
        <td class="num ok">${fmt(paid)}</td>
        ${isConsignment ? `<td class="num accent">${cb ? fmt(cb.commission) : '—'}</td>` : ''}
        ${isConsignment ? `<td class="num muted">${cb ? fmt(cb.ownerPart) : '—'}</td>` : ''}
      </tr>`;
  }).join('');

  // ── Fiches détaillées : un bloc complet par contrat ──────────────────────
  const PAY_METHOD: Record<string, [string, string]> = {
    cash: ['Espèces', 'نقدًا'], card: ['Carte', 'بطاقة'],
    transfer: ['Virement', 'تحويل'], check: ['Chèque', 'شيك'],
  };
  const FUEL: Record<string, [string, string]> = {
    full: ['Plein', 'ممتلئ'], half: ['1/2', '1/2'], quarter: ['1/4', '1/4'],
    eighth: ['1/8', '1/8'], empty: ['Vide', 'فارغ'],
  };
  const kv = (k: string, v: string) =>
    `<div class="cf"><span class="k">${esc(k)}</span><span class="v">${v}</span></div>`;
  const money = (n: number) => `${fmt(n)} DA`;

  const contractCards = reservations.map((r, i) => {
    const paid = calcPaid(r);
    const total = Number(r.totalPrice) || 0;
    const remaining = Math.max(0, total - paid);
    const cancelled = r.status === 'cancelled';
    const cb = owner && !cancelled ? commissionBreakdown(r, owner) : null;
    const st = STATUS_LABEL[r.status] || STATUS_LABEL.pending;
    const s1: any = r.step1 || {};
    const cl: any = r.client || {};
    const days = Number(r.totalDays) || 0;
    const services = (r.additionalServices || []) as any[];
    const payments = ((r.payments || []) as any[])
      .slice()
      .sort((a, b) => new Date(a.date || a.createdAt || a.created_at || 0).getTime()
        - new Date(b.date || b.createdAt || b.created_at || 0).getTime());
    const dep = r.departureInspection;
    const ret = r.returnInspection;
    const discount = Number(r.discountAmount) || 0;
    const cautionAmt = Number(r.cautionAmountDzd ?? r.deposit) || 0;
    const assurancePerDay = Number(r.protectionAssurancePrice) || 0;

    const clientFields = [
      kv(T('Client', 'العميل', lang), esc(`${cl.firstName || ''} ${cl.lastName || ''}`.trim() || '—')),
      cl.phone ? kv(T('Téléphone', 'الهاتف', lang), ltr(cl.phone)) : '',
      cl.email ? kv(T('Email', 'البريد', lang), ltr(cl.email)) : '',
      cl.idCardNumber ? kv(T('N° pièce d’identité', 'رقم الهوية', lang), ltr(cl.idCardNumber)) : '',
      cl.licenseNumber ? kv(T('N° permis', 'رقم الرخصة', lang), ltr(cl.licenseNumber)) : '',
      cl.wilaya || cl.completeAddress
        ? kv(T('Adresse', 'العنوان', lang), esc([cl.completeAddress, cl.wilaya].filter(Boolean).join(', ')))
        : '',
    ].join('');

    const dateFields = [
      kv(T('Départ', 'المغادرة', lang), ltr(fmtDT(s1.departureDate, s1.departureTime))),
      s1.departureAgencyName ? kv(T('Agence de départ', 'وكالة المغادرة', lang), esc(s1.departureAgencyName)) : '',
      kv(T('Retour', 'العودة', lang), ltr(fmtDT(s1.returnDate, s1.returnTime))),
      s1.returnAgencyName ? kv(T('Agence de retour', 'وكالة العودة', lang), esc(s1.returnAgencyName)) : '',
      kv(T('Durée', 'المدة', lang), `${days} ${T('jour(s)', 'يوم', lang)}`),
      kv(T('Créé le', 'أنشئ في', lang), ltr(fmtStamp(r.createdAt))),
      r.activatedAt ? kv(T('Activé le', 'فُعّل في', lang), ltr(fmtStamp(r.activatedAt))) : '',
      r.completedAt ? kv(T('Clôturé le', 'أغلق في', lang), ltr(fmtStamp(r.completedAt))) : '',
      r.createdByName ? kv(T('Créé par', 'أنشأه', lang), esc(r.createdByName)) : '',
      kv(T('Origine', 'المصدر', lang), esc(r.source === 'website' ? T('Site web', 'الموقع', lang) : T('Agence', 'الوكالة', lang))),
    ].join('');

    const inspFields = [
      dep ? kv(T('Km départ', 'كم المغادرة', lang), `${ltr(fmt(dep.mileage))} km`) : '',
      dep?.fuelLevel ? kv(T('Carburant départ', 'وقود المغادرة', lang), esc(T(...(FUEL[dep.fuelLevel] || [dep.fuelLevel, dep.fuelLevel]) as [string, string], lang))) : '',
      ret ? kv(T('Km retour', 'كم العودة', lang), `${ltr(fmt(ret.mileage))} km`) : '',
      ret?.fuelLevel ? kv(T('Carburant retour', 'وقود العودة', lang), esc(T(...(FUEL[ret.fuelLevel] || [ret.fuelLevel, ret.fuelLevel]) as [string, string], lang))) : '',
      dep && ret && Number(ret.mileage) >= Number(dep.mileage)
        ? kv(T('Distance parcourue', 'المسافة المقطوعة', lang), `${ltr(fmt(Number(ret.mileage) - Number(dep.mileage)))} km`)
        : '',
      Number(r.excessMileage) > 0 ? kv(T('Km excédentaires', 'كم زائدة', lang), `${ltr(fmt(Number(r.excessMileage)))} km`) : '',
      Number(r.missingFuel) > 0 ? kv(T('Carburant manquant', 'وقود ناقص', lang), esc(String(r.missingFuel))) : '',
    ].join('');

    const priceLines: [string, string][] = [];
    if (days > 0 && total > 0) priceLines.push([T('Prix moyen / jour', 'متوسط السعر / يوم', lang), money(total / days)]);
    services.forEach(sv => {
      const name = sv.service_name || sv.name || sv.serviceName || T('Service', 'خدمة', lang);
      priceLines.push([`${T('Service', 'خدمة', lang)} : ${name}`, money(Number(sv.price) || 0)]);
    });
    if (r.protectionAssuranceName || assurancePerDay > 0) {
      priceLines.push([
        `${T('Assurance', 'التأمين', lang)} : ${r.protectionAssuranceName || '—'} (${fmt(assurancePerDay)} DA × ${days} ${T('j', 'ي', lang)})`,
        money(assurancePerDay * days),
      ]);
    }
    if (Number(r.deliveryFee) > 0) {
      priceLines.push([
        `${T('Livraison', 'التوصيل', lang)} (${r.deliveryFeePayer === 'owner' ? T('à charge du propriétaire', 'على حساب المالك', lang) : T('à charge du client', 'على حساب العميل', lang)})`,
        money(Number(r.deliveryFee)),
      ]);
    }
    if (Number(r.longDurationFee) > 0) priceLines.push([T('Supplément longue durée', 'رسوم المدة الطويلة', lang), money(Number(r.longDurationFee))]);
    if (Number(r.additionalFees) > 0) priceLines.push([T('Frais supplémentaires', 'رسوم إضافية', lang), money(Number(r.additionalFees))]);
    if (discount > 0) {
      priceLines.push([
        `${T('Remise', 'التخفيض', lang)}${r.discountType === 'percentage' ? ` (${discount} %)` : ''}`,
        r.discountType === 'percentage' ? `${discount} %` : `−${money(discount)}`,
      ]);
    }
    priceLines.push([T('TVA appliquée', 'الضريبة المطبقة', lang), r.tvaApplied ? T('Oui', 'نعم', lang) : T('Non', 'لا', lang)]);
    if (r.cautionEnabled !== false && cautionAmt > 0) {
      priceLines.push([`${T('Caution', 'الضمان', lang)} (${r.cautionCurrency || 'DZD'})`, money(cautionAmt)]);
    }
    if (r.paymentCurrency === 'EUR' && r.totalPriceEur) {
      priceLines.push([`${T('Total en euros', 'الإجمالي باليورو', lang)} (${T('taux', 'سعر الصرف', lang)} ${r.euroRate || '—'})`, `${fmt(Number(r.totalPriceEur))} €`]);
    }

    const payRows = payments.length
      ? payments.map((p, j) => `
          <tr>
            <td class="num">${j + 1}</td>
            <td>${ltr(fmtD(p.date || p.createdAt || p.created_at))}</td>
            <td>${esc(T(...(PAY_METHOD[p.method] || [p.method || '—', p.method || '—']) as [string, string], lang))}</td>
            <td>${esc(p.note || '—')}</td>
            <td class="num ok">${fmt(Number(p.amount) || 0)}</td>
          </tr>`).join('')
      : `<tr><td colspan="5" class="muted">${T('Aucun paiement enregistré', 'لا توجد مدفوعات مسجلة', lang)}</td></tr>`;

    return `
    <div class="contract ${cancelled ? 'contract-cancelled' : ''}">
      <div class="contract-head">
        <div>
          <strong>${T('Contrat', 'العقد', lang)} #${i + 1}</strong>
          <span class="ref">${T('Réf.', 'المرجع', lang)} ${ltr((r.id || '').slice(0, 8).toUpperCase())}</span>
        </div>
        <div>
          <span class="pill">${esc(T(st.fr, st.ar, lang))}</span>
          <span class="ref">${ltr(fmtDT(s1.departureDate, s1.departureTime))} → ${ltr(fmtDT(s1.returnDate, s1.returnTime))}</span>
        </div>
      </div>
      <div class="contract-body">
        <div class="cgroup">
          <div class="cg-title">${T('Client', 'العميل', lang)}</div>
          <div class="cgrid">${clientFields}</div>
        </div>
        <div class="cgroup">
          <div class="cg-title">${T('Dates & agences', 'التواريخ والوكالات', lang)}</div>
          <div class="cgrid">${dateFields}</div>
        </div>
        ${inspFields ? `
        <div class="cgroup">
          <div class="cg-title">${T('État du véhicule', 'حالة المركبة', lang)}</div>
          <div class="cgrid">${inspFields}</div>
        </div>` : ''}
        <div class="cgroup">
          <div class="cg-title">${T('Tarification', 'التسعير', lang)}</div>
          <table class="mini">
            <tbody>
              ${priceLines.map(([k, v]) => `<tr><td>${esc(k)}</td><td class="num">${v}</td></tr>`).join('')}
            </tbody>
          </table>
          <div class="totals">
            <div><span>${T('Total', 'الإجمالي', lang)}</span><strong>${money(total)}</strong></div>
            <div class="ok"><span>${T('Encaissé', 'المحصّل', lang)}</span><strong>${money(paid)}</strong></div>
            <div class="${remaining > 0 ? 'bad' : ''}"><span>${T('Reste à payer', 'المتبقي', lang)}</span><strong>${money(remaining)}</strong></div>
            ${cb ? `<div class="acc"><span>${T('Commission agence', 'عمولة الوكالة', lang)}</span><strong>${money(cb.commission)}</strong></div>
            <div><span>${T('Part propriétaire', 'حصة المالك', lang)}</span><strong>${money(cb.ownerPart)}</strong></div>` : ''}
          </div>
        </div>
        <div class="cgroup">
          <div class="cg-title">${T('Paiements', 'المدفوعات', lang)} (${payments.length})</div>
          <table class="mini">
            <thead><tr>
              <th class="num">#</th><th>${T('Date', 'التاريخ', lang)}</th><th>${T('Mode', 'الطريقة', lang)}</th>
              <th>${T('Note', 'ملاحظة', lang)}</th><th class="num">${T('Montant', 'المبلغ', lang)}</th>
            </tr></thead>
            <tbody>${payRows}</tbody>
          </table>
        </div>
        ${r.notes ? `<div class="cgroup"><div class="cg-title">${T('Notes', 'ملاحظات', lang)}</div><div class="cnote">${esc(r.notes)}</div></div>` : ''}
      </div>
    </div>`;
  }).join('');

  // ── Dépenses : tableau détaillé + récapitulatif par type ────────────────
  const totalExp = Number(gains.expenses) || 0;
  const pctOfExp = (v: number) => pctTxt(totalExp > 0 ? (v / totalExp) * 100 : 0);
  const expRows = expenses.map((e, i) => {
    const cost = Number(e.cost) || 0;
    const details = expenseDetailFields(e, lang, fmtD)
      .filter(f => f.label !== T('Désignation', 'التسمية', lang));
    return `
    <tr>
      <td class="num">${i + 1}</td>
      <td>${ltr(fmtD(e.date))}</td>
      <td>
        <span class="pill">${esc(expenseTypeLabel(e.type, lang))}</span>
        <div class="strong" style="margin-top:2px">${esc(e.expenseName || '—')}</div>
      </td>
      <td class="details">${details.length
        ? details.map(f => `<div><span class="dk">${esc(f.label)} :</span> ${esc(f.value)}</div>`).join('')
        : '—'}</td>
      <td class="num muted">${pctOfExp(cost)}</td>
      <td class="num bad">−${fmt(cost)}</td>
    </tr>`;
  }).join('');

  const expTypeRows = summarizeExpensesByType(expenses, lang).map(t => `
    <tr>
      <td>${esc(t.label)}</td>
      <td class="num">${t.count}</td>
      <td class="num muted">${pctOfExp(t.total)}</td>
      <td class="num bad">−${fmt(t.total)}</td>
    </tr>`).join('');

  const longRows = ownerLongDurationItems.map((it, i) => `
    <tr>
      <td class="num">${i + 1}</td>
      <td>${esc(it.name)}</td>
      <td class="num">${it.totalDays}</td>
      <td class="num accent">+${fmt(it.amount)}</td>
    </tr>`).join('');

  // ── Calcul final, ligne à ligne ─────────────────────────────────────────
  type CalcLine = { label: string; sub?: string; amount: number; sign: string; tone: string };

  const calcLines: CalcLine[] = split
    ? [
        {
          sign: '', tone: 'neutral',
          label: T('Chiffre d’affaires des locations', 'رقم أعمال الإيجارات', lang),
          sub: `${gains.rentals} ${T('location(s)', 'إيجار', lang)} · ${gains.daysRented} ${T('jours loués', 'يوم كراء', lang)}`,
          amount: split.gross,
        },
        {
          sign: '', tone: 'accent',
          label: T('Commission de l’agence', 'عمولة الوكالة', lang),
          sub: `${pctTxt(split.gross > 0 ? (split.commission / split.gross) * 100 : 0)} ${T('du chiffre d’affaires', 'من رقم الأعمال', lang)}`,
          amount: split.commission,
        },
        ...(split.ownerDelivery > 0 ? [{
          sign: '+', tone: 'accent',
          label: T('Livraison à charge du propriétaire', 'التوصيل على حساب المالك', lang),
          amount: split.ownerDelivery,
        } as CalcLine] : []),
        ...(split.longFee > 0 ? [{
          sign: '+', tone: 'accent',
          label: T('Frais longue durée (propriétaire)', 'رسوم المدة الطويلة (المالك)', lang),
          sub: `${ownerLongDurationItems.length} ${T('location(s) ≥ 10 j', 'إيجار ≥ 10 أيام', lang)}`,
          amount: split.longFee,
        } as CalcLine] : []),
        {
          sign: '=', tone: 'total',
          label: T('PART DE L’AGENCE', 'حصة الوكالة', lang),
          sub: `${pctTxt(split.agencyShare)} ${T('du CA · aucune dépense déduite', 'من رقم الأعمال · دون خصم المصاريف', lang)}`,
          amount: split.agencyPart,
        },
        {
          sign: '', tone: 'muted',
          label: T('Part du propriétaire (brute)', 'حصة المالك (الإجمالية)', lang),
          sub: T('CA − commission − livraison', 'رقم الأعمال − العمولة − التوصيل', lang),
          amount: split.ownerGross,
        },
        ...(split.longFee > 0 ? [{
          sign: '−', tone: 'bad',
          label: T('Frais longue durée', 'رسوم المدة الطويلة', lang),
          amount: split.longFee,
        } as CalcLine] : []),
        {
          sign: '−', tone: 'bad',
          label: T('Dépenses du véhicule (à la charge du propriétaire)', 'مصاريف المركبة (على حساب المالك)', lang),
          sub: `${expenses.length} ${T('poste(s)', 'بند', lang)}`,
          amount: split.expenses,
        },
        {
          sign: '=', tone: 'total',
          label: T('NET À REVERSER AU PROPRIÉTAIRE', 'الصافي المستحق للمالك', lang),
          sub: `${pctTxt(split.ownerNetShare)} ${T('du chiffre d’affaires', 'من رقم الأعمال', lang)}`,
          amount: split.ownerNet,
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

  const kpiCards = (split
    ? [
        { label: T('Part de l’agence', 'حصة الوكالة', lang), value: split.agencyPart, cls: 'kpi-gain' },
        { label: T('Dépenses (propriétaire)', 'المصاريف (المالك)', lang), value: split.expenses, cls: 'kpi-exp' },
        { label: T('Net propriétaire', 'صافي المالك', lang), value: split.ownerNet, cls: 'kpi-net' },
      ]
    : [
        { label: T('Gains des locations', 'أرباح الإيجارات', lang), value: gains.agencyRevenuePeriod, cls: 'kpi-gain' },
        { label: T('Total des dépenses', 'إجمالي المصاريف', lang), value: gains.expenses, cls: 'kpi-exp' },
        { label: T('Bénéfice net', 'صافي الربح', lang), value: netFinal, cls: 'kpi-net' },
      ]).map(k => `
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
  .page { width:100%; max-width:210mm; margin:0 auto; padding:10px; }

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
  .exp-table { font-size:8.5px; }
  .exp-table thead th { font-size:7.5px; padding:4px 4px; }
  .exp-table tbody td { padding:4px 4px; vertical-align:top; }
  tr { page-break-inside:avoid; }
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

  td.details { font-size:8px; line-height:1.4; word-break:break-word; }
  td.details .dk, .dk { color:#64748b; font-weight:700; }
  .strong { font-weight:800; }
  table { table-layout:auto; word-break:break-word; }
  .exp-table { table-layout:fixed; }

  .contract { border:1px solid #cbd5e1; border-radius:9px; margin-bottom:10px; overflow:hidden; page-break-inside:avoid; break-inside:avoid; }
  .contract-cancelled { opacity:.6; }
  .contract-head {
    display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;
    background:#f0fdfa; border-bottom:1px solid #99f6e4; padding:6px 10px; font-size:10px;
  }
  .contract-head strong { color:#0f766e; font-size:11px; }
  .contract-head .ref { color:#475569; font-size:8.5px; margin-inline-start:6px; }
  .contract-body { padding:7px 10px; }
  .cgroup { margin-bottom:6px; }
  .cgroup:last-child { margin-bottom:0; }
  .cg-title { font-size:8px; font-weight:800; text-transform:uppercase; letter-spacing:.8px; color:#0f766e; margin-bottom:3px; }
  .cgrid { display:flex; flex-wrap:wrap; gap:3px 14px; }
  .cf { min-width:120px; }
  .cf .k { display:block; font-size:7.5px; font-weight:700; text-transform:uppercase; letter-spacing:.5px; color:#64748b; }
  .cf .v { display:block; font-size:9.5px; font-weight:700; }
  table.mini { font-size:8.5px; }
  table.mini thead th { font-size:7.5px; padding:3px 5px; background:#334155; }
  table.mini tbody td { padding:3px 5px; }
  .totals { display:flex; flex-wrap:wrap; gap:6px; margin-top:5px; }
  .totals > div { flex:1; min-width:90px; border:1px solid #e2e8f0; border-radius:6px; padding:4px 7px; background:#f8fafc; }
  .totals span { display:block; font-size:7.5px; font-weight:700; text-transform:uppercase; color:#64748b; }
  .totals strong { display:block; font-size:10.5px; }
  .totals .ok strong { color:#047857; }
  .totals .bad strong { color:#be123c; }
  .totals .acc strong { color:#b45309; }
  .cnote { font-size:8.5px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:5px; padding:4px 7px; white-space:pre-wrap; }

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

  @page { size:A4; margin:8mm; }
  @media print { body { padding:0; } .page { margin:0; max-width:none; padding:0; } }
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

  ${reservations.length > 0 ? `
  <h2 class="section">${T('Détail complet des contrats', 'التفاصيل الكاملة للعقود', lang)} (${reservations.length})</h2>
  ${contractCards}` : ''}

  <h2 class="section">${T('Détail des dépenses du véhicule', 'تفاصيل مصاريف المركبة', lang)} (${expenses.length})</h2>
  ${expenses.length > 0 ? `
  ${isConsignment ? `<p class="note" style="margin:0 0 7px">${T(
    'Véhicule en conciergerie : ces dépenses sont à la charge du propriétaire et sont déduites de sa part.',
    'مركبة في نظام الوكالة: هذه المصاريف على حساب المالك وتُخصم من حصته.',
    lang)}</p>` : ''}
  <table class="exp-table">
    <thead>
      <tr>
        <th class="num" style="width:22px">#</th>
        <th style="width:62px">${T('Date', 'التاريخ', lang)}</th>
        <th style="width:24%">${T('Type / Désignation', 'النوع / التسمية', lang)}</th>
        <th>${T('Détails', 'التفاصيل', lang)}</th>
        <th class="num" style="width:44px">%</th>
        <th class="num" style="width:78px">${T('Montant', 'المبلغ', lang)}</th>
      </tr>
    </thead>
    <tbody>${expRows}</tbody>
    <tfoot>
      <tr>
        <td colspan="4">${T('TOTAL DES DÉPENSES', 'إجمالي المصاريف', lang)}</td>
        <td class="num">100 %</td>
        <td class="num bad nowrap">−${fmt(totalExp)}</td>
      </tr>
    </tfoot>
  </table>

  <h2 class="section">${T('Récapitulatif des dépenses par type', 'ملخص المصاريف حسب النوع', lang)}</h2>
  <table>
    <thead>
      <tr>
        <th>${T('Type', 'النوع', lang)}</th>
        <th class="num">${T('Postes', 'البنود', lang)}</th>
        <th class="num">${T('Part', 'النسبة', lang)}</th>
        <th class="num">${T('Total', 'الإجمالي', lang)}</th>
      </tr>
    </thead>
    <tbody>${expTypeRows}</tbody>
    <tfoot>
      <tr>
        <td>${T('TOTAL', 'الإجمالي', lang)}</td>
        <td class="num">${expenses.length}</td>
        <td class="num">100 %</td>
        <td class="num bad">−${fmt(totalExp)}</td>
      </tr>
    </tfoot>
  </table>` : `<p class="note">${T('Aucune dépense sur la période.', 'لا توجد مصاريف في هذه الفترة.', lang)}</p>`}

  ${isConsignment && longRows ? `
  <h2 class="section">${T('Frais longue durée refacturés au propriétaire', 'رسوم المدة الطويلة على المالك', lang)} (${ownerLongDurationItems.length})</h2>
  <table>
    <thead>
      <tr>
        <th class="num">#</th>
        <th>${T('Client', 'العميل', lang)}</th>
        <th class="num">${T('Jours', 'أيام', lang)}</th>
        <th class="num">${T('Montant', 'المبلغ', lang)}</th>
      </tr>
    </thead>
    <tbody>${longRows}</tbody>
    <tfoot>
      <tr>
        <td colspan="3">${T('TOTAL', 'الإجمالي', lang)}</td>
        <td class="num">+${fmt(longFee)}</td>
      </tr>
    </tfoot>
  </table>` : ''}

  <h2 class="section">${isConsignment
    ? T('Calcul des parts agence / propriétaire', 'حساب حصتي الوكالة والمالك', lang)
    : T('Calcul du bénéfice', 'حساب الربح', lang)}</h2>
  <div class="calc">${calcHtml}</div>

  ${isConsignment ? `
  <div class="note">
    <strong>${T('Récapitulatif du règlement', 'ملخص التسوية', lang)} :</strong>
    ${T(
      `Sur ${fmt(split!.gross)} DA de locations pour ce véhicule, la part de l'agence s'élève à ${fmt(split!.agencyPart)} DA (commission${split!.ownerDelivery > 0 ? ' + livraison à charge du propriétaire' : ''}${split!.longFee > 0 ? ' + frais longue durée' : ''}), sans aucune dépense déduite. La part brute du propriétaire est de ${fmt(split!.ownerGross)} DA${split!.longFee > 0 ? `, moins ${fmt(split!.longFee)} DA de frais longue durée` : ''} et ${fmt(split!.expenses)} DA de dépenses du véhicule à sa charge : il reste ${fmt(split!.ownerNet)} DA net à reverser au propriétaire.`,
      `من أصل ${fmt(split!.gross)} دج من إيجارات هذه المركبة، تبلغ حصة الوكالة ${fmt(split!.agencyPart)} دج دون خصم أي مصاريف. حصة المالك الإجمالية ${fmt(split!.ownerGross)} دج${split!.longFee > 0 ? `، ناقص ${fmt(split!.longFee)} دج رسوم مدة طويلة` : ''} و${fmt(split!.expenses)} دج من مصاريف المركبة على حسابه: يبقى ${fmt(split!.ownerNet)} دج صافيًا مستحقًا للمالك.`,
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
