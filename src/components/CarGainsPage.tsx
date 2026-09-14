import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Calendar, TrendingUp, ChevronDown, Printer, Loader2, AlertCircle, Download,
  Clock, Handshake, Phone, User as UserIcon, Receipt, BarChart3,
  ArrowRight, Gauge, Coins, FileText, CarFront, Sparkles,
} from 'lucide-react';
import { Language, Car, ReservationDetails, VehicleExpense } from '../types';
import { DatabaseService } from '../services/DatabaseService';
import { ReservationsService } from '../services/ReservationsService';
import { getVehicleExpenses } from '../services/expenseService';
import { getCarsWithOwners } from '../services/carService';
import {
  calcPaid, inRange, pct, fmtPct, computeVehicleGains, commissionBreakdown,
} from '../utils/gainsMath';
import { normalizeCommissionType } from '../utils/consignmentMath';
import { PctChip, SplitBar, SplitLegend, CalcRow } from './gains/GainsUI';
import { BenefitCard, BenefitDrawer } from './gains/BenefitCards';
import { CarSelector } from './gains/CarSelector';
import { generateVehicleBenefitReportHTML } from './gains/VehicleBenefitReport';
import { eurOrUndefined } from '../utils/currency';
import html2pdf from 'html2pdf.js';

interface CarGainsPageProps {
  lang: Language;
}

const T = (fr: string, ar: string, lang: Language) => (lang === 'fr' ? fr : ar);
const fmt = (n: number) => Math.round(n || 0).toLocaleString('fr-DZ');
const fmtD = (d: string) => {
  try {
    return new Date(d).toLocaleDateString('fr-FR');
  } catch {
    return d || '';
  }
};

const STATUS_META: Record<string, { fr: string; ar: string; cls: string }> = {
  pending:   { fr: 'En attente', ar: 'قيد الانتظار', cls: 'bg-amber-50 text-amber-700 ring-amber-200' },
  accepted:  { fr: 'Acceptée',   ar: 'مقبول',        cls: 'bg-sky-50 text-sky-700 ring-sky-200' },
  confirmed: { fr: 'Confirmée',  ar: 'مؤكد',         cls: 'bg-blue-50 text-blue-700 ring-blue-200' },
  active:    { fr: 'En cours',   ar: 'جارية',        cls: 'bg-teal-50 text-teal-700 ring-teal-200' },
  completed: { fr: 'Terminée',   ar: 'منتهية',       cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  cancelled: { fr: 'Annulée',    ar: 'ملغاة',        cls: 'bg-slate-100 text-slate-500 ring-slate-200' },
};

/** Raccourcis de période — l'agence raisonne en mois, pas en dates saisies. */
const periodPresets = (lang: Language) => {
  const today = new Date();
  const iso = (d: Date) => d.toISOString().split('T')[0];
  const shift = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return iso(d);
  };
  return [
    { key: '30d', label: T('30 jours', '30 يومًا', lang), start: shift(30), end: iso(today) },
    { key: '90d', label: T('3 mois', '3 أشهر', lang), start: shift(90), end: iso(today) },
    {
      key: 'month',
      label: T('Mois en cours', 'الشهر الجاري', lang),
      start: iso(new Date(today.getFullYear(), today.getMonth(), 1)),
      end: iso(today),
    },
    {
      key: 'year',
      label: T('Année en cours', 'السنة الجارية', lang),
      start: iso(new Date(today.getFullYear(), 0, 1)),
      end: iso(today),
    },
  ];
};

type DrawerKey = 'gains' | 'expenses' | 'net' | null;

export const CarGainsPage: React.FC<CarGainsPageProps> = ({ lang }) => {
  const [cars, setCars] = useState<Car[]>([]);
  const [carsLoading, setCarsLoading] = useState(true);
  const [selectedCarId, setSelectedCarId] = useState<string>('');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [reservations, setReservations] = useState<ReservationDetails[]>([]);
  const [expenses, setExpenses] = useState<VehicleExpense[]>([]);
  const [expandedRes, setExpandedRes] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<DrawerKey>(null);

  // Chargement AVEC les propriétaires : sans le barème, aucune commission de
  // conciergerie ne peut être calculée (page réservée à l'admin).
  useEffect(() => {
    const loadCars = async () => {
      try {
        const result = await getCarsWithOwners();
        if (result.success && result.cars) {
          const mapped: Car[] = result.cars.map((dbCar: any) => ({
            id: dbCar.id || '',
            brand: dbCar.brand,
            model: dbCar.model,
            registration: dbCar.plate_number,
            year: dbCar.year,
            color: dbCar.color || 'Premium',
            vin: dbCar.vin || '',
            energy: dbCar.energy || 'Essence',
            transmission: dbCar.transmission || 'Automatique',
            seats: dbCar.seats || 5,
            doors: dbCar.doors || 4,
            priceDay: Math.round(Number(dbCar.price_per_day)),
            priceWeek: Math.round(Number(dbCar.price_week || dbCar.price_per_day * 2)),
            priceMonth: Math.round(Number(dbCar.price_month || dbCar.price_per_day * 4)),
            deposit: Math.round(Number(dbCar.deposit || dbCar.price_per_day * 2)),
            priceDayEur: eurOrUndefined(dbCar.price_day_eur),
            priceWeekEur: eurOrUndefined(dbCar.price_week_eur),
            priceMonthEur: eurOrUndefined(dbCar.price_month_eur),
            depositEur: eurOrUndefined(dbCar.deposit_eur),
            images: dbCar.image_url ? [dbCar.image_url] : ['https://picsum.photos/seed/car/400/300'],
            mileage: dbCar.mileage || 0,
            status: dbCar.status === 'maintenance' ? 'maintenance' : 'disponible',
            ownershipType: dbCar.ownership_type === 'consignment' ? 'consignment' : 'personal',
            ownerInfo: dbCar.owner
              ? {
                  carId: dbCar.id || '',
                  ownerName: dbCar.owner.owner_name,
                  ownerPhone: dbCar.owner.owner_phone || undefined,
                  internalRef: dbCar.owner.internal_ref || undefined,
                  consignmentDate: dbCar.owner.consignment_date || undefined,
                  commissionType: normalizeCommissionType(dbCar.owner.commission_type),
                  commissionValue: Number(dbCar.owner.commission_value || 0),
                  deliveryFeeEnabled: dbCar.owner.delivery_fee_enabled ?? true,
                  deliveryThresholdDays: dbCar.owner.delivery_threshold_days != null
                    ? Number(dbCar.owner.delivery_threshold_days) : undefined,
                  deliveryFeeAmount: dbCar.owner.delivery_fee_amount != null
                    ? Number(dbCar.owner.delivery_fee_amount) : undefined,
                }
              : null,
          }));
          setCars(mapped);
        }
      } catch (err) {
        console.error('Error loading cars:', err);
      } finally {
        setCarsLoading(false);
      }
    };
    loadCars();
  }, []);

  const handleGenerate = async () => {
    if (!selectedCarId || !startDate || !endDate) {
      alert(T('Veuillez sélectionner un véhicule et les dates.', 'يرجى تحديد المركبة والتواريخ.', lang));
      return;
    }

    setLoading(true);
    try {
      const [resList, expList] = await Promise.all([
        ReservationsService.getReservations(),
        (async () => {
          const res = await getVehicleExpenses();
          return res.expenses || [];
        })(),
      ]);

      const carRes = resList
        .filter(
          r => (r.carId || r.car?.id) === selectedCarId
            && inRange(r.step1?.departureDate || r.createdAt || '', startDate, endDate),
        )
        .sort((a, b) =>
          new Date(b.step1?.departureDate || b.createdAt || 0).getTime()
          - new Date(a.step1?.departureDate || a.createdAt || 0).getTime());

      const carExp = expList
        .filter(e => e.carId === selectedCarId && inRange(e.date, startDate, endDate))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setReservations(carRes);
      setExpenses(carExp);
      setGenerated(true);
    } catch (err) {
      console.error('Error loading data:', err);
      alert(T('Erreur lors du chargement des données.', 'خطأ في تحميل البيانات.', lang));
    } finally {
      setLoading(false);
    }
  };

  const selectedCar = cars.find(c => c.id === selectedCarId);

  // Tous les agrégats viennent du socle partagé : la page « Rapports » applique
  // exactement les mêmes formules sur les mêmes données.
  const g = useMemo(
    () => computeVehicleGains(selectedCar, reservations, expenses),
    [selectedCar, reservations, expenses],
  );
  const { consignment, owner } = g;

  const periodDays = Math.max(
    1,
    Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000) + 1,
  );
  const occupancy = Math.min(100, pct(g.daysRented, periodDays));

  /** Les trois chiffres du haut : gains, dépenses, bénéfice. */
  const gainsValue = g.agencyRevenuePeriod;
  const netValue = consignment ? g.netBenefitPeriod : g.netBenefit;
  const marginValue = pct(netValue, gainsValue);

  const buildReportHTML = async (): Promise<string | null> => {
    if (!selectedCar) return null;
    const agency = await DatabaseService.getAgencyBranding();
    return generateVehicleBenefitReportHTML({
      car: selectedCar, gains: g, reservations, expenses, startDate, endDate, agency, lang,
    });
  };

  const handlePrint = async () => {
    try {
      const html = await buildReportHTML();
      if (!html) return;

      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      document.body.appendChild(iframe);

      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(html);
        doc.close();
        setTimeout(() => {
          iframe.contentWindow?.print();
          setTimeout(() => document.body.removeChild(iframe), 150);
        }, 300);
      }
    } catch (err) {
      console.error('Error printing report:', err);
      alert(T("Erreur lors de l'impression.", 'خطأ في الطباعة.', lang));
    }
  };

  /** Téléchargement direct du PDF (le rapport de conciergerie se remet au propriétaire). */
  const handleDownloadPdf = async () => {
    if (!selectedCar) return;
    setExporting(true);
    try {
      const html = await buildReportHTML();
      if (!html) return;

      const holder = document.createElement('div');
      holder.innerHTML = html;
      const fileBase = [
        T('rapport', 'تقرير', lang),
        selectedCar.brand, selectedCar.model, selectedCar.registration, startDate, endDate,
      ].join('-').replace(/[^\w؀-ۿ-]+/g, '-');

      await (html2pdf() as any)
        .set({
          margin: 0,
          filename: `${fileBase}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { orientation: 'portrait', unit: 'mm', format: 'a4' },
          pagebreak: { mode: ['css', 'legacy'] },
        })
        .from(holder)
        .save();
    } catch (err) {
      console.error('Error exporting PDF:', err);
      alert(T("Erreur lors de l'export PDF.", 'خطأ في تصدير PDF.', lang));
    } finally {
      setExporting(false);
    }
  };

  /** Le barème du propriétaire, écrit tel qu'il s'applique. */
  const scaleLabel = owner
    ? owner.commissionType === 'percentage'
      ? `${owner.commissionValue.toLocaleString('fr-FR')} %`
      : owner.commissionType === 'per_day'
        ? `${fmt(owner.commissionValue)} ${T('DA/jour', 'دج/يوم', lang)}`
        : `${fmt(owner.commissionValue)} DA`
    : '';

  const scaleUnitLabel = owner
    ? owner.commissionType === 'percentage'
      ? T('du total de chaque location', 'من إجمالي كل إيجار', lang)
      : owner.commissionType === 'per_day'
        ? T('par jour loué', 'لكل يوم كراء', lang)
        : T('par location', 'لكل إيجار', lang)
    : '';

  // ── Parts « période » (conciergerie) : sur toutes les locations non annulées ──
  const agencySharePeriod = consignment ? pct(consignment.agencyGainTotal, consignment.grossAll) : 100;
  const ownerSharePeriod = consignment ? pct(consignment.ownerPayoutTotal, consignment.grossAll) : 0;
  const effectiveCommissionRatePeriod = consignment
    ? pct(consignment.commissionTotal, consignment.grossAll) : 0;
  const expenseRatio = pct(g.expenses, gainsValue);

  const presets = periodPresets(lang);
  const dateField =
    'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-200';

  return (
    <div className="space-y-6 pb-12">
      {/* ── En-tête ─────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl bg-slate-900 text-white shadow-xl"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-700 via-teal-800 to-slate-900" />
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 18% 20%, #fff 0, transparent 42%), radial-gradient(circle at 82% 80%, #fff 0, transparent 38%)',
          }}
        />
        <div className="relative flex flex-wrap items-center justify-between gap-5 p-6 sm:p-8">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/25">
              <BarChart3 size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
                {T('Bénéfices par véhicule', 'أرباح المركبات', lang)}
              </h1>
              <p className="mt-1 text-sm text-emerald-100/80">
                {T(
                  'Gains, dépenses et bénéfice net de chaque voiture — avec le détail de chaque calcul',
                  'الأرباح والمصاريف وصافي الربح لكل سيارة — مع تفصيل كل عملية حسابية',
                  lang,
                )}
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-2 text-[11px] font-bold uppercase tracking-wider ring-1 ring-white/20">
            <Sparkles size={12} />
            {cars.length} {T('véhicules', 'مركبة', lang)}
          </span>
        </div>
      </motion.div>

      {/* ── Étape 1 : choix du véhicule ─────────────────────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6"
      >
        <div className="mb-4 flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-600 text-xs font-black text-white">
            1
          </span>
          <h2 className="text-sm font-extrabold uppercase tracking-wide text-slate-700">
            {T('Choisir le véhicule', 'اختر المركبة', lang)}
          </h2>
        </div>

        {carsLoading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm font-semibold text-slate-400">
            <Loader2 size={16} className="animate-spin" />
            {T('Chargement de la flotte…', 'جارٍ تحميل الأسطول…', lang)}
          </div>
        ) : (
          <CarSelector
            cars={cars}
            selectedCarId={selectedCarId}
            onSelect={id => {
              setSelectedCarId(id);
              setGenerated(false);
            }}
            lang={lang}
          />
        )}
      </motion.section>

      {/* ── Étape 2 : période + génération ──────────────────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6"
      >
        <div className="mb-4 flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-600 text-xs font-black text-white">
            2
          </span>
          <h2 className="text-sm font-extrabold uppercase tracking-wide text-slate-700">
            {T('Définir la période', 'حدّد الفترة', lang)}
          </h2>
        </div>

        <div className="mb-4 flex flex-wrap gap-1.5">
          {presets.map(p => {
            const active = p.start === startDate && p.end === endDate;
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => { setStartDate(p.start); setEndDate(p.end); setGenerated(false); }}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  active
                    ? 'bg-teal-600 text-white shadow-sm'
                    : 'bg-slate-50 text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100'
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
              {T('Date de début', 'تاريخ البداية', lang)}
            </label>
            <input
              type="date"
              value={startDate}
              onChange={e => { setStartDate(e.target.value); setGenerated(false); }}
              className={dateField}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
              {T('Date de fin', 'تاريخ النهاية', lang)}
            </label>
            <input
              type="date"
              value={endDate}
              onChange={e => { setEndDate(e.target.value); setGenerated(false); }}
              className={dateField}
            />
          </div>
          <div className="flex items-end lg:col-span-2">
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={handleGenerate}
              disabled={loading || !selectedCarId}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 px-5 py-3 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-teal-600/20 transition hover:from-teal-700 hover:to-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  {T('Génération…', 'جارٍ…', lang)}
                </>
              ) : (
                <>
                  <TrendingUp size={16} />
                  {T('Générer le rapport', 'إنشاء التقرير', lang)}
                </>
              )}
            </motion.button>
          </div>
        </div>

        {!selectedCarId && !carsLoading && (
          <p className="mt-3 text-xs font-semibold text-slate-400">
            {T('Sélectionnez d’abord un véhicule ci-dessus.', 'اختر مركبة أولًا في الأعلى.', lang)}
          </p>
        )}
      </motion.section>

      <AnimatePresence mode="wait">
        {!generated && !loading && (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center justify-center py-16"
          >
            <div className="max-w-md text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-50 text-teal-300">
                <BarChart3 size={30} />
              </div>
              <p className="mb-1.5 text-base font-bold text-slate-700">
                {T('Prêt à analyser vos bénéfices ?', 'هل أنت مستعد لتحليل أرباحك؟', lang)}
              </p>
              <p className="text-sm text-slate-400">
                {T(
                  'Choisissez un véhicule et une période, puis générez le rapport pour voir le détail des calculs.',
                  'اختر مركبة وفترة، ثم أنشئ التقرير لعرض تفاصيل الحسابات.',
                  lang,
                )}
              </p>
            </div>
          </motion.div>
        )}

        {generated && !loading && selectedCar && (
          <motion.div
            key="report"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-5"
          >
            {/* ── Les trois chiffres, cliquables ── */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <BenefitCard
                index={0}
                tone="gain"
                icon={<Coins size={17} />}
                label={consignment
                  ? T('Total des gains des locations (agence)', 'إجمالي أرباح الإيجارات (الوكالة)', lang)
                  : T('Total des gains des locations', 'إجمالي أرباح الإيجارات', lang)}
                value={gainsValue}
                hint={`${g.rentals} ${T('location(s)', 'إيجار', lang)} · ${g.daysRented} ${T('jours loués', 'يوم كراء', lang)}`}
                formula={consignment
                  ? `${fmt(consignment.commissionTotal)}${consignment.ownerDeliveryFeesAll > 0 ? ` + ${fmt(consignment.ownerDeliveryFeesAll)}` : ''}`
                  : undefined}
                detailLabel={T('Voir le détail', 'عرض التفاصيل', lang)}
                onOpen={() => setDrawer('gains')}
              />
              <BenefitCard
                index={1}
                tone="expense"
                icon={<Receipt size={17} />}
                label={T('Total des dépenses', 'إجمالي المصاريف', lang)}
                value={g.expenses}
                hint={`${expenses.length} ${T('poste(s)', 'بند', lang)} · ${fmtPct(expenseRatio)} ${T('des gains', 'من الأرباح', lang)}`}
                detailLabel={T('Voir le détail', 'عرض التفاصيل', lang)}
                onOpen={() => setDrawer('expenses')}
              />
              <BenefitCard
                index={2}
                tone={netValue >= 0 ? 'net' : 'netNegative'}
                icon={<TrendingUp size={17} />}
                label={T('Total bénéfice', 'إجمالي الربح', lang)}
                value={netValue}
                hint={`${T('marge', 'الهامش', lang)} ${fmtPct(marginValue)}`}
                formula={`${fmt(gainsValue)} − ${fmt(g.expenses)}`}
                detailLabel={T('Voir le calcul', 'عرض الحساب', lang)}
                onOpen={() => setDrawer('net')}
              />
            </div>

            {/* ── Identité du véhicule ── */}
            <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
              <div className="flex flex-col items-center gap-5 p-5 sm:flex-row">
                <div className="h-24 w-32 shrink-0 overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-slate-200">
                  <img
                    src={selectedCar.images?.[0] || 'https://picsum.photos/seed/car/400/300'}
                    alt={`${selectedCar.brand} ${selectedCar.model}`}
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="flex-1 text-center sm:text-start">
                  <div className="flex flex-wrap items-center justify-center gap-2.5 sm:justify-start">
                    <h2 className="text-xl font-black tracking-tight text-slate-900">
                      {selectedCar.brand} {selectedCar.model}
                    </h2>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${
                        g.isConsignment
                          ? 'bg-amber-50 text-amber-700 ring-amber-200'
                          : 'bg-teal-50 text-teal-700 ring-teal-200'
                      }`}
                    >
                      {g.isConsignment ? <Handshake size={11} /> : <CarFront size={11} />}
                      {g.isConsignment
                        ? T('Conciergerie', 'وكالة', lang)
                        : T('Véhicule de l’agence', 'مركبة الوكالة', lang)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm font-bold text-teal-600" dir="ltr">{selectedCar.registration}</p>
                  <div className="mt-3 flex flex-wrap justify-center gap-1.5 sm:justify-start">
                    {[
                      `${selectedCar.year}`,
                      selectedCar.color,
                      selectedCar.energy,
                      `${selectedCar.mileage.toLocaleString('fr-FR')} km`,
                    ].filter(Boolean).map(chip => (
                      <span
                        key={chip}
                        className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600"
                      >
                        {chip}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Taux d'occupation — le seul % qui parle d'exploitation, pas d'argent. */}
                <div className="w-full shrink-0 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200 sm:w-48">
                  <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    <Gauge size={12} />
                    {T('Taux d’occupation', 'معدل الإشغال', lang)}
                  </div>
                  <p className="text-2xl font-black tabular-nums text-slate-900">{fmtPct(occupancy)}</p>
                  <p className="mt-0.5 text-[11px] font-medium tabular-nums text-slate-400">
                    {g.daysRented} / {periodDays} {T('jours', 'يوم', lang)}
                  </p>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${occupancy}%` }}
                      transition={{ duration: 0.6 }}
                      className="h-full rounded-full bg-teal-500"
                    />
                  </div>
                </div>
              </div>

              {g.isConsignment && owner && (
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-amber-100 bg-amber-50/70 px-5 py-3">
                  <span className="flex items-center gap-1.5 text-sm font-bold text-amber-900">
                    <UserIcon size={14} />
                    {owner.ownerName}
                    {owner.internalRef && (
                      <span className="rounded bg-amber-200/70 px-1.5 py-0.5 text-[11px] font-bold" dir="ltr">
                        {owner.internalRef}
                      </span>
                    )}
                  </span>
                  {owner.ownerPhone && (
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-800" dir="ltr">
                      <Phone size={12} />
                      {owner.ownerPhone}
                    </span>
                  )}
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-800 ring-1 ring-amber-200">
                    {T('Commission', 'العمولة', lang)} : {scaleLabel} · {scaleUnitLabel}
                  </span>
                </div>
              )}
            </div>

            {/* ── 🤝 Détail du calcul — conciergerie ── */}
            {consignment && owner && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-amber-200"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-100 bg-amber-50 px-5 py-3.5">
                  <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-amber-800">
                    <Handshake size={16} />
                    {T('Répartition avec le propriétaire', 'التوزيع مع المالك', lang)}
                  </h3>
                  <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-amber-700 ring-1 ring-amber-200">
                    {g.rentals} {T('location(s)', 'إيجار', lang)}
                    {consignment.completedCount > 0 && (
                      <> · {consignment.completedCount} {T('terminée(s)', 'منتهي', lang)}</>
                    )}
                  </span>
                </div>

                <div className="p-5">
                  <div className="divide-y divide-slate-100">
                    <CalcRow
                      label={T('CA des locations de la période', 'رقم أعمال إيجارات الفترة', lang)}
                      formula={`${g.rentals} ${T('location(s)', 'إيجار', lang)} · ${g.daysRented} ${T('jours loués', 'يوم كراء', lang)}`}
                      amount={consignment.grossAll}
                      share={100}
                      tone="slate"
                    />
                    <CalcRow
                      sign="−"
                      label={T('Commission agence', 'عمولة الوكالة', lang)}
                      formula={
                        owner.commissionType === 'percentage'
                          ? `${fmt(consignment.grossAll)} × ${scaleLabel} = ${fmt(consignment.commissionTotal)}`
                          : owner.commissionType === 'per_day'
                            ? `${g.daysRented} ${T('j', 'ي', lang)} × ${scaleLabel} = ${fmt(consignment.commissionTotal)}`
                            : `${g.rentals} × ${scaleLabel} = ${fmt(consignment.commissionTotal)}`
                      }
                      amount={consignment.commissionTotal}
                      share={effectiveCommissionRatePeriod}
                      tone="amber"
                    />
                    {consignment.ownerDeliveryFeesAll > 0 && (
                      <CalcRow
                        sign="−"
                        label={T(
                          `Livraison à charge du propriétaire (≥ ${owner.deliveryThresholdDays ?? 10} jours)`,
                          `التوصيل على حساب المالك (≥ ${owner.deliveryThresholdDays ?? 10} أيام)`,
                          lang,
                        )}
                        amount={consignment.ownerDeliveryFeesAll}
                        share={pct(consignment.ownerDeliveryFeesAll, consignment.grossAll)}
                        tone="amber"
                      />
                    )}
                    <CalcRow
                      sign="="
                      label={T('À reverser au propriétaire', 'المستحق للمالك', lang)}
                      amount={consignment.ownerPayoutTotal}
                      share={ownerSharePeriod}
                      tone="slate"
                      strong
                    />
                  </div>

                  <div className="mt-5 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                    <div className="mb-2.5 flex items-center justify-between">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                        {T('Répartition du CA de la période', 'توزيع رقم أعمال الفترة', lang)}
                      </p>
                      <p className="text-[11px] font-bold tabular-nums text-slate-500">
                        {fmt(consignment.grossAll)} DA
                      </p>
                    </div>
                    <SplitBar
                      segments={[
                        { value: consignment.commissionTotal, label: T('Commission', 'العمولة', lang), cls: 'bg-teal-500' },
                        { value: consignment.ownerDeliveryFeesAll, label: T('Livraison', 'التوصيل', lang), cls: 'bg-teal-300' },
                        { value: consignment.ownerPayoutTotal, label: T('Propriétaire', 'المالك', lang), cls: 'bg-slate-400' },
                      ]}
                    />
                    <SplitLegend
                      items={[
                        { label: T('Agence', 'الوكالة', lang), cls: 'bg-teal-500', pct: agencySharePeriod, tone: 'emerald' },
                        { label: T('Propriétaire', 'المالك', lang), cls: 'bg-slate-400', pct: ownerSharePeriod, tone: 'slate' },
                      ]}
                    />
                  </div>

                  {consignment.pendingCount > 0 && consignment.completedCount > 0 && (
                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl bg-emerald-50 px-4 py-2.5 ring-1 ring-emerald-200">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700">
                          {T('Commission acquise (terminées)', 'عمولة مكتسبة (منتهية)', lang)}
                        </p>
                        <p className="mt-0.5 text-sm font-black tabular-nums text-emerald-800">
                          {fmt(consignment.commissionEarned)} <span className="text-[10px] text-emerald-500">DA</span>
                        </p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 px-4 py-2.5 ring-1 ring-slate-200">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                          {T('Commission estimée (en cours)', 'عمولة مقدرة (جارية)', lang)}
                        </p>
                        <p className="mt-0.5 text-sm font-black tabular-nums text-slate-700">
                          +{fmt(consignment.commissionPending)} <span className="text-[10px] text-slate-400">DA</span>
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Le taux constaté peut s'écarter du barème : les commissions sont
                      figées à la clôture, un barème modifié après coup ne recalcule
                      pas le passé. */}
                  {owner.commissionType === 'percentage'
                    && consignment.completedCount > 0
                    && Math.abs(effectiveCommissionRatePeriod - owner.commissionValue) > 0.5 && (
                      <p className="mt-3 rounded-2xl bg-amber-50 px-4 py-2.5 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-200">
                        ℹ️ {T(
                          `Taux constaté ${fmtPct(effectiveCommissionRatePeriod)} contre ${scaleLabel} au barème — les commissions terminées sont figées à la clôture de chaque location.`,
                          `النسبة الفعلية ${fmtPct(effectiveCommissionRatePeriod)} مقابل ${scaleLabel} في الاتفاق — تُثبَّت عمولات الإيجارات المنتهية عند إغلاق كل إيجار.`,
                          lang,
                        )}
                      </p>
                    )}

                  {consignment.pendingCount > 0 && consignment.completedCount === 0 && (
                    <p className="mt-3 flex items-center gap-2 rounded-2xl bg-slate-50 px-4 py-2.5 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200">
                      <Clock size={13} className="shrink-0 text-slate-400" />
                      {consignment.pendingCount}{' '}
                      {T(
                        'location(s) en cours — commission estimée, acquise à la clôture',
                        'إيجار جارٍ — عمولة مقدرة، تُكتسب عند الإغلاق',
                        lang,
                      )}{' '}
                      : <strong className="tabular-nums">{fmt(consignment.commissionPending)} DA</strong>
                    </p>
                  )}
                </div>
              </motion.div>
            )}

            {/* ── Locations ── */}
            {reservations.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200"
              >
                <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-3.5">
                  <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-slate-700">
                    <Calendar size={16} />
                    {T('Liste des locations', 'قائمة الإيجارات', lang)}
                    <span className="rounded-md bg-white px-1.5 py-0.5 text-[11px] font-bold text-slate-500 ring-1 ring-slate-200">
                      {reservations.length}
                    </span>
                  </h3>
                  <span className="text-sm font-bold tabular-nums text-teal-700">
                    +{fmt(g.collected)} <span className="text-[10px] text-slate-400">DA</span>
                  </span>
                </div>

                <div className="divide-y divide-slate-100">
                  {reservations.map(res => {
                    const paid = calcPaid(res);
                    const debt = Number(res.remainingPayment) || 0;
                    const total = Number(res.totalPrice) || 0;
                    const isOpen = expandedRes === res.id;
                    const st = STATUS_META[res.status] || STATUS_META.pending;
                    const cb = owner && res.status !== 'cancelled' ? commissionBreakdown(res, owner) : null;
                    const weight = res.status === 'cancelled' ? 0 : pct(total, g.invoiced);

                    return (
                      <div key={res.id}>
                        <button
                          onClick={() => setExpandedRes(isOpen ? null : res.id)}
                          className="flex w-full items-center gap-3 px-5 py-3.5 text-start transition hover:bg-teal-50/40"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate text-sm font-bold text-slate-800">
                                {res.client?.firstName} {res.client?.lastName}
                              </p>
                              <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ring-1 ${st.cls}`}>
                                {T(st.fr, st.ar, lang)}
                              </span>
                              {weight > 0 && <PctChip value={weight} tone="slate" />}
                            </div>
                            <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                              <Clock size={12} />
                              <span className="tabular-nums" dir="ltr">
                                {fmtD(res.step1?.departureDate)} → {fmtD(res.step1?.returnDate)}
                              </span>
                              <span className="font-semibold text-slate-600">({res.totalDays}j)</span>
                              {(res.longDurationFee || 0) > 0 && (
                                <span className="rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-bold text-violet-700 ring-1 ring-violet-200">
                                  +{fmt(res.longDurationFee || 0)} {T('frais suppl.', 'رسوم إضافية', lang)}
                                </span>
                              )}
                            </p>
                          </div>

                          <div className="shrink-0 space-y-0.5 text-end">
                            <p className="text-sm font-bold tabular-nums text-teal-700">{fmt(paid)}</p>
                            {debt > 0 && res.status !== 'cancelled' && (
                              <p className="text-xs font-semibold tabular-nums text-amber-600">
                                {T('reste', 'متبقي', lang)} {fmt(debt)}
                              </p>
                            )}
                            {cb && (
                              <p className="flex items-center justify-end gap-1 text-xs font-semibold tabular-nums text-amber-700">
                                <Handshake size={10} />
                                {fmt(cb.agencyPart)}
                              </p>
                            )}
                          </div>

                          <ChevronDown
                            size={16}
                            className={`shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                          />
                        </button>

                        <AnimatePresence initial={false}>
                          {isOpen && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.22 }}
                              className="overflow-hidden border-t border-slate-100 bg-slate-50/70"
                            >
                              <div className="space-y-3 p-5">
                                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                  {[
                                    { l: T('Total', 'الإجمالي', lang), v: total, c: 'text-slate-900', p: weight },
                                    { l: T('Avance', 'الدفعة الأولى', lang), v: Number(res.advancePayment) || 0, c: 'text-blue-700', p: pct(Number(res.advancePayment) || 0, total) },
                                    { l: T('Payé', 'المدفوع', lang), v: paid, c: 'text-teal-700', p: pct(paid, total) },
                                    { l: T('Reste', 'المتبقي', lang), v: debt, c: debt > 0 ? 'text-amber-700' : 'text-teal-700', p: pct(debt, total) },
                                  ].map(item => (
                                    <div key={item.l} className="rounded-2xl bg-white p-3 ring-1 ring-slate-200">
                                      <p className="text-[11px] font-semibold text-slate-500">{item.l}</p>
                                      <p className={`mt-1 text-sm font-black tabular-nums ${item.c}`}>
                                        {fmt(item.v)}
                                        <span className="ms-1 text-[10px] font-semibold text-slate-400">DA</span>
                                      </p>
                                      <p className="mt-1 text-[10px] font-semibold tabular-nums text-slate-400">
                                        {fmtPct(item.p)}
                                      </p>
                                    </div>
                                  ))}
                                </div>

                                {/* Détail des suppléments facturés au client. */}
                                {((res.deliveryFee || 0) > 0 || (res.longDurationFee || 0) > 0) && (
                                  <div className="flex flex-wrap gap-2">
                                    {(res.longDurationFee || 0) > 0 && (
                                      <span className="rounded-xl bg-violet-50 px-3 py-2 text-[11px] font-semibold text-violet-800 ring-1 ring-violet-200">
                                        {T('Frais supplémentaires longue durée', 'رسوم إضافية للمدة الطويلة', lang)} :{' '}
                                        <strong className="tabular-nums">{fmt(res.longDurationFee || 0)} DA</strong>
                                      </span>
                                    )}
                                    {(res.deliveryFee || 0) > 0 && (
                                      <span className="rounded-xl bg-sky-50 px-3 py-2 text-[11px] font-semibold text-sky-800 ring-1 ring-sky-200">
                                        {T('Livraison', 'التوصيل', lang)} :{' '}
                                        <strong className="tabular-nums">{fmt(res.deliveryFee || 0)} DA</strong>
                                        {' · '}
                                        {res.deliveryFeePayer === 'owner'
                                          ? T('à charge du propriétaire', 'على عاتق المالك', lang)
                                          : T('facturée au client', 'تُفوتر على العميل', lang)}
                                      </span>
                                    )}
                                  </div>
                                )}

                                {/* Le calcul de commission, location par location. */}
                                {cb && owner && (
                                  <div className="rounded-2xl bg-white p-4 ring-1 ring-amber-200">
                                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-amber-800">
                                        <Handshake size={12} />
                                        {T('Calcul de la commission', 'حساب العمولة', lang)}
                                      </p>
                                      <span
                                        className={`rounded-md px-2 py-0.5 text-[10px] font-bold ring-1 ${
                                          cb.locked
                                            ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                                            : 'bg-slate-100 text-slate-500 ring-slate-200'
                                        }`}
                                      >
                                        {cb.locked
                                          ? T('Figée à la clôture', 'مثبتة عند الإغلاق', lang)
                                          : T('Estimée (en cours)', 'مقدرة (جارية)', lang)}
                                      </span>
                                    </div>

                                    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 font-mono text-xs font-semibold tabular-nums text-amber-900" dir="ltr">
                                      {owner.commissionType === 'per_day' ? (
                                        <>
                                          <span>{res.totalDays} {T('j', 'ي', lang)}</span>
                                          <span className="text-amber-400">×</span>
                                          <span>{scaleLabel}</span>
                                        </>
                                      ) : owner.commissionType === 'percentage' ? (
                                        <>
                                          <span>{fmt(cb.base)}</span>
                                          <span className="text-amber-400">×</span>
                                          <span>{scaleLabel}</span>
                                        </>
                                      ) : (
                                        <span>{scaleLabel}</span>
                                      )}
                                      <ArrowRight size={12} className="text-amber-400" />
                                      <span className="font-black">{fmt(cb.commission)} DA</span>
                                    </div>

                                    <div className="divide-y divide-slate-100">
                                      <CalcRow
                                        label={T('Base (total location)', 'الأساس (إجمالي الإيجار)', lang)}
                                        amount={cb.base}
                                        share={100}
                                        tone="slate"
                                      />
                                      <CalcRow
                                        sign="−"
                                        label={T('Commission agence', 'عمولة الوكالة', lang)}
                                        amount={cb.commission}
                                        share={cb.rate}
                                        tone="amber"
                                      />
                                      {cb.ownerDelivery > 0 && (
                                        <CalcRow
                                          sign="−"
                                          label={T('Livraison (propriétaire)', 'التوصيل (المالك)', lang)}
                                          formula={`${res.totalDays} ${T('jours ≥', 'أيام ≥', lang)} ${owner.deliveryThresholdDays ?? 10}`}
                                          amount={cb.ownerDelivery}
                                          share={pct(cb.ownerDelivery, cb.base)}
                                          tone="amber"
                                        />
                                      )}
                                      <CalcRow
                                        sign="="
                                        label={T('Part propriétaire', 'حصة المالك', lang)}
                                        amount={cb.ownerPart}
                                        share={pct(cb.ownerPart, cb.base)}
                                        tone="slate"
                                        strong
                                      />
                                    </div>

                                    <div className="mt-3">
                                      <SplitBar
                                        segments={[
                                          { value: cb.agencyPart, label: T('Agence', 'الوكالة', lang), cls: 'bg-teal-500' },
                                          { value: cb.ownerPart, label: T('Propriétaire', 'المالك', lang), cls: 'bg-slate-400' },
                                        ]}
                                      />
                                    </div>

                                    {cb.differsFromScale && (
                                      <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-500">
                                        {T(
                                          'Commission figée à la clôture — le barème actuel du propriétaire a été modifié depuis.',
                                          'العمولة مثبتة عند الإغلاق — تم تعديل اتفاق المالك منذ ذلك الحين.',
                                          lang,
                                        )}
                                      </p>
                                    )}
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-5 py-3 text-sm">
                  <span className="font-semibold text-slate-600">
                    {T('Total facturé', 'الإجمالي المفوتر', lang)}
                  </span>
                  <span className="font-black tabular-nums text-slate-900">
                    {fmt(g.invoiced)} <span className="text-[10px] font-semibold text-slate-400">DA</span>
                  </span>
                </div>
              </motion.div>
            )}

            {/* ── Dépenses ── */}
            {expenses.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200"
              >
                <div className="flex items-center justify-between border-b border-rose-100 bg-rose-50 px-5 py-3.5">
                  <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-rose-700">
                    <Receipt size={16} />
                    {T('Liste des dépenses', 'قائمة المصاريف', lang)}
                    <span className="rounded-md bg-white px-1.5 py-0.5 text-[11px] font-bold text-rose-600 ring-1 ring-rose-200">
                      {expenses.length}
                    </span>
                  </h3>
                  <span className="text-sm font-bold tabular-nums text-rose-700">
                    −{fmt(g.expenses)} <span className="text-[10px] text-rose-400">DA</span>
                  </span>
                </div>

                <div className="divide-y divide-slate-100">
                  {expenses.map(exp => {
                    const cost = Number(exp.cost) || 0;
                    return (
                      <div key={exp.id} className="flex items-center gap-3 px-5 py-3 transition hover:bg-rose-50/40">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-800">
                            {exp.expenseName || exp.type}
                          </p>
                          <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                            <span className="flex items-center gap-1">
                              <Calendar size={11} />
                              {fmtD(exp.date)}
                            </span>
                            {exp.currentMileage ? <span>{fmt(exp.currentMileage)} km</span> : null}
                            {exp.note ? <span className="truncate">{exp.note}</span> : null}
                          </p>
                        </div>
                        <PctChip value={pct(cost, g.expenses)} tone="rose" />
                        <span className="shrink-0 text-sm font-bold tabular-nums text-rose-700">
                          −{fmt(cost)}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between border-t border-rose-100 bg-rose-50 px-5 py-3 text-sm">
                  <span className="font-semibold text-rose-700">
                    {T('Total dépenses', 'إجمالي المصاريف', lang)}
                  </span>
                  <span className="font-black tabular-nums text-rose-700">
                    −{fmt(g.expenses)} <span className="text-[10px] font-semibold text-rose-400">DA</span>
                  </span>
                </div>
              </motion.div>
            )}

            {/* ── Résultat ── */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className={`overflow-hidden rounded-3xl p-5 text-white shadow-lg ${
                netValue >= 0
                  ? 'bg-gradient-to-br from-teal-600 via-emerald-700 to-slate-900'
                  : 'bg-gradient-to-br from-rose-600 to-rose-800'
              }`}
            >
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-white/60">
                    {consignment
                      ? T('Bénéfice net de l’agence (période)', 'صافي ربح الوكالة (الفترة)', lang)
                      : T('Bénéfice net', 'صافي الأرباح', lang)}
                  </p>
                  <p className="mt-1 text-4xl font-black tabular-nums leading-none">
                    {netValue >= 0 ? '+' : ''}{fmt(netValue)}
                    <span className="ms-1.5 text-base font-semibold text-white/50">DA</span>
                  </p>
                  <p className="mt-2 font-mono text-[11px] tabular-nums text-white/60" dir="ltr">
                    {consignment
                      ? `${fmt(consignment.commissionTotal)} + ${fmt(consignment.ownerDeliveryFeesAll)} − ${fmt(g.expenses)}`
                      : `${fmt(g.collected)} − ${fmt(g.expenses)}`}
                  </p>
                </div>
                <div className="rounded-2xl bg-white/10 px-4 py-3 text-end ring-1 ring-white/20">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-white/60">
                    {T('Marge', 'الهامش', lang)}
                  </p>
                  <p className="mt-0.5 text-2xl font-black tabular-nums">{fmtPct(marginValue)}</p>
                  <p className="mt-0.5 text-[10px] font-medium text-white/50">
                    {T('des gains des locations', 'من أرباح الإيجارات', lang)}
                  </p>
                </div>
              </div>
            </motion.div>

            {reservations.length === 0 && expenses.length === 0 && (
              <div className="flex items-center gap-3 rounded-3xl bg-slate-50 p-6 ring-1 ring-slate-200">
                <AlertCircle className="h-5 w-5 shrink-0 text-slate-400" />
                <p className="text-sm font-semibold text-slate-600">
                  {T('Aucune donnée pour cette période', 'لا توجد بيانات لهذه الفترة', lang)}
                </p>
              </div>
            )}

            {/* ── Export ── */}
            <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handlePrint}
                disabled={loading}
                className="flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-bold text-slate-800 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50 disabled:opacity-50"
              >
                <Printer size={16} />
                {T('Imprimer le rapport', 'طباعة التقرير', lang)}
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleDownloadPdf}
                disabled={exporting}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-teal-600/20 transition hover:from-teal-700 hover:to-emerald-700 disabled:opacity-50"
              >
                {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                {g.isConsignment
                  ? T('Télécharger le PDF (conciergerie)', 'تحميل PDF (وكالة)', lang)
                  : T('Télécharger le PDF', 'تحميل PDF', lang)}
              </motion.button>
            </div>

            {g.isConsignment && (
              <p className="flex items-center justify-center gap-1.5 text-center text-[11px] font-medium text-slate-400">
                <FileText size={12} />
                {T(
                  'Le PDF reprend l’agence et son logo, le propriétaire, le véhicule, les locations, les dépenses et le calcul complet du bénéfice.',
                  'يتضمّن ملف PDF الوكالة وشعارها والمالك والمركبة والإيجارات والمصاريف وحساب الربح الكامل.',
                  lang,
                )}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Tiroirs de détail des trois cartes ─────────────────────────── */}
      <BenefitDrawer
        open={drawer === 'gains'}
        accent="teal"
        onClose={() => setDrawer(null)}
        title={consignment
          ? T('Gains des locations — commission de l’agence', 'أرباح الإيجارات — عمولة الوكالة', lang)
          : T('Gains des locations', 'أرباح الإيجارات', lang)}
        subtitle={`${fmtD(startDate)} → ${fmtD(endDate)} · ${g.rentals} ${T('location(s)', 'إيجار', lang)}`}
      >
        {consignment && owner ? (
          <div className="space-y-4">
            <p className="rounded-2xl bg-teal-50 px-4 py-3 text-xs font-semibold text-teal-900 ring-1 ring-teal-200">
              {owner.commissionType === 'per_day'
                ? T(
                    `Barème : ${fmt(owner.commissionValue)} DA pour CHAQUE jour loué. ${g.daysRented} jour(s) loué(s) sur la période ⇒ ${fmt(consignment.commissionTotal)} DA de commission.`,
                    `الاتفاق: ${fmt(owner.commissionValue)} دج عن كل يوم كراء. ${g.daysRented} يوم خلال الفترة ⇒ ${fmt(consignment.commissionTotal)} دج عمولة.`,
                    lang)
                : owner.commissionType === 'percentage'
                  ? T(
                      `Barème : ${owner.commissionValue} % du total de chaque location ⇒ ${fmt(consignment.commissionTotal)} DA.`,
                      `الاتفاق: ${owner.commissionValue} % من إجمالي كل إيجار ⇒ ${fmt(consignment.commissionTotal)} دج.`,
                      lang)
                  : T(
                      `Barème : ${fmt(owner.commissionValue)} DA par location ⇒ ${fmt(consignment.commissionTotal)} DA.`,
                      `الاتفاق: ${fmt(owner.commissionValue)} دج لكل إيجار ⇒ ${fmt(consignment.commissionTotal)} دج.`,
                      lang)}
            </p>

            <div className="divide-y divide-slate-100">
              {reservations
                .filter(r => r.status !== 'cancelled')
                .map(r => {
                  const cb = commissionBreakdown(r, owner);
                  return (
                    <div key={r.id} className="flex items-center gap-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-slate-800">
                          {r.client?.firstName} {r.client?.lastName}
                        </p>
                        <p className="mt-0.5 font-mono text-[11px] tabular-nums text-slate-400" dir="ltr">
                          {owner.commissionType === 'per_day'
                            ? `${r.totalDays} j × ${fmt(owner.commissionValue)}`
                            : owner.commissionType === 'percentage'
                              ? `${fmt(cb.base)} × ${owner.commissionValue} %`
                              : `${fmt(owner.commissionValue)} DA`}
                          {cb.ownerDelivery > 0 ? ` + ${fmt(cb.ownerDelivery)} (livraison)` : ''}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-black tabular-nums text-teal-700">
                        {fmt(cb.agencyPart)}
                        <span className="ms-1 text-[10px] font-semibold text-slate-400">DA</span>
                      </span>
                    </div>
                  );
                })}
            </div>

            <div className="flex items-center justify-between rounded-2xl bg-slate-900 px-4 py-3 text-white">
              <span className="text-xs font-bold uppercase tracking-wide text-white/70">
                {T('Total gains agence', 'إجمالي أرباح الوكالة', lang)}
              </span>
              <span className="text-lg font-black tabular-nums text-emerald-300">
                {fmt(gainsValue)} <span className="text-[10px] text-white/50">DA</span>
              </span>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="rounded-2xl bg-teal-50 px-4 py-3 text-xs font-semibold text-teal-900 ring-1 ring-teal-200">
              {T(
                'Véhicule de l’agence : la totalité de l’encaissé revient à l’agence.',
                'مركبة الوكالة: كامل المبلغ المحصّل يعود للوكالة.',
                lang,
              )}
            </p>
            <div className="divide-y divide-slate-100">
              {reservations
                .filter(r => r.status !== 'cancelled')
                .map(r => (
                  <div key={r.id} className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-slate-800">
                        {r.client?.firstName} {r.client?.lastName}
                      </p>
                      <p className="mt-0.5 text-[11px] tabular-nums text-slate-400" dir="ltr">
                        {fmtD(r.step1?.departureDate)} → {fmtD(r.step1?.returnDate)} · {r.totalDays}j
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-black tabular-nums text-teal-700">
                      {fmt(calcPaid(r))}
                      <span className="ms-1 text-[10px] font-semibold text-slate-400">DA</span>
                    </span>
                  </div>
                ))}
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-slate-900 px-4 py-3 text-white">
              <span className="text-xs font-bold uppercase tracking-wide text-white/70">
                {T('Total encaissé', 'إجمالي المحصّل', lang)}
              </span>
              <span className="text-lg font-black tabular-nums text-emerald-300">
                {fmt(gainsValue)} <span className="text-[10px] text-white/50">DA</span>
              </span>
            </div>
          </div>
        )}
      </BenefitDrawer>

      <BenefitDrawer
        open={drawer === 'expenses'}
        accent="rose"
        onClose={() => setDrawer(null)}
        title={T('Dépenses du véhicule', 'مصاريف المركبة', lang)}
        subtitle={`${fmtD(startDate)} → ${fmtD(endDate)} · ${expenses.length} ${T('poste(s)', 'بند', lang)}`}
      >
        {expenses.length === 0 ? (
          <p className="text-sm font-semibold text-slate-500">
            {T('Aucune dépense sur la période.', 'لا توجد مصاريف في هذه الفترة.', lang)}
          </p>
        ) : (
          <div className="space-y-4">
            <div className="divide-y divide-slate-100">
              {expenses.map(exp => (
                <div key={exp.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-800">{exp.expenseName || exp.type}</p>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      {fmtD(exp.date)} · {exp.type}
                      {exp.note ? ` · ${exp.note}` : ''}
                    </p>
                  </div>
                  <PctChip value={pct(Number(exp.cost) || 0, g.expenses)} tone="rose" />
                  <span className="shrink-0 text-sm font-black tabular-nums text-rose-700">
                    −{fmt(Number(exp.cost) || 0)}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-rose-700 px-4 py-3 text-white">
              <span className="text-xs font-bold uppercase tracking-wide text-white/75">
                {T('Total dépenses', 'إجمالي المصاريف', lang)}
              </span>
              <span className="text-lg font-black tabular-nums">
                −{fmt(g.expenses)} <span className="text-[10px] text-white/60">DA</span>
              </span>
            </div>
          </div>
        )}
      </BenefitDrawer>

      <BenefitDrawer
        open={drawer === 'net'}
        accent="slate"
        onClose={() => setDrawer(null)}
        title={T('Calcul du bénéfice', 'حساب الربح', lang)}
        subtitle={`${selectedCar?.brand || ''} ${selectedCar?.model || ''} · ${fmtD(startDate)} → ${fmtD(endDate)}`}
      >
        <div className="divide-y divide-slate-100">
          {consignment ? (
            <>
              <CalcRow
                label={T('CA des locations', 'رقم أعمال الإيجارات', lang)}
                amount={consignment.grossAll}
                share={100}
                tone="slate"
              />
              <CalcRow
                sign="−"
                label={T('Part reversée au propriétaire', 'الحصة المستحقة للمالك', lang)}
                amount={consignment.ownerPayoutTotal}
                share={ownerSharePeriod}
                tone="slate"
              />
              <CalcRow
                sign="="
                label={T('Gains des locations (agence)', 'أرباح الإيجارات (الوكالة)', lang)}
                formula={`${T('commission', 'العمولة', lang)} ${fmt(consignment.commissionTotal)}${
                  consignment.ownerDeliveryFeesAll > 0 ? ` + ${T('livraison', 'التوصيل', lang)} ${fmt(consignment.ownerDeliveryFeesAll)}` : ''
                }`}
                amount={gainsValue}
                share={agencySharePeriod}
                tone="emerald"
              />
            </>
          ) : (
            <>
              <CalcRow
                label={T('Total facturé', 'الإجمالي المفوتر', lang)}
                amount={g.invoiced}
                share={100}
                tone="slate"
              />
              <CalcRow
                sign="="
                label={T('Gains des locations (encaissé)', 'أرباح الإيجارات (المحصّل)', lang)}
                amount={g.collected}
                share={g.collectionRate}
                tone="emerald"
              />
              <CalcRow
                sign="−"
                label={T('Reste à encaisser', 'المتبقي للتحصيل', lang)}
                amount={g.outstanding}
                share={pct(g.outstanding, g.invoiced)}
                tone="amber"
              />
            </>
          )}
          <CalcRow
            sign="−"
            label={T('Dépenses du véhicule', 'مصاريف المركبة', lang)}
            formula={`${expenses.length} ${T('poste(s)', 'بند', lang)}`}
            amount={g.expenses}
            share={expenseRatio}
            tone="rose"
          />
          <CalcRow
            sign="="
            label={T('BÉNÉFICE NET', 'صافي الربح', lang)}
            amount={netValue}
            share={marginValue}
            tone={netValue >= 0 ? 'indigo' : 'rose'}
            strong
          />
        </div>

        <div className="mt-4 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
          <p className="mb-2.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
            {T('Répartition des gains', 'توزيع الأرباح', lang)}
          </p>
          <SplitBar
            segments={[
              { value: Math.max(0, netValue), label: T('Bénéfice net', 'صافي الربح', lang), cls: 'bg-teal-500' },
              { value: g.expenses, label: T('Dépenses', 'المصاريف', lang), cls: 'bg-rose-400' },
            ]}
          />
          <SplitLegend
            items={[
              { label: T('Bénéfice net', 'صافي الربح', lang), cls: 'bg-teal-500', pct: marginValue, tone: 'emerald' },
              { label: T('Dépenses', 'المصاريف', lang), cls: 'bg-rose-400', pct: expenseRatio, tone: 'rose' },
            ]}
          />
        </div>
      </BenefitDrawer>
    </div>
  );
};

export default CarGainsPage;
