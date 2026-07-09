import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Calendar, TrendingUp, DollarSign,
  ChevronDown, ChevronUp, Printer, Loader2, AlertCircle,
  Clock, Handshake, Phone, User as UserIcon
} from 'lucide-react';
import { Language, Car, ReservationDetails, VehicleExpense } from '../types';
import { DatabaseService } from '../services/DatabaseService';
import { ReservationsService } from '../services/ReservationsService';
import { getVehicleExpenses } from '../services/expenseService';
import { getCarsWithOwners } from '../services/carService';
import { computeConsignmentSummary, reservationCommission, ownerDeliveryFee } from '../utils/consignmentMath';
import { generateReportHTML } from './ReportPrintTemplate';

interface CarGainsPageProps {
  lang: Language;
}

const T = (fr: string, ar: string, lang: Language) => lang === 'fr' ? fr : ar;
const fmt = (n: number) => Math.round(n || 0).toLocaleString('fr-DZ');
const fmtD = (d: string) => {
  try {
    return new Date(d).toLocaleDateString('fr-FR');
  } catch {
    return d || '';
  }
};

// Calculate paid amount
const calcPaid = (r: ReservationDetails): number => {
  const payments = (r.payments || []) as any[];
  if (payments.length > 0) {
    const total = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    if (total > 0) return total;
  }
  return Math.max(0, (Number(r.totalPrice) || 0) - (Number(r.remainingPayment) || 0));
};

// Helper to check if date is in range
const inRange = (dateStr: string, startDate: string, endDate: string): boolean => {
  if (!dateStr) return false;
  const d = dateStr.substring(0, 10);
  return (!startDate || d >= startDate) && (!endDate || d <= endDate);
};

const STATUS_META: Record<string, { fr: string; ar: string; cls: string }> = {
  pending:   { fr: 'En attente', ar: 'قيد الانتظار', cls: 'bg-yellow-100 text-yellow-700' },
  accepted:  { fr: 'Acceptée',   ar: 'مقبول',        cls: 'bg-sky-100 text-sky-700' },
  confirmed: { fr: 'Confirmée',  ar: 'مؤكد',         cls: 'bg-blue-100 text-blue-700' },
  active:    { fr: 'En cours',   ar: 'جارية',        cls: 'bg-indigo-100 text-indigo-700' },
  completed: { fr: 'Terminée',   ar: 'منتهية',       cls: 'bg-emerald-100 text-emerald-700' },
  cancelled: { fr: 'Annulée',    ar: 'ملغاة',        cls: 'bg-gray-200 text-gray-500' },
};

export const CarGainsPage: React.FC<CarGainsPageProps> = ({ lang }) => {
  const [cars, setCars] = useState<Car[]>([]);
  const [selectedCarId, setSelectedCarId] = useState<string>('');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [reservations, setReservations] = useState<ReservationDetails[]>([]);
  const [expenses, setExpenses] = useState<VehicleExpense[]>([]);
  const [expandedRes, setExpandedRes] = useState<string | null>(null);
  const [expandedExp, setExpandedExp] = useState<string | null>(null);

  // Load cars on mount — WITH owner info so conciergerie commissions can be
  // computed with the real barème (page admin uniquement).
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
                  commissionType: dbCar.owner.commission_type === 'amount' ? 'amount' : 'percentage',
                  commissionValue: Number(dbCar.owner.commission_value || 0),
                }
              : null,
          }));
          setCars(mapped);
          if (mapped.length > 0) {
            setSelectedCarId(mapped[0].id);
          }
        }
      } catch (err) {
        console.error('Error loading cars:', err);
      }
    };
    loadCars();
  }, []);

  // Generate report on button click
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
        })()
      ]);

      const carRes = resList.filter(
        r => (r.carId || r.car?.id) === selectedCarId && inRange(r.step1?.departureDate || r.createdAt || '', startDate, endDate)
      );

      const carExp = expList.filter(
        e => e.carId === selectedCarId && inRange(e.date, startDate, endDate)
      ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

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

  // ── Metrics ────────────────────────────────────────────────────────────────
  const selectedCar = cars.find(c => c.id === selectedCarId);
  const isConsignment = selectedCar?.ownershipType === 'consignment' && !!selectedCar?.ownerInfo;
  const ownerInfo = selectedCar?.ownerInfo || null;

  const nonCancelledRes = reservations.filter(r => r.status !== 'cancelled');
  const totalPaid = nonCancelledRes.reduce((s, r) => s + calcPaid(r), 0);
  const totalInvoiced = nonCancelledRes.reduce((s, r) => s + (Number(r.totalPrice) || 0), 0);
  const totalRemaining = reservations
    .filter(r => !['completed', 'cancelled'].includes(r.status))
    .reduce((s, r) => s + (Number(r.remainingPayment) || 0), 0);
  const totalExpenses = expenses.reduce((s, e) => s + (Number(e.cost) || 0), 0);
  const totalDaysRented = nonCancelledRes.reduce((s, r) => s + (Number(r.totalDays) || 0), 0);
  const periodDays = Math.max(1, Math.round(
    (new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000
  ) + 1);
  const occupancy = Math.min(100, Math.round((totalDaysRented / periodDays) * 100));

  // Conciergerie : mêmes formules que la vue DB `consignment_earnings`.
  const consignment = isConsignment && ownerInfo
    ? computeConsignmentSummary(nonCancelledRes, ownerInfo)
    : null;

  // Bénéfice net : pour une voiture d'agence, tout l'encaissé revient à l'agence.
  // Pour une conciergerie, seule la commission (+ livraison propriétaire) est un gain.
  const netBenefit = consignment
    ? consignment.agencyGain - totalExpenses
    : totalPaid - totalExpenses;

  // Print function
  const handlePrint = async () => {
    if (!selectedCar) return;

    try {
      const agencySettings = await DatabaseService.getWebsiteSettings();

      const html = generateReportHTML(
        selectedCar,
        reservations,
        expenses,
        startDate,
        endDate,
        agencySettings,
        lang
      );

      // Use iframe for better print handling
      const iframe = document.createElement('iframe');
      iframe.id = '__print_iframe__';
      iframe.style.display = 'none';
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (iframeDoc) {
        iframeDoc.open();
        iframeDoc.write(html);
        iframeDoc.close();

        setTimeout(() => {
          iframe.contentWindow?.print();
          // Clean up after print
          setTimeout(() => {
            document.body.removeChild(iframe);
          }, 100);
        }, 250);
      }
    } catch (err) {
      console.error('Error printing report:', err);
      alert(T('Erreur lors de l\'impression.', 'خطأ في الطباعة.', lang));
    }
  };

  const kpis = consignment
    ? [
        {
          label: T('Chiffre d\'affaires', 'رقم الأعمال', lang),
          value: fmt(totalPaid),
          subtext: `${nonCancelledRes.length} ${T('location(s)', 'إيجار', lang)}`,
          gradient: 'from-blue-500 to-blue-600',
          icon: '📋'
        },
        {
          label: T('Commission agence', 'عمولة الوكالة', lang),
          value: fmt(consignment.commissionEarned + consignment.ownerDeliveryFees),
          subtext: consignment.commissionPending > 0
            ? `+${fmt(consignment.commissionPending)} ${T('à venir', 'قادمة', lang)}`
            : T('Locations terminées', 'إيجارات منتهية', lang),
          gradient: 'from-amber-500 to-orange-600',
          icon: '🤝'
        },
        {
          label: T('Reversement propriétaire', 'مستحقات المالك', lang),
          value: fmt(consignment.ownerPayout),
          subtext: `${consignment.completedCount} ${T('location(s) terminée(s)', 'إيجار منتهي', lang)}`,
          gradient: 'from-slate-500 to-slate-700',
          icon: '👤'
        },
        {
          label: T('Dépenses', 'المصاريف', lang),
          value: fmt(totalExpenses),
          subtext: `${expenses.length} ${T('item(s)', 'عناصر', lang)}`,
          gradient: 'from-red-500 to-rose-600',
          icon: '💰'
        },
        {
          label: T('Bénéfice Net Agence', 'صافي ربح الوكالة', lang),
          value: fmt(netBenefit),
          subtext: netBenefit >= 0 ? T('Profit', 'ربح', lang) : T('Perte', 'خسارة', lang),
          gradient: netBenefit >= 0 ? 'from-green-500 to-emerald-600' : 'from-orange-500 to-red-600',
          icon: netBenefit >= 0 ? '📈' : '📉'
        }
      ]
    : [
        {
          label: T('Total Facturé', 'الإجمالي المفوتر', lang),
          value: fmt(totalInvoiced),
          subtext: `${nonCancelledRes.length} ${T('location(s)', 'إيجار', lang)}`,
          gradient: 'from-blue-500 to-blue-600',
          icon: '📋'
        },
        {
          label: T('Encaissé', 'المحصّل', lang),
          value: fmt(totalPaid),
          subtext: T('Reçu', 'تم الحصول عليه', lang),
          gradient: 'from-emerald-500 to-teal-600',
          icon: '✓'
        },
        {
          label: T('Dépenses', 'المصاريف', lang),
          value: fmt(totalExpenses),
          subtext: `${expenses.length} ${T('item(s)', 'عناصر', lang)}`,
          gradient: 'from-red-500 to-rose-600',
          icon: '💰'
        },
        {
          label: T('Bénéfice Net', 'صافي الأرباح', lang),
          value: fmt(netBenefit),
          subtext: netBenefit >= 0 ? T('Profit', 'ربح', lang) : T('Perte', 'خسارة', lang),
          gradient: netBenefit >= 0 ? 'from-green-500 to-emerald-600' : 'from-orange-500 to-red-600',
          icon: netBenefit >= 0 ? '📈' : '📉'
        }
      ];

  return (
    <div className="space-y-7 pb-8">
      {/* Header with Premium Design */}
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl text-white shadow-2xl"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500" />
        <div className="absolute inset-0 opacity-[0.08]"
          style={{ backgroundImage: 'repeating-linear-gradient(45deg,#fff 0,#fff 1px,transparent 0,transparent 50%)', backgroundSize: '12px 12px' }}
        />
        <div className="relative p-8">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center text-4xl">
              💰
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tighter uppercase">
                {T('Gains par Véhicule', 'الأرباح حسب المركبة', lang)}
              </h1>
              <p className="text-purple-100 text-sm mt-1 font-semibold">
                {T('Analysez vos revenus, commissions et dépenses en détail', 'حلل إيراداتك وعمولاتك ونفقاتك بالتفصيل', lang)}
              </p>
            </div>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Car Selection */}
            <div>
              <label className="block text-xs font-bold text-purple-100 mb-2 uppercase tracking-wide">
                {T('Sélectionner un véhicule', 'اختر مركبة', lang)}
              </label>
              <select
                value={selectedCarId}
                onChange={(e) => { setSelectedCarId(e.target.value); setGenerated(false); }}
                className="w-full bg-white/15 border border-white/30 rounded-xl px-4 py-2.5 text-white placeholder-white/60 focus:ring-2 focus:ring-white/50 outline-none text-sm font-semibold backdrop-blur-sm hover:bg-white/20 transition-all"
              >
                <option value="" className="bg-gray-800">
                  {T('-- Choisir une voiture --', '-- اختر سيارة --', lang)}
                </option>
                {cars.map(car => (
                  <option key={car.id} value={car.id} className="bg-gray-800">
                    {car.ownershipType === 'consignment' ? '🤝 ' : ''}{car.brand} {car.model} ({car.registration})
                  </option>
                ))}
              </select>
            </div>

            {/* Start Date */}
            <div>
              <label className="block text-xs font-bold text-purple-100 mb-2 uppercase tracking-wide">
                {T('Date de début', 'تاريخ البداية', lang)}
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-white/15 border border-white/30 rounded-xl px-4 py-2.5 text-white placeholder-white/60 focus:ring-2 focus:ring-white/50 outline-none text-sm font-semibold backdrop-blur-sm hover:bg-white/20 transition-all"
              />
            </div>

            {/* End Date */}
            <div>
              <label className="block text-xs font-bold text-purple-100 mb-2 uppercase tracking-wide">
                {T('Date de fin', 'تاريخ النهاية', lang)}
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-white/15 border border-white/30 rounded-xl px-4 py-2.5 text-white placeholder-white/60 focus:ring-2 focus:ring-white/50 outline-none text-sm font-semibold backdrop-blur-sm hover:bg-white/20 transition-all"
              />
            </div>

            {/* Generate Button */}
            <div className="flex items-end">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleGenerate}
                disabled={loading || !selectedCarId}
                className="w-full bg-white text-purple-700 font-black py-2.5 px-4 rounded-xl shadow-xl hover:shadow-2xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-sm uppercase tracking-wide"
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    {T('Génération...', 'جاري...', lang)}
                  </>
                ) : (
                  <>
                    <TrendingUp size={16} />
                    {T('Générer', 'إنشاء', lang)}
                  </>
                )}
              </motion.button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Empty State - Before Generation */}
      <AnimatePresence>
        {!generated && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex items-center justify-center py-24"
          >
            <div className="text-center max-w-md">
              <div className="text-7xl mb-4 opacity-20">📊</div>
              <p className="text-lg font-bold text-gray-600 mb-2">
                {T('Prêt à analyser vos gains ?', 'هل أنت مستعد لتحليل أرباحك؟', lang)}
              </p>
              <p className="text-sm text-gray-400">
                {T('Sélectionnez un véhicule et une plage de dates, puis cliquez sur Générer pour voir vos statistiques détaillées.', 'اختر مركبة ونطاق تاريخ، ثم انقر على إنشاء لرؤية إحصائياتك المفصلة.', lang)}
              </p>
            </div>
          </motion.div>
        )}

        {/* Results - After Generation */}
        {generated && !loading && selectedCar && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-5"
          >
            {/* Car card */}
            <motion.div
              whileHover={{ y: -4 }}
              className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden"
            >
              <div className="flex flex-col sm:flex-row items-center gap-4 p-6">
                <div className="w-32 h-24 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100 border border-gray-200">
                  <img
                    src={selectedCar.images?.[0] || 'https://picsum.photos/seed/car/400/300'}
                    alt={`${selectedCar.brand} ${selectedCar.model}`}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 text-center sm:text-left">
                  <div className="flex items-center justify-center sm:justify-start gap-3 flex-wrap">
                    <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tighter">
                      {selectedCar.brand} {selectedCar.model}
                    </h2>
                    {isConsignment && (
                      <span className="text-xs font-black bg-amber-100 text-amber-800 border border-amber-200 px-3 py-1 rounded-full flex items-center gap-1">
                        <Handshake size={12} />
                        {T('Conciergerie', 'أمانة', lang)}
                      </span>
                    )}
                  </div>
                  <p className="text-emerald-600 font-bold text-sm">{selectedCar.registration}</p>
                  <div className="flex flex-wrap justify-center sm:justify-start gap-3 mt-3">
                    <span className="text-xs font-bold bg-blue-100 text-blue-700 px-3 py-1 rounded-full">
                      📅 {selectedCar.year}
                    </span>
                    <span className="text-xs font-bold bg-purple-100 text-purple-700 px-3 py-1 rounded-full">
                      ⛽ {selectedCar.energy}
                    </span>
                    <span className="text-xs font-bold bg-gray-100 text-gray-700 px-3 py-1 rounded-full">
                      🎯 {selectedCar.mileage.toLocaleString()} KM
                    </span>
                    <span className="text-xs font-bold bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full">
                      📆 {totalDaysRented} {T('jours loués', 'أيام مؤجرة', lang)} ({occupancy}%)
                    </span>
                  </div>
                </div>
              </div>

              {/* Bandeau propriétaire (conciergerie) */}
              {isConsignment && ownerInfo && (
                <div className="border-t border-amber-100 bg-amber-50/70 px-6 py-4 flex flex-wrap items-center gap-x-6 gap-y-2">
                  <span className="flex items-center gap-2 text-sm font-bold text-amber-900">
                    <UserIcon size={15} />
                    {ownerInfo.ownerName}
                    {ownerInfo.internalRef && (
                      <span className="text-[11px] font-black bg-amber-200/70 px-2 py-0.5 rounded-md" dir="ltr">
                        {ownerInfo.internalRef}
                      </span>
                    )}
                  </span>
                  {ownerInfo.ownerPhone && (
                    <span className="flex items-center gap-1.5 text-xs font-bold text-amber-800" dir="ltr">
                      <Phone size={13} />
                      {ownerInfo.ownerPhone}
                    </span>
                  )}
                  <span className="text-xs font-black text-amber-900 bg-amber-200/70 px-3 py-1 rounded-full">
                    {T('Commission', 'العمولة', lang)} : {ownerInfo.commissionValue.toLocaleString()}
                    {ownerInfo.commissionType === 'percentage' ? ' %' : ' DA'} / {T('location', 'إيجار', lang)}
                  </span>
                </div>
              )}
            </motion.div>

            {/* KPI Cards */}
            <div className={`grid grid-cols-2 md:grid-cols-4 ${consignment ? 'xl:grid-cols-5' : ''} gap-3`}>
              {kpis.map((kpi, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.08 }}
                  whileHover={{ scale: 1.03, y: -2 }}
                  className={`bg-gradient-to-br ${kpi.gradient} rounded-2xl p-4 text-white shadow-lg`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest leading-tight">
                      {kpi.label}
                    </p>
                    <span className="text-2xl">{kpi.icon}</span>
                  </div>
                  <p className="text-xl font-black leading-tight">{kpi.value}</p>
                  <p className="text-white/60 text-[10px] mt-0.5 font-semibold">{kpi.subtext} — DZD</p>
                </motion.div>
              ))}
            </div>

            {/* Détail conciergerie : la répartition réelle du chiffre d'affaires */}
            {consignment && ownerInfo && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden"
              >
                <div className="bg-amber-50 border-b border-amber-100 px-6 py-4 flex items-center justify-between">
                  <h3 className="text-lg font-black text-amber-800 uppercase tracking-tighter flex items-center gap-2">
                    <Handshake size={18} />
                    {T('Répartition Conciergerie', 'توزيع أرباح الأمانة', lang)}
                  </h3>
                  <span className="text-[11px] font-bold text-amber-700 bg-amber-100 px-3 py-1 rounded-full">
                    {T('Calculé sur les locations terminées', 'محسوب على الإيجارات المنتهية', lang)}
                  </span>
                </div>
                <div className="p-6 space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-gray-600">
                      {T('CA locations terminées', 'رقم أعمال الإيجارات المنتهية', lang)}
                      {' '}({consignment.completedCount})
                    </span>
                    <span className="font-black text-gray-900">{fmt(consignment.grossCompleted)} DZD</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-gray-600">
                      − {T('Commission agence', 'عمولة الوكالة', lang)}
                      {' '}({ownerInfo.commissionValue.toLocaleString()}{ownerInfo.commissionType === 'percentage' ? ' %' : ' DA'})
                    </span>
                    <span className="font-black text-amber-700">{fmt(consignment.commissionEarned)} DZD</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-gray-600">
                      − {T('Livraison à charge du propriétaire (≥ 10 jours)', 'التوصيل على حساب المالك (≥ 10 أيام)', lang)}
                    </span>
                    <span className="font-black text-amber-700">{fmt(consignment.ownerDeliveryFees)} DZD</span>
                  </div>
                  <div className="border-t border-dashed border-amber-200 pt-3 flex items-center justify-between">
                    <span className="font-black text-gray-800">
                      = {T('À reverser au propriétaire', 'المستحق للمالك', lang)}
                    </span>
                    <span className="text-xl font-black text-slate-800">{fmt(consignment.ownerPayout)} DZD</span>
                  </div>
                  {consignment.pendingCount > 0 && (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-4 py-2.5 font-semibold">
                      ⏳ {consignment.pendingCount} {T('location(s) non terminée(s) dans la période — commission estimée', 'إيجار غير منتهي في الفترة — عمولة مقدرة', lang)} : {fmt(consignment.commissionPending)} DZD
                    </p>
                  )}
                </div>
              </motion.div>
            )}

            {/* Reservations Section */}
            {reservations.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden"
              >
                <div className="bg-emerald-50 border-b border-emerald-100 px-6 py-4 flex items-center justify-between">
                  <h3 className="text-lg font-black text-emerald-700 uppercase tracking-tighter flex items-center gap-2">
                    <Calendar size={18} />
                    {T('Locations', 'الإيجارات', lang)} ({reservations.length})
                  </h3>
                  <span className="text-sm font-bold text-emerald-600">
                    +{fmt(totalPaid)} DZD
                  </span>
                </div>

                <div className="divide-y divide-gray-100">
                  {reservations.map((res) => {
                    const paid = calcPaid(res);
                    const debt = Number(res.remainingPayment) || 0;
                    const total = Number(res.totalPrice) || 0;
                    const isOpen = expandedRes === res.id;
                    const st = STATUS_META[res.status] || STATUS_META.pending;
                    const commission = isConsignment && ownerInfo ? reservationCommission(res, ownerInfo) : 0;
                    const delivOwner = ownerDeliveryFee(res);

                    return (
                      <div key={res.id}>
                        <button
                          onClick={() => setExpandedRes(isOpen ? null : res.id)}
                          className="w-full text-left px-6 py-4 hover:bg-gray-50 transition-colors flex items-center justify-between"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-bold text-gray-800">
                                {res.client?.firstName} {res.client?.lastName}
                              </p>
                              <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${st.cls}`}>
                                {T(st.fr, st.ar, lang)}
                              </span>
                            </div>
                            <p className="text-sm text-gray-500 flex items-center gap-2 mt-1">
                              <Clock size={14} />
                              {fmtD(res.step1?.departureDate)} → {fmtD(res.step1?.returnDate)}
                              <span className="font-bold">({res.totalDays}j)</span>
                            </p>
                          </div>
                          <div className="flex-shrink-0 text-right ml-4 space-y-1">
                            <p className="font-black text-emerald-600">✓ {fmt(paid)}</p>
                            {debt > 0 && res.status !== 'cancelled' && (
                              <p className="text-sm font-bold text-orange-500">⏳ {fmt(debt)}</p>
                            )}
                            {isConsignment && res.status !== 'cancelled' && (
                              <p className="text-xs font-bold text-amber-600">🤝 {fmt(commission)}</p>
                            )}
                          </div>
                          {isOpen ? (
                            <ChevronUp size={18} className="text-gray-400 ml-2" />
                          ) : (
                            <ChevronDown size={18} className="text-gray-400 ml-2" />
                          )}
                        </button>

                        <AnimatePresence>
                          {isOpen && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden bg-emerald-50/40 border-t border-emerald-100"
                            >
                              <div className={`px-6 py-4 grid grid-cols-2 sm:grid-cols-4 ${isConsignment ? 'lg:grid-cols-6' : ''} gap-2 text-sm`}>
                                <div className="bg-white rounded-lg border border-gray-200 p-3">
                                  <p className="text-gray-500 text-xs font-semibold">{T('Total', 'الإجمالي', lang)}</p>
                                  <p className="font-black text-gray-800 mt-1">{fmt(total)} DZD</p>
                                </div>
                                <div className="bg-white rounded-lg border border-gray-200 p-3">
                                  <p className="text-gray-500 text-xs font-semibold">{T('Avance', 'الدفعة الأولى', lang)}</p>
                                  <p className="font-black text-blue-600 mt-1">{fmt(Number(res.advancePayment) || 0)} DZD</p>
                                </div>
                                <div className="bg-white rounded-lg border border-gray-200 p-3">
                                  <p className="text-gray-500 text-xs font-semibold">{T('Payé', 'المدفوع', lang)}</p>
                                  <p className="font-black text-emerald-600 mt-1">{fmt(paid)} DZD</p>
                                </div>
                                <div className="bg-white rounded-lg border border-gray-200 p-3">
                                  <p className="text-gray-500 text-xs font-semibold">{T('Reste', 'المتبقي', lang)}</p>
                                  <p className={`font-black mt-1 ${debt > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                                    {fmt(debt)} DZD
                                  </p>
                                </div>
                                {isConsignment && ownerInfo && (
                                  <>
                                    <div className="bg-white rounded-lg border border-amber-200 p-3">
                                      <p className="text-amber-700 text-xs font-semibold">
                                        {T('Commission agence', 'عمولة الوكالة', lang)}
                                        {res.status !== 'completed' && (
                                          <span className="text-[9px]"> ({T('estimée', 'مقدرة', lang)})</span>
                                        )}
                                      </p>
                                      <p className="font-black text-amber-700 mt-1">{fmt(commission)} DZD</p>
                                    </div>
                                    <div className="bg-white rounded-lg border border-amber-200 p-3">
                                      <p className="text-amber-700 text-xs font-semibold">{T('Part propriétaire', 'حصة المالك', lang)}</p>
                                      <p className="font-black text-slate-700 mt-1">
                                        {fmt(Math.max(0, total - commission - delivOwner))} DZD
                                      </p>
                                    </div>
                                  </>
                                )}
                              </div>
                              {delivOwner > 0 && (
                                <p className="px-6 pb-4 text-xs font-semibold text-amber-700">
                                  🚚 {T('Livraison à charge du propriétaire', 'التوصيل على حساب المالك', lang)} : {fmt(delivOwner)} DZD
                                </p>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>

                {nonCancelledRes.length > 0 && (
                  <div className="bg-emerald-50 border-t border-emerald-100 px-6 py-3 flex items-center justify-between text-sm">
                    <span className="font-bold text-emerald-700">
                      {T('Total Locations', 'إجمالي الإيجارات', lang)}
                    </span>
                    <span className="font-black text-emerald-700">{fmt(totalInvoiced)} DZD</span>
                  </div>
                )}
              </motion.div>
            )}

            {/* Expenses Section */}
            {expenses.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden"
              >
                <div className="bg-red-50 border-b border-red-100 px-6 py-4 flex items-center justify-between">
                  <h3 className="text-lg font-black text-red-700 uppercase tracking-tighter flex items-center gap-2">
                    <DollarSign size={18} />
                    {T('Dépenses', 'المصاريف', lang)} ({expenses.length})
                  </h3>
                  <span className="text-sm font-bold text-red-600">
                    -{fmt(totalExpenses)} DZD
                  </span>
                </div>

                <div className="divide-y divide-gray-100">
                  {expenses.map((exp) => {
                    const isOpen = expandedExp === exp.id;

                    return (
                      <div key={exp.id}>
                        <button
                          onClick={() => setExpandedExp(isOpen ? null : exp.id)}
                          className="w-full text-left px-6 py-4 hover:bg-gray-50 transition-colors flex items-center justify-between"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-gray-800">
                              {exp.expenseName || exp.type.toUpperCase()}
                            </p>
                            <p className="text-sm text-gray-500 flex items-center gap-2 mt-1">
                              <Calendar size={14} />
                              {fmtD(exp.date)}
                            </p>
                          </div>
                          <div className="flex-shrink-0 text-right ml-4">
                            <p className="font-black text-red-600">-{fmt(Number(exp.cost) || 0)} DZD</p>
                          </div>
                          {isOpen ? (
                            <ChevronUp size={18} className="text-gray-400 ml-2" />
                          ) : (
                            <ChevronDown size={18} className="text-gray-400 ml-2" />
                          )}
                        </button>

                        <AnimatePresence>
                          {isOpen && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden bg-red-50/40 border-t border-red-100"
                            >
                              <div className="px-6 py-4 space-y-2 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-gray-600">{T('Type', 'النوع', lang)}:</span>
                                  <span className="font-bold text-gray-800">{exp.type}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">{T('Montant', 'المبلغ', lang)}:</span>
                                  <span className="font-black text-red-600">{fmt(Number(exp.cost) || 0)} DZD</span>
                                </div>
                                {exp.note && (
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">{T('Note', 'ملاحظة', lang)}:</span>
                                    <span className="text-gray-800">{exp.note}</span>
                                  </div>
                                )}
                                {exp.currentMileage && (
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">{T('Kilométrage', 'المسافة', lang)}:</span>
                                    <span className="text-gray-800">{exp.currentMileage} KM</span>
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

                <div className="bg-red-50 border-t border-red-100 px-6 py-3 flex items-center justify-between text-sm">
                  <span className="font-bold text-red-700">
                    {T('Total Dépenses', 'إجمالي المصاريف', lang)}
                  </span>
                  <span className="font-black text-red-700">-{fmt(totalExpenses)} DZD</span>
                </div>
              </motion.div>
            )}

            {/* Summary Section */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden"
            >
              <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border-b border-indigo-100 px-6 py-4">
                <h3 className="text-lg font-black text-indigo-700 uppercase tracking-tighter">
                  {T('Résumé Financier', 'الملخص المالي', lang)}
                </h3>
              </div>

              <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  {
                    label: T('Facturé', 'المفوتر', lang),
                    value: fmt(totalInvoiced),
                    color: 'text-blue-600'
                  },
                  {
                    label: T('Encaissé', 'المحصّل', lang),
                    value: fmt(totalPaid),
                    color: 'text-emerald-600'
                  },
                  {
                    label: T('Reste', 'المتبقي', lang),
                    value: fmt(totalRemaining),
                    color: 'text-orange-600'
                  },
                  {
                    label: T('Dépenses', 'المصاريف', lang),
                    value: fmt(totalExpenses),
                    color: 'text-red-600'
                  }
                ].map((item, i) => (
                  <div key={i} className="text-center">
                    <p className="text-xs font-bold text-gray-500 uppercase mb-2">{item.label}</p>
                    <p className={`text-2xl font-black ${item.color}`}>{item.value}</p>
                    <p className="text-xs text-gray-400 mt-1">DZD</p>
                  </div>
                ))}
              </div>

              {consignment && (
                <div className="px-6 pb-2 grid grid-cols-2 gap-4">
                  <div className="text-center bg-amber-50 border border-amber-100 rounded-xl py-3">
                    <p className="text-xs font-bold text-amber-700 uppercase mb-1">
                      🤝 {T('Commission agence', 'عمولة الوكالة', lang)}
                    </p>
                    <p className="text-xl font-black text-amber-800">{fmt(consignment.agencyGain)} DZD</p>
                  </div>
                  <div className="text-center bg-slate-50 border border-slate-200 rounded-xl py-3">
                    <p className="text-xs font-bold text-slate-600 uppercase mb-1">
                      👤 {T('Reversement propriétaire', 'مستحقات المالك', lang)}
                    </p>
                    <p className="text-xl font-black text-slate-800">{fmt(consignment.ownerPayout)} DZD</p>
                  </div>
                </div>
              )}

              <div className={`border-t border-gray-200 px-6 py-4 bg-gradient-to-r ${netBenefit >= 0 ? 'from-green-50 to-emerald-50' : 'from-orange-50 to-red-50'}`}>
                <div className="flex items-center justify-between">
                  <span className={`text-lg font-black ${netBenefit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                    {consignment
                      ? T('Bénéfice Net Agence', 'صافي ربح الوكالة', lang)
                      : T('Bénéfice Net', 'صافي الأرباح', lang)}
                  </span>
                  <span className={`text-3xl font-black ${netBenefit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {netBenefit >= 0 ? '+' : ''}{fmt(netBenefit)} DZD
                  </span>
                </div>
                {consignment && (
                  <p className="text-xs text-gray-500 font-semibold mt-1">
                    = {T('Commission + livraison propriétaire − dépenses', 'العمولة + توصيل المالك − المصاريف', lang)}
                  </p>
                )}
              </div>
            </motion.div>

            {/* Empty States */}
            {reservations.length === 0 && expenses.length === 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-blue-50 border border-blue-200 rounded-2xl p-8 text-center"
              >
                <AlertCircle className="w-12 h-12 text-blue-600 mx-auto mb-3" />
                <p className="text-blue-800 font-semibold">
                  {T('Aucune donnée pour cette période', 'لا توجد بيانات لهذه الفترة', lang)}
                </p>
              </motion.div>
            )}

            {/* Print Button */}
            <div className="flex justify-center pt-4">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handlePrint}
                disabled={loading}
                className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-black py-3 px-8 rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center gap-2 disabled:opacity-50 uppercase tracking-wide"
              >
                <Printer size={18} />
                {T('Imprimer le Rapport', 'طباعة التقرير', lang)}
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CarGainsPage;
