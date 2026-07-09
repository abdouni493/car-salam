import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardStats, MaintenanceAlert, Language, Car, ReservationDetails, VehicleExpense, User } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, Bell, Calendar, CarFront, ChevronRight, Gauge, RefreshCw, TrendingUp, Users } from 'lucide-react';
import { DatabaseService } from '../services/DatabaseService';
import { getCarsWithOwners } from '../services/carService';
import { getMonthlyAgencyCommission } from '../services/consignmentService';
import { getVehicleExpenses } from '../services/expenseService';
import { getVidangeAlert, getAssuranceAlert, getControleAlert, getChaineAlert } from '../utils/vidangeAlerts';
import { ReservationsService } from '../services/ReservationsService';
import { getReservationAlerts, ReservationAlert } from '../utils/reservationAlerts';
import { scheduleNotification, checkAndTriggerScheduledNotifications, requestNotificationPermission } from '../services/notificationService';

interface DashboardPageProps {
  lang: Language;
  isAuthLoading?: boolean;
  user?: User | null;
}

/** Palette d'une ligne d'alerte selon la sévérité. */
const severityTheme = (severity: string) => {
  switch (severity) {
    case 'critical':
      return { bar: 'bg-red-500', chip: 'bg-red-100 text-red-700', ring: 'hover:ring-red-100', iconBg: 'bg-red-50 text-red-600' };
    case 'high':
      return { bar: 'bg-orange-500', chip: 'bg-orange-100 text-orange-700', ring: 'hover:ring-orange-100', iconBg: 'bg-orange-50 text-orange-600' };
    case 'medium':
      return { bar: 'bg-amber-400', chip: 'bg-amber-100 text-amber-700', ring: 'hover:ring-amber-100', iconBg: 'bg-amber-50 text-amber-600' };
    default:
      return { bar: 'bg-emerald-500', chip: 'bg-emerald-100 text-emerald-700', ring: 'hover:ring-emerald-100', iconBg: 'bg-emerald-50 text-emerald-600' };
  }
};

const maintenanceIcon = (type: string) => {
  switch (type) {
    case 'vidange': return '🛢️';
    case 'assurance': return '🛡️';
    case 'controle': return '🔍';
    case 'chaine': return '⛓️';
    default: return '⚠️';
  }
};

export const DashboardPage: React.FC<DashboardPageProps> = ({ lang, isAuthLoading = false, user = null }) => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    totalRevenue: 0,
    monthlyRevenue: 0,
    totalReservations: 0,
    activeReservations: 0,
    totalClients: 0,
    totalCars: 0,
    availableCars: 0,
    personalCars: 0,
    consignmentCars: 0,
    maintenanceAlerts: 0,
    overduePayments: 0,
    recentReservations: [],
    revenueByMonth: [],
    carUtilization: []
  });
  const [cars, setCars] = useState<Car[]>([]);
  /** Commissions encaissées sur les locations de conciergerie clôturées ce mois-ci. */
  const [monthlyCommission, setMonthlyCommission] = useState(0);
  const [vehicleExpenses, setVehicleExpenses] = useState<VehicleExpense[]>([]);
  const [reservations, setReservations] = useState<ReservationDetails[]>([]);
  const [alertFilter, setAlertFilter] = useState<'all' | 'maintenance' | 'reservations'>('all');
  const [showAllAlerts, setShowAllAlerts] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDashboardData = async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      // Fetch real data from database in parallel
      // Page admin : getCarsWithOwners joint car_owners (réf interne, propriétaire, commission).
      const [dbStats, , carsResult, expensesResult, reservationsResult, commissionThisMonth] = await Promise.all([
        DatabaseService.getDashboardStats(),
        DatabaseService.getMaintenanceAlerts(),
        getCarsWithOwners(),
        getVehicleExpenses(),
        ReservationsService.getReservations(),
        getMonthlyAgencyCommission()
      ]);

      setMonthlyCommission(commissionThisMonth);

      // Set cars and expenses for vidange alerts
      if (carsResult.success && carsResult.cars) {
        setCars(carsResult.cars.map(dbCar => ({
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
        })));
      }

      if (expensesResult.success && expensesResult.expenses) {
        setVehicleExpenses(expensesResult.expenses);
      }

      // Set reservations for alerts
      if (Array.isArray(reservationsResult)) {
        setReservations(reservationsResult);
      }

      // Map database stats to component state
      setStats({
        totalRevenue: dbStats.totalRevenue,
        totalClients: dbStats.totalClients,
        totalCars: dbStats.totalCars,
        activeReservations: dbStats.activeReservations,
        maintenanceAlerts: dbStats.maintenanceAlerts,
        monthlyRevenue: dbStats.monthlyRevenue || 0,
        totalReservations: dbStats.totalReservations || 0,
        availableCars: dbStats.availableCars || 0,
        personalCars: dbStats.personalCars || 0,
        consignmentCars: dbStats.consignmentCars || 0,
        overduePayments: dbStats.overduePayments || 0,
        recentReservations: dbStats.recentReservations || [],
        revenueByMonth: dbStats.revenueByMonth || [],
        carUtilization: dbStats.carUtilization || []
      });

      setLoading(false);
      setRefreshing(false);
    } catch (err: any) {
      console.error('Error loading dashboard data:', err);
      setError(err.message || 'Failed to load dashboard data');
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Chargement UNIQUE à l'arrivée sur la page — aucun rafraîchissement
  // automatique. Le bouton « Actualiser » relance le chargement à la demande.
  useEffect(() => {
    if (isAuthLoading) return;
    if (!user) return;
    loadDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isAuthLoading]);

  // Schedule notifications for reservations expiring tomorrow
  useEffect(() => {
    if (reservations.length === 0) return;

    // Request notification permission on first load
    requestNotificationPermission();

    // Get all alerts to find expiring_tomorrow alerts
    const allAlerts = getReservationAlerts(reservations);
    const expiringTomorrowAlerts = allAlerts.filter(a => a.type === 'expiring_tomorrow');

    // Schedule notifications for each expiring reservation
    expiringTomorrowAlerts.forEach(alert => {
      const returnDate = new Date(alert.reservation.step1.returnDate);
      const clientName = `${alert.reservation.client.firstName} ${alert.reservation.client.lastName}`;
      const vehicleName = `${alert.reservation.car.brand} ${alert.reservation.car.model}`;
      const message = `La réservation de ${clientName} pour ${vehicleName} expire demain!`;

      scheduleNotification(alert.reservationId, returnDate, message);
    });
  }, [reservations]);

  // Déclenche les notifications navigateur planifiées. Cette boucle ne touche
  // AUCUN état React : elle ne provoque donc aucun re-render / refresh de l'UI.
  useEffect(() => {
    checkAndTriggerScheduledNotifications();
    const notificationCheckInterval = setInterval(() => {
      checkAndTriggerScheduledNotifications();
    }, 60000);
    return () => clearInterval(notificationCheckInterval);
  }, []);

  // ── Alertes maintenance (vidange / assurance / contrôle / chaîne) ──────────
  const maintenanceAlerts = useMemo(() => cars
    .flatMap(car => [
      { type: 'vidange', alert: getVidangeAlert(car, vehicleExpenses), car },
      { type: 'assurance', alert: getAssuranceAlert(car, vehicleExpenses), car },
      { type: 'controle', alert: getControleAlert(car, vehicleExpenses), car },
      { type: 'chaine', alert: getChaineAlert(car, vehicleExpenses), car }
    ])
    .filter(item => item.alert !== null && item.alert.status !== 'ok')
    .map(item => ({
      ...item.alert,
      type: item.type,
      carId: item.car.id,
      carInfo: `${item.car.brand} ${item.car.model} - ${item.car.registration}`,
      id: `${item.car.id}-${item.type}`,
      severity: (item.alert as any).status === 'overdue' ? 'critical' : (item.alert as any).status === 'warning' ? 'high' : 'low',
      title: item.type === 'vidange' ? 'Vidange' : item.type === 'assurance' ? 'Assurance' : item.type === 'controle' ? 'Contrôle' : 'Chaîne',
      daysUntilDue: (item.alert as any).daysRemaining || 0,
      dueDate: (item.alert as any).expirationDate || null,
      currentMileage: (item.alert as any).currentMileage || 0,
      nextServiceMileage: (item.alert as any).nextVidangeKm || 0,
      isExpired: (item.alert as any).status === 'overdue',
      createdAt: new Date().toISOString()
    } as MaintenanceAlert)), [cars, vehicleExpenses]);

  const reservationAlerts = useMemo(() => getReservationAlerts(reservations), [reservations]);

  // Commandes du site public en attente d'acceptation par l'agence
  // (statut dédié 'website_reservation').
  const pendingWebOrdersCount = reservations.filter(
    r => r.source === 'website' && (r.status as string) === 'website_reservation'
  ).length;

  // ── File unifiée des notifications, triée par sévérité ─────────────────────
  const severityRank: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  type UnifiedAlert =
    | { kind: 'maintenance'; severity: string; data: MaintenanceAlert }
    | { kind: 'reservation'; severity: string; data: ReservationAlert };

  const unifiedAlerts: UnifiedAlert[] = useMemo(() => {
    const list: UnifiedAlert[] = [
      ...maintenanceAlerts.map(a => ({ kind: 'maintenance' as const, severity: a.severity, data: a })),
      ...reservationAlerts.map(a => ({ kind: 'reservation' as const, severity: a.severity, data: a })),
    ];
    return list.sort((a, b) => (severityRank[a.severity] ?? 9) - (severityRank[b.severity] ?? 9));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maintenanceAlerts, reservationAlerts]);

  const filteredAlerts = unifiedAlerts.filter(a =>
    alertFilter === 'all' ? true : alertFilter === 'maintenance' ? a.kind === 'maintenance' : a.kind === 'reservation'
  );
  const displayedAlerts = showAllAlerts ? filteredAlerts : filteredAlerts.slice(0, 6);

  const criticalCount = unifiedAlerts.filter(a => a.severity === 'critical').length;
  const highCount = unifiedAlerts.filter(a => a.severity === 'high').length;

  // ── Parc scindé : véhicules de l'agence / véhicules confiés (conciergerie) ──
  const personalCarsList    = cars.filter(c => c.ownershipType !== 'consignment');
  const consignmentCarsList = cars.filter(c => c.ownershipType === 'consignment');

  /** Disponible = ni en maintenance, ni couvert aujourd'hui par une réservation en cours. */
  const countAvailable = (list: Car[]) => {
    const today = new Date().toISOString().substring(0, 10);
    const busyCarIds = new Set(
      reservations
        .filter(r => ['pending', 'confirmed', 'active'].includes(r.status))
        .filter(r => {
          const dep = (r.step1?.departureDate || '').substring(0, 10);
          const ret = (r.step1?.returnDate || '').substring(0, 10);
          return dep <= today && today <= ret;
        })
        .map(r => r.carId || r.car?.id)
    );
    return list.filter(c => c.status !== 'maintenance' && !busyCarIds.has(c.id)).length;
  };

  const personalAvailableCount    = countAvailable(personalCarsList);
  const consignmentAvailableCount = countAvailable(consignmentCarsList);

  const handleMaintenanceAlertClick = (alert: MaintenanceAlert) => {
    // Navigate to maintenance page with pre-selected car and expense type
    navigate('/maintenance', {
      state: {
        selectedCarId: alert.carId,
        expenseType: alert.type,
        showExpenseModal: true
      }
    });
  };

  const handleReservationAlertClick = (alert: ReservationAlert) => {
    navigate('/planificateur', {
      state: {
        selectedReservationId: alert.reservationId,
        viewMode: 'details'
      }
    });
  };

  const fmtDA = (n: number) => `${Math.round(n).toLocaleString()} DA`;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-saas-primary-via border-t-transparent rounded-full"
        />
        <span className="ml-4 text-saas-text-main font-medium">
          {lang === 'fr' ? 'Chargement du tableau de bord...' : 'جاري تحميل لوحة القيادة...'}
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-saas-text-main mb-2">
            {lang === 'fr' ? 'Erreur de chargement' : 'خطأ في التحميل'}
          </h3>
          <p className="text-saas-text-muted mb-6">{error}</p>
          <button
            onClick={() => loadDashboardData(true)}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors"
          >
            {lang === 'fr' ? 'Réessayer' : 'إعادة المحاولة'}
          </button>
        </div>
      </div>
    );
  }

  const kpiCards = [
    {
      key: 'revenue',
      label: lang === 'fr' ? 'Revenus du mois' : 'إيرادات الشهر',
      value: fmtDA(stats.monthlyRevenue),
      sub: lang === 'fr' ? `Total encaissé : ${fmtDA(stats.totalRevenue)}` : `الإجمالي : ${fmtDA(stats.totalRevenue)}`,
      icon: <TrendingUp size={22} />,
      accent: 'bg-blue-600',
      soft: 'bg-blue-50 text-blue-700',
    },
    {
      key: 'reservations',
      label: lang === 'fr' ? 'Réservations actives' : 'الحجوزات النشطة',
      value: `${stats.activeReservations}`,
      sub: lang === 'fr' ? `${stats.totalReservations} au total` : `${stats.totalReservations} إجمالاً`,
      icon: <Calendar size={22} />,
      accent: 'bg-indigo-600',
      soft: 'bg-indigo-50 text-indigo-700',
    },
    {
      key: 'cars',
      label: lang === 'fr' ? 'Véhicules disponibles' : 'المركبات المتاحة',
      value: `${stats.availableCars}/${stats.totalCars}`,
      sub: lang === 'fr'
        ? `${stats.personalCars} agence · ${stats.consignmentCars} conciergerie`
        : `${stats.personalCars} وكالة · ${stats.consignmentCars} أمانة`,
      icon: <CarFront size={22} />,
      accent: 'bg-emerald-600',
      soft: 'bg-emerald-50 text-emerald-700',
    },
    {
      key: 'clients',
      label: lang === 'fr' ? 'Clients' : 'العملاء',
      value: `${stats.totalClients}`,
      sub: lang === 'fr' ? `${unifiedAlerts.length} alerte(s) en cours` : `${unifiedAlerts.length} تنبيه جارٍ`,
      icon: <Users size={22} />,
      accent: 'bg-violet-600',
      soft: 'bg-violet-50 text-violet-700',
    },
  ];

  return (
    <div className="space-y-6">

      {/* ════ EN-TÊTE ════ */}
      <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 px-8 py-7 rounded-3xl text-white shadow-xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full -translate-y-32 translate-x-32" />
        <div className="absolute bottom-0 left-1/3 w-40 h-40 bg-indigo-500/10 rounded-full translate-y-20" />
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div>
            <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
              <span className="w-11 h-11 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center text-2xl">📊</span>
              {lang === 'fr' ? 'Tableau de Bord' : 'لوحة القيادة'}
            </h1>
            <p className="text-blue-200/80 text-sm font-medium mt-2 capitalize">
              {new Date().toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'ar-DZ', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
              })}
            </p>
          </div>
          <button
            onClick={() => loadDashboardData(true)}
            disabled={refreshing}
            className="self-start md:self-auto flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 disabled:opacity-60 border border-white/15 rounded-xl font-bold text-sm transition-colors"
            title={lang === 'fr' ? 'Recharger les données' : 'إعادة تحميل البيانات'}
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            {lang === 'fr' ? 'Actualiser' : 'تحديث'}
          </button>
        </div>
      </div>

      {/* ════ NOTIFICATIONS & ALERTES — EN HAUT DE L'INTERFACE ════ */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 px-6 py-5 border-b border-slate-100 bg-slate-50/60">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-md shadow-blue-600/20">
                <Bell size={20} className="text-white" />
              </div>
              {(criticalCount > 0 || pendingWebOrdersCount > 0) && (
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 border-2 border-white rounded-full animate-pulse" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight">
                {lang === 'fr' ? 'Alertes & Notifications' : 'التنبيهات والإشعارات'}
              </h2>
              <p className="text-xs font-semibold text-slate-500">
                {unifiedAlerts.length === 0
                  ? (lang === 'fr' ? 'Tout est en ordre' : 'كل شيء على ما يرام')
                  : lang === 'fr'
                    ? `${unifiedAlerts.length} alerte(s) — ${criticalCount} critique(s), ${highCount} élevée(s)`
                    : `${unifiedAlerts.length} تنبيه — ${criticalCount} حرج، ${highCount} مرتفع`}
              </p>
            </div>
          </div>

          {/* Filtres */}
          <div className="flex flex-wrap gap-2">
            {([
              { id: 'all', label: lang === 'fr' ? 'Toutes' : 'الكل', icon: '📋' },
              { id: 'maintenance', label: lang === 'fr' ? 'Maintenance' : 'الصيانة', icon: '🔧' },
              { id: 'reservations', label: lang === 'fr' ? 'Réservations' : 'الحجوزات', icon: '📅' },
            ] as const).map(f => (
              <button
                key={f.id}
                onClick={() => setAlertFilter(f.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wide transition-all border ${
                  alertFilter === f.id
                    ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/25'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-700'
                }`}
              >
                {f.icon} {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-5 space-y-3">
          {/* Nouvelles commandes du site web */}
          <AnimatePresence>
            {pendingWebOrdersCount > 0 && (
              <motion.button
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                onClick={() => navigate('/website-commandes')}
                className="w-full flex items-center gap-4 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 rounded-2xl px-5 py-4 text-left text-white shadow-lg shadow-indigo-500/20 transition-all"
              >
                <motion.span
                  animate={{ rotate: [0, -12, 12, 0] }}
                  transition={{ duration: 1.6, repeat: Infinity }}
                  className="text-2xl flex-shrink-0"
                >
                  🔔
                </motion.span>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-sm uppercase tracking-tight">
                    {lang === 'fr'
                      ? `${pendingWebOrdersCount} nouvelle${pendingWebOrdersCount > 1 ? 's' : ''} commande${pendingWebOrdersCount > 1 ? 's' : ''} du site web`
                      : `${pendingWebOrdersCount} طلب جديد من الموقع`}
                  </p>
                  <p className="text-indigo-100 text-xs font-medium truncate">
                    {lang === 'fr'
                      ? 'En attente de votre acceptation — cliquez pour les traiter'
                      : 'في انتظار موافقتك — انقر لمعالجتها'}
                  </p>
                </div>
                <span className="px-4 py-2 bg-white/20 border border-white/30 font-bold rounded-xl text-xs whitespace-nowrap">
                  {lang === 'fr' ? 'Traiter →' : 'معالجة ←'}
                </span>
              </motion.button>
            )}
          </AnimatePresence>

          {/* Liste unifiée des alertes */}
          {displayedAlerts.length === 0 && pendingWebOrdersCount === 0 && (
            <div className="flex items-center gap-4 px-5 py-6 rounded-2xl bg-emerald-50 border border-emerald-100">
              <span className="text-3xl">✅</span>
              <div>
                <p className="font-black text-emerald-800 text-sm">
                  {lang === 'fr' ? 'Aucune alerte active' : 'لا توجد تنبيهات نشطة'}
                </p>
                <p className="text-xs font-semibold text-emerald-600">
                  {lang === 'fr' ? 'Véhicules et réservations sous contrôle.' : 'المركبات والحجوزات تحت السيطرة.'}
                </p>
              </div>
            </div>
          )}

          {displayedAlerts.map((item, index) => {
            const theme = severityTheme(item.severity);
            if (item.kind === 'maintenance') {
              const alert = item.data;
              return (
                <motion.button
                  key={`m-${alert.id}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04 }}
                  onClick={() => handleMaintenanceAlertClick(alert)}
                  className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 hover:shadow-md ring-1 ring-transparent ${theme.ring} transition-all text-left group`}
                >
                  <span className={`w-1.5 self-stretch rounded-full ${theme.bar}`} />
                  <span className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${theme.iconBg}`}>
                    {maintenanceIcon(alert.type)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-black text-sm text-slate-900">{alert.title}</p>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        {lang === 'fr' ? 'Maintenance' : 'صيانة'}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-slate-500 truncate">{alert.carInfo}</p>
                    <p className="text-xs text-slate-600 truncate">{alert.message}</p>
                  </div>
                  <span className={`px-3 py-1.5 rounded-lg text-[11px] font-black whitespace-nowrap ${theme.chip}`}>
                    {alert.isExpired
                      ? (lang === 'fr' ? 'EXPIRÉ' : 'منتهي')
                      : (alert.type === 'vidange' || alert.type === 'chaine')
                        ? `${Math.max(0, (alert.nextServiceMileage || 0) - (alert.currentMileage || 0)).toLocaleString()} km`
                        : `${alert.daysUntilDue} ${lang === 'fr' ? 'jours' : 'أيام'}`}
                  </span>
                  <ChevronRight size={16} className="text-slate-300 group-hover:text-slate-500 transition-colors flex-shrink-0" />
                </motion.button>
              );
            }
            const alert = item.data;
            return (
              <motion.button
                key={`r-${alert.id}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
                onClick={() => handleReservationAlertClick(alert)}
                className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 hover:shadow-md ring-1 ring-transparent ${theme.ring} transition-all text-left group`}
              >
                <span className={`w-1.5 self-stretch rounded-full ${theme.bar}`} />
                <span className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${theme.iconBg}`}>
                  {alert.icon || '📅'}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-black text-sm text-slate-900 truncate">{alert.title}</p>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      {lang === 'fr' ? 'Réservation' : 'حجز'}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-slate-500 truncate">
                    {alert.car?.brand} {alert.car?.model} · {alert.reservation?.client?.firstName} {alert.reservation?.client?.lastName}
                  </p>
                  <p className="text-xs text-slate-600 truncate">{alert.message}</p>
                </div>
                <span className={`px-3 py-1.5 rounded-lg text-[11px] font-black whitespace-nowrap ${theme.chip}`}>
                  {alert.daysOverdue !== undefined && alert.daysOverdue > 0
                    ? (lang === 'fr' ? `+${alert.daysOverdue} j retard` : `+${alert.daysOverdue} يوم تأخير`)
                    : alert.daysUntil !== undefined
                      ? (alert.daysUntil === 0
                          ? (lang === 'fr' ? "Aujourd'hui" : 'اليوم')
                          : `${alert.daysUntil} ${lang === 'fr' ? 'jours' : 'أيام'}`)
                      : (lang === 'fr' ? 'Action requise' : 'إجراء مطلوب')}
                </span>
                <ChevronRight size={16} className="text-slate-300 group-hover:text-slate-500 transition-colors flex-shrink-0" />
              </motion.button>
            );
          })}

          {filteredAlerts.length > 6 && (
            <button
              onClick={() => setShowAllAlerts(!showAllAlerts)}
              className="w-full py-2.5 rounded-xl border border-dashed border-slate-300 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-blue-700 hover:border-blue-300 transition-colors"
            >
              {showAllAlerts
                ? (lang === 'fr' ? 'Réduire' : 'تقليص')
                : (lang === 'fr' ? `Voir les ${filteredAlerts.length - 6} autres alertes` : `عرض ${filteredAlerts.length - 6} تنبيهات أخرى`)}
            </button>
          )}
        </div>
      </div>

      {/* ════ INDICATEURS CLÉS ════ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        {kpiCards.map((kpi, i) => (
          <motion.div
            key={kpi.key}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.07 }}
            className="relative overflow-hidden bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-lg transition-shadow"
          >
            <span className={`absolute top-0 left-0 right-0 h-1 ${kpi.accent}`} />
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">{kpi.label}</p>
                <p className="text-2xl font-black text-slate-900 mt-2 truncate" title={kpi.value}>{kpi.value}</p>
                <p className="text-xs font-semibold text-slate-500 mt-1.5 truncate">{kpi.sub}</p>
              </div>
              <span className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 ${kpi.soft}`}>
                {kpi.icon}
              </span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ════ PARC : VÉHICULES PERSONNELS vs CONCIERGERIE ════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* 🚗 Véhicules de l'agence */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col gap-4"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">🚗</span>
                {lang === 'fr' ? 'Mes véhicules personnels' : 'مركباتي الشخصية'}
              </h3>
              <p className="text-3xl font-black text-slate-900 mt-3">{stats.personalCars}</p>
              <p className="text-xs font-bold text-slate-500 mt-1">
                {personalAvailableCount}/{personalCarsList.length} {lang === 'fr' ? 'disponibles' : 'متاحة'}
              </p>
            </div>
            <button
              onClick={() => navigate('/vehicules', { state: { carsTab: 'personal' } })}
              className="text-xs font-bold text-blue-600 hover:text-blue-800 underline underline-offset-4 whitespace-nowrap"
            >
              {lang === 'fr' ? 'Voir tout' : 'عرض الكل'}
            </button>
          </div>

          <div className="space-y-2">
            {personalCarsList.slice(0, 5).map(car => (
              <div key={car.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-xs font-bold text-slate-700 truncate">{car.brand} {car.model}</span>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                  car.status === 'maintenance' ? 'bg-gray-200 text-gray-700' : 'bg-green-100 text-green-700'
                }`}>
                  {car.status === 'maintenance'
                    ? (lang === 'fr' ? 'Maintenance' : 'صيانة')
                    : (lang === 'fr' ? 'Disponible' : 'متاح')}
                </span>
              </div>
            ))}
            {personalCarsList.length === 0 && (
              <p className="text-xs text-slate-400 py-4 text-center">
                {lang === 'fr' ? 'Aucun véhicule personnel.' : 'لا توجد مركبات شخصية.'}
              </p>
            )}
          </div>
        </motion.div>

        {/* 🤝 Véhicules confiés — données propriétaire visibles par l'admin uniquement */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="bg-white p-6 rounded-3xl border border-amber-200 shadow-sm flex flex-col gap-4"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-base font-black text-amber-900 tracking-tight flex items-center gap-2">
                <span className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">🤝</span>
                {lang === 'fr' ? 'Véhicules en conciergerie' : 'مركبات بالوكالة'}
              </h3>
              <p className="text-3xl font-black text-amber-950 mt-3">{stats.consignmentCars}</p>
              <p className="text-xs font-bold text-amber-700 mt-1">
                {consignmentAvailableCount}/{consignmentCarsList.length} {lang === 'fr' ? 'disponibles' : 'متاحة'}
              </p>
            </div>
            <button
              onClick={() => navigate('/vehicules', { state: { carsTab: 'consignment' } })}
              className="text-xs font-bold text-amber-700 hover:text-amber-900 underline underline-offset-4 whitespace-nowrap"
            >
              {lang === 'fr' ? 'Voir tout' : 'عرض الكل'}
            </button>
          </div>

          <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">
              {lang === 'fr' ? 'Commission agence — ce mois' : 'عمولة الوكالة — هذا الشهر'}
            </p>
            <p className="text-2xl font-black text-amber-900 mt-1">
              {fmtDA(monthlyCommission)}
            </p>
          </div>

          <div className="space-y-2">
            {consignmentCarsList.slice(0, 5).map(car => (
              <div key={car.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-amber-50/60 border border-amber-100">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-amber-900 truncate">
                    {car.ownerInfo?.internalRef && (
                      <span className="text-amber-700" dir="ltr">{car.ownerInfo.internalRef} · </span>
                    )}
                    {car.brand} {car.model}
                  </p>
                  {car.ownerInfo && (
                    <p className="text-[10px] font-bold text-amber-700/80 truncate">👤 {car.ownerInfo.ownerName}</p>
                  )}
                </div>
                {car.ownerInfo && (
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-amber-200/70 text-amber-900 whitespace-nowrap">
                    {car.ownerInfo.commissionValue.toLocaleString()} {car.ownerInfo.commissionType === 'percentage' ? '%' : 'DA'}
                  </span>
                )}
              </div>
            ))}
            {consignmentCarsList.length === 0 && (
              <p className="text-xs text-amber-700/60 py-4 text-center">
                {lang === 'fr' ? 'Aucun véhicule en conciergerie.' : 'لا توجد مركبات بالوكالة.'}
              </p>
            )}
          </div>
        </motion.div>
      </div>

      {/* ════ GRAPHIQUES ════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Évolution des revenus */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm"
        >
          <div className="flex items-center gap-3 mb-6">
            <span className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
              <TrendingUp size={18} />
            </span>
            <h3 className="text-base font-black text-slate-900 tracking-tight">
              {lang === 'fr' ? 'Évolution des Revenus' : 'تطور الإيرادات'}
            </h3>
          </div>

          <div className="space-y-3">
            {stats.revenueByMonth.map((item, index) => {
              const maxRevenue = Math.max(...stats.revenueByMonth.map(m => m.revenue), 1);
              return (
                <div key={item.month} className="flex items-center gap-3">
                  <div className="w-10 text-xs font-black text-slate-500">{item.month}</div>
                  <div className="flex-1 bg-slate-100 rounded-full h-3 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(item.revenue / maxRevenue) * 100}%` }}
                      transition={{ delay: 0.5 + index * 0.06, duration: 0.7, ease: 'easeOut' }}
                      className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full"
                    />
                  </div>
                  <div className="w-28 text-right text-sm font-black text-slate-800">
                    {item.revenue.toLocaleString()} <span className="text-[10px] text-slate-400 font-bold">DA</span>
                  </div>
                </div>
              );
            })}
            {stats.revenueByMonth.length === 0 && (
              <p className="text-xs text-slate-400 py-6 text-center">
                {lang === 'fr' ? 'Aucune donnée de revenus.' : 'لا توجد بيانات إيرادات.'}
              </p>
            )}
          </div>
        </motion.div>

        {/* Taux d'utilisation */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm"
        >
          <div className="flex items-center gap-3 mb-6">
            <span className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Gauge size={18} />
            </span>
            <h3 className="text-base font-black text-slate-900 tracking-tight">
              {lang === 'fr' ? "Taux d'Utilisation" : 'معدلات الاستخدام'}
            </h3>
          </div>

          <div className="space-y-4">
            {stats.carUtilization.map((car, index) => (
              <div key={car.carId}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-slate-700 truncate">{car.carInfo}</span>
                  <span className={`text-sm font-black ${
                    car.utilization > 80 ? 'text-red-600' : car.utilization > 60 ? 'text-orange-600' : 'text-emerald-600'
                  }`}>{car.utilization}%</span>
                </div>
                <div className="bg-slate-100 rounded-full h-2.5 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${car.utilization}%` }}
                    transition={{ delay: 0.55 + index * 0.06, duration: 0.7, ease: 'easeOut' }}
                    className={`h-full rounded-full ${
                      car.utilization > 80 ? 'bg-gradient-to-r from-red-500 to-rose-500' :
                      car.utilization > 60 ? 'bg-gradient-to-r from-orange-400 to-orange-500' :
                      'bg-gradient-to-r from-emerald-500 to-teal-500'
                    }`}
                  />
                </div>
              </div>
            ))}
            {stats.carUtilization.length === 0 && (
              <p className="text-xs text-slate-400 py-6 text-center">
                {lang === 'fr' ? "Aucune donnée d'utilisation." : 'لا توجد بيانات استخدام.'}
              </p>
            )}
          </div>
        </motion.div>
      </div>

      {/* ════ ACTIONS RAPIDES ════ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {[
          {
            icon: '📅',
            title: lang === 'fr' ? 'Nouvelle Réservation' : 'حجز جديد',
            desc: lang === 'fr' ? 'Créer une réservation pour vos clients' : 'إنشاء حجز جديد لعملائك',
            cta: lang === 'fr' ? 'Créer' : 'إنشاء',
            to: '/planificateur',
            grad: 'from-blue-600 to-indigo-700',
            shadow: 'hover:shadow-blue-500/25',
          },
          {
            icon: '🚗',
            title: lang === 'fr' ? 'Ajouter un Véhicule' : 'إضافة مركبة',
            desc: lang === 'fr' ? 'Étendre votre flotte automobile' : 'توسيع أسطول سياراتك',
            cta: lang === 'fr' ? 'Ajouter' : 'إضافة',
            to: '/vehicules',
            grad: 'from-emerald-600 to-teal-700',
            shadow: 'hover:shadow-emerald-500/25',
          },
          {
            icon: '📊',
            title: lang === 'fr' ? 'Rapports Détaillés' : 'تقارير مفصلة',
            desc: lang === 'fr' ? 'Analyser vos performances' : 'تحليل أدائك وإحصائياتك',
            cta: lang === 'fr' ? 'Voir' : 'عرض',
            to: '/rapports',
            grad: 'from-violet-600 to-purple-700',
            shadow: 'hover:shadow-violet-500/25',
          },
        ].map((action, i) => (
          <motion.button
            key={action.to}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 + i * 0.07 }}
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate(action.to)}
            className={`relative overflow-hidden bg-gradient-to-br ${action.grad} p-6 rounded-3xl text-white shadow-lg ${action.shadow} text-left transition-shadow`}
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-12 translate-x-12" />
            <div className="relative flex items-center gap-4">
              <span className="text-4xl">{action.icon}</span>
              <div className="flex-1 min-w-0">
                <h4 className="text-base font-black tracking-tight">{action.title}</h4>
                <p className="text-white/75 text-xs font-medium mt-0.5">{action.desc}</p>
              </div>
              <span className="px-4 py-2 bg-white/15 border border-white/25 rounded-xl text-xs font-black whitespace-nowrap">
                {action.cta} →
              </span>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
};
