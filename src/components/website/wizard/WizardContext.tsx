import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Language, Car, Agency, SpecialOffer, ReservationStep2, AdditionalService, ProtectionAssurance } from '../../../types';
import { DatabaseService } from '../../../services/DatabaseService';
import { getCurrentSpecialOfferForCar } from '../../../utils/specialOffers';
import { Currency, carEurRate, dzdToEur, formatMoney } from '../../../utils/currency';
import { computeRentalBasePrice, RentalPriceBreakdown, RentalUnitPrices } from '../../../utils/rentalPricing';
import { fromYmd } from './wizardUi';

// ═══ Modèle d'état du wizard de réservation (source unique de vérité) ═══
// Tout l'état vit ici : naviguer entre les étapes ne perd jamais les saisies.

export interface DateRangeSel {
  from?: string; // YYYY-MM-DD
  to?: string;   // YYYY-MM-DD
}

/** Critères de recherche pré-remplis depuis le landing (agences + période). */
export interface WizardSearchCriteria {
  from: string;               // YYYY-MM-DD
  to: string;                 // YYYY-MM-DD
  departureAgencyId: string;
  returnAgencyId?: string;    // absent = même agence qu'au départ
}

export const WIZARD_STEP_COUNT = 5;

/** Âge minimum légal pour louer un véhicule. */
export const MIN_DRIVER_AGE = 18;

/** Âge révolu à la date du jour, ou `null` si la date est vide/illisible. */
export const ageFromYmd = (ymd?: string): number | null => {
  if (!ymd || ymd.length < 10) return null;
  const birth = fromYmd(ymd);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age -= 1;
  return age;
};

const emptyPersonal: ReservationStep2 = {
  photo: '',
  firstName: '',
  lastName: '',
  phone: '',
  email: '',
  dateOfBirth: '',
  placeOfBirth: '',
  licenseNumber: '',
  licenseExpiration: '',
  licenseDelivery: '',
  licenseDeliveryPlace: '',
  additionalDocType: 'none',
  additionalDocNumber: '',
  additionalDocDelivery: '',
  additionalDocExpiration: '',
  additionalDocDeliveryAddress: '',
  wilaya: '16 - Alger',
  completeAddress: '',
  scannedDocuments: [],
};

export type PromoStatus = 'idle' | 'checking' | 'valid' | 'invalid';

interface WizardContextValue {
  lang: Language;
  cars: Car[];
  agencies: Agency[];
  isLoadingAgencies: boolean;

  // Navigation
  step: number;                 // 1..6
  goToStep: (n: number) => void;
  next: () => void;
  prev: () => void;
  isStepValid: (n: number) => boolean;

  // Étape 1 — voiture + dates
  car: Car | null;
  selectCar: (car: Car | null) => void;
  range: DateRangeSel;
  setRange: React.Dispatch<React.SetStateAction<DateRangeSel>>;
  departureTime: string;
  setDepartureTime: (t: string) => void;
  returnTime: string;
  setReturnTime: (t: string) => void;
  blockedRanges: { from: string; to: string }[];
  loadingBlocked: boolean;

  // Recherche de disponibilité lancée depuis le landing
  search: WizardSearchCriteria | null;
  availableCars: Car[];          // = cars filtrées si recherche active, sinon toutes
  loadingAvailability: boolean;

  // Étape 2 — agences
  departureAgency: string;
  setDepartureAgency: (id: string) => void;
  differentReturnAgency: boolean;
  setDifferentReturnAgency: (b: boolean) => void;
  returnAgency: string;
  setReturnAgency: (id: string) => void;

  // Étape 5 — informations personnelles
  personal: ReservationStep2;
  setPersonal: React.Dispatch<React.SetStateAction<ReservationStep2>>;
  /** Âge du client déduit de sa date de naissance (null si non renseignée). */
  clientAge: number | null;
  /** true dès qu'une date de naissance saisie place le client sous 18 ans. */
  isUnderage: boolean;

  // Étape 3 — assurance de protection
  availableAssurances: ProtectionAssurance[];
  loadingAssurances: boolean;
  selectedAssurance: ProtectionAssurance | null;
  setSelectedAssurance: (a: ProtectionAssurance | null) => void;

  // Étape 4 — services
  availableServices: any[];
  loadingServices: boolean;
  selectedServices: AdditionalService[];
  toggleService: (service: AdditionalService) => void;

  // Étape 6 — récapitulatif
  notes: string;
  setNotes: (n: string) => void;

  // Code promo (vérifié côté serveur, consommé à la création)
  promoInput: string;
  setPromoInput: (v: string) => void;
  promoStatus: PromoStatus;
  promoDiscountPct: number;     // % appliqué si promoStatus === 'valid'
  verifyPromo: () => Promise<void>;
  clearPromo: () => void;

  // Tarification (remise d'offre spéciale appliquée si présente)
  // Tous ces montants sont en DINARS : le dinar est la devise de référence.
  days: number;
  promo: SpecialOffer | undefined;
  /** Tarifs unitaires du véhicule retenus pour le calcul (jour / semaine / mois). */
  unitPrices: RentalUnitPrices;
  /** Décomposition mois + semaines + jours appliquée au prix du véhicule. */
  breakdown: RentalPriceBreakdown;
  /** Applique la décomposition forfaitaire à une durée arbitraire (propositions). */
  priceForDays: (n: number) => number;
  basePrice: number;
  discount: number;
  servicesTotal: number;
  assuranceTotal: number;
  promoDiscount: number;        // remise en DA du code promo
  total: number;

  // Devise de règlement choisie par le client à l'étape finale
  paymentCurrency: Currency;
  setPaymentCurrency: (c: Currency) => void;
  /** Taux DA/€ retenu pour cette voiture (implicite de ses tarifs, sinon repli). */
  eurRate: number;
  /** Total converti en euros, quelle que soit la devise choisie. */
  totalEur: number;
  /** Formate un montant en DINARS vers la devise choisie par le client. */
  money: (amountDzd: number) => string;

  // Soumission
  isSubmitting: boolean;
  submitError: string | null;
  submitted: boolean;
  submit: () => Promise<void>;
}

const WizardContext = createContext<WizardContextValue | null>(null);

export const useWizard = (): WizardContextValue => {
  const ctx = useContext(WizardContext);
  if (!ctx) throw new Error('useWizard must be used within ReservationWizardProvider');
  return ctx;
};

/**
 * Les erreurs métier de `create_website_reservation` remontent sous forme de
 * codes (CAR_UNAVAILABLE, CLIENT_UNDERAGE…). Les afficher bruts au client ne
 * lui dit rien : on les traduit, et on garde le message serveur en repli.
 */
const friendlySubmitError = (raw: string | undefined, lang: Language): string => {
  const code = (raw || '').toUpperCase();
  const retry = lang === 'fr'
    ? ' Vos informations sont conservées, vous pouvez réessayer.'
    : ' تم الاحتفاظ بمعلوماتك، يمكنك المحاولة مرة أخرى.';

  if (code.includes('CLIENT_UNDERAGE')) {
    return lang === 'fr'
      ? `La location est interdite aux moins de ${MIN_DRIVER_AGE} ans. Vérifiez votre date de naissance à l'étape « Informations ».`
      : `الإيجار ممنوع لمن هم دون ${MIN_DRIVER_AGE} سنة. تحقق من تاريخ ميلادك في خطوة «المعلومات».`;
  }
  if (code.includes('CLIENT_BIRTHDATE_REQUIRED')) {
    return lang === 'fr'
      ? "Votre date de naissance est obligatoire : renseignez-la à l'étape « Informations »."
      : 'تاريخ ميلادك مطلوب: أدخله في خطوة «المعلومات».';
  }
  if (code.includes('CAR_UNAVAILABLE')) {
    return lang === 'fr'
      ? 'Ce véhicule vient d\u2019être réservé sur cette période. Choisissez d\u2019autres dates ou une autre voiture.'
      : 'تم حجز هذه السيارة للتو في هذه الفترة. اختر تواريخ أخرى أو سيارة أخرى.';
  }
  if (code.includes('PROMO_CODE_INVALID')) {
    return lang === 'fr'
      ? 'Ce code promo n\u2019est plus valable. Retirez-le puis confirmez à nouveau.'
      : 'رمز الخصم لم يعد صالحًا. أزله ثم أكّد من جديد.';
  }
  return lang === 'fr'
    ? `La réservation n'a pas pu être enregistrée : ${raw || 'erreur inconnue'}.${retry}`
    : `تعذر تسجيل الحجز: ${raw || 'خطأ غير معروف'}.${retry}`;
};

interface ProviderProps {
  lang: Language;
  cars: Car[];
  agencies: Agency[];
  isLoadingAgencies: boolean;
  specialOffers: SpecialOffer[];
  initialCar?: Car | null;
  /** Recherche lancée depuis le landing : pré-remplit dates + agences et filtre les voitures disponibles. */
  initialSearch?: WizardSearchCriteria | null;
  children: React.ReactNode;
}

export const ReservationWizardProvider: React.FC<ProviderProps> = ({
  lang, cars, agencies, isLoadingAgencies, specialOffers, initialCar, initialSearch, children,
}) => {
  const search = initialSearch || null;

  // Navigation
  const [step, setStep] = useState(1);

  // Étape 1
  const [car, setCar] = useState<Car | null>(initialCar || null);
  const [range, setRange] = useState<DateRangeSel>(
    search ? { from: search.from, to: search.to } : {}
  );
  const [departureTime, setDepartureTime] = useState('10:00');
  const [returnTime, setReturnTime] = useState('10:00');
  const [blockedRanges, setBlockedRanges] = useState<{ from: string; to: string }[]>([]);
  const [loadingBlocked, setLoadingBlocked] = useState(false);

  // Disponibilité (recherche landing) : ids des voitures indisponibles
  const [unavailableIds, setUnavailableIds] = useState<string[] | null>(null);
  const [loadingAvailability, setLoadingAvailability] = useState(!!search);

  // Étape 2
  const [departureAgency, setDepartureAgency] = useState(search?.departureAgencyId || '');
  const [differentReturnAgency, setDifferentReturnAgency] = useState(
    !!(search?.returnAgencyId && search.returnAgencyId !== search.departureAgencyId)
  );
  const [returnAgency, setReturnAgency] = useState(
    search?.returnAgencyId && search.returnAgencyId !== search.departureAgencyId ? search.returnAgencyId : ''
  );

  // Étape 5
  const [personal, setPersonal] = useState<ReservationStep2>(emptyPersonal);

  // Étape 3 — assurance de protection
  const [availableAssurances, setAvailableAssurances] = useState<ProtectionAssurance[]>([]);
  const [loadingAssurances, setLoadingAssurances] = useState(false);
  const [selectedAssurance, setSelectedAssurance] = useState<ProtectionAssurance | null>(null);

  // Étape 4
  const [availableServices, setAvailableServices] = useState<any[]>([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const [selectedServices, setSelectedServices] = useState<AdditionalService[]>([]);

  // Étape 6
  const [notes, setNotes] = useState('');

  // Devise de règlement — le dinar reste la référence, l'euro est une option client
  const [paymentCurrency, setPaymentCurrency] = useState<Currency>('DZD');

  // Code promo
  const [promoInput, setPromoInput] = useState('');
  const [promoStatus, setPromoStatus] = useState<PromoStatus>('idle');
  const [promoDiscountPct, setPromoDiscountPct] = useState(0);

  // Soumission
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  // Charge les dates bloquées de la voiture choisie (réservations pending/confirmed/active)
  useEffect(() => {
    if (!car) {
      setBlockedRanges([]);
      return;
    }
    let cancelled = false;
    const load = async () => {
      setLoadingBlocked(true);
      try {
        const ranges = await DatabaseService.getReservedDateRangesForCar(car.id);
        if (!cancelled) setBlockedRanges(ranges);
      } catch (err) {
        console.warn('Failed to load blocked dates:', err);
        if (!cancelled) setBlockedRanges([]);
      } finally {
        if (!cancelled) setLoadingBlocked(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [car]);

  // Recherche du landing : charge les voitures indisponibles sur la période
  useEffect(() => {
    if (!search) return;
    let cancelled = false;
    const load = async () => {
      setLoadingAvailability(true);
      try {
        const ids = await DatabaseService.getUnavailableCarIds(search.from, search.to);
        if (!cancelled) setUnavailableIds(ids); // null = RPC absente → toutes affichées
      } catch {
        if (!cancelled) setUnavailableIds(null);
      } finally {
        if (!cancelled) setLoadingAvailability(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [search?.from, search?.to]);

  // Charge les services une fois
  useEffect(() => {
    const load = async () => {
      try {
        setLoadingServices(true);
        setAvailableServices(await DatabaseService.getServices());
      } catch {
        setAvailableServices([]);
      } finally {
        setLoadingServices(false);
      }
    };
    load();
  }, []);

  // Charge les assurances de protection disponibles une fois
  useEffect(() => {
    const load = async () => {
      try {
        setLoadingAssurances(true);
        setAvailableAssurances(await DatabaseService.getProtectionAssurances());
      } catch {
        setAvailableAssurances([]);
      } finally {
        setLoadingAssurances(false);
      }
    };
    load();
  }, []);

  // Voitures proposées à l'étape 1 : filtrées par la recherche du landing
  const availableCars = useMemo(() => {
    if (!search || !unavailableIds) return cars;
    return cars.filter(c => !unavailableIds.includes(c.id));
  }, [cars, search, unavailableIds]);

  // Changer de voiture réinitialise les dates (les dates bloquées diffèrent par
  // voiture) — SAUF quand la période vient de la recherche du landing : les
  // voitures affichées sont déjà disponibles sur cette période.
  const selectCar = (newCar: Car | null) => {
    setCar(newCar);
    if (search && newCar) {
      setRange({ from: search.from, to: search.to });
    } else {
      setRange({});
    }
  };

  const toggleService = (service: AdditionalService) => {
    setSelectedServices(prev => {
      const exists = prev.find(s => s.id === service.id);
      return exists ? prev.filter(s => s.id !== service.id) : [...prev, service];
    });
  };

  // ─── Âge du conducteur ──────────────────────────────────────────────────────
  // Location interdite aux mineurs : la date de naissance est le seul champ
  // personnel exigé, et une date sous 18 ans bloque la suite du wizard.
  const clientAge = ageFromYmd(personal.dateOfBirth);
  const isUnderage = clientAge !== null && clientAge < MIN_DRIVER_AGE;

  // ─── Validation par étape ───────────────────────────────────────────────────
  const isStepValid = (n: number): boolean => {
    switch (n) {
      case 1:
        return !!car && !!range.from && !!range.to && !!departureTime && !!returnTime;
      case 2:
        return !!departureAgency && (!differentReturnAgency || !!returnAgency);
      case 3:
        return true; // les services sont optionnels
      case 4:
        // Informations personnelles — toutes facultatives : le client les complète
        // à l'agence au retrait du véhicule. Seule la date de naissance est exigée,
        // parce qu'elle sert à vérifier l'âge minimum légal (18 ans).
        return !!personal.dateOfBirth && !isUnderage;
      case 5:
        return true;
      default:
        return false;
    }
  };

  const goToStep = (n: number) => {
    if (n < 1 || n > WIZARD_STEP_COUNT) return;
    // En avant : toutes les étapes précédentes doivent être valides
    if (n > step) {
      for (let i = step; i < n; i++) {
        if (!isStepValid(i)) return;
      }
    }
    setStep(n);
  };

  const next = () => goToStep(step + 1);
  const prev = () => goToStep(step - 1);

  // ─── Tarification ───────────────────────────────────────────────────────────
  const days = useMemo(() => {
    if (!range.from || !range.to) return 0;
    const diff = Math.ceil((fromYmd(range.to).getTime() - fromYmd(range.from).getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(1, diff);
  }, [range.from, range.to]);

  const promo = car ? getCurrentSpecialOfferForCar(car.id, specialOffers) : undefined;

  // Tarifs unitaires de la fiche véhicule. Une semaine/un mois absent retombe
  // sur le forfait inférieur (cf. resolveUnits dans rentalPricing).
  const unitPrices: RentalUnitPrices = useMemo(() => ({
    day: car ? Number(car.priceDay) || 0 : 0,
    week: car ? Number(car.priceWeek) || 0 : 0,
    month: car ? Number(car.priceMonth) || 0 : 0,
  }), [car?.priceDay, car?.priceWeek, car?.priceMonth]);

  // Décomposition mois (30 j) → semaines (7 j) → jours : 7 jours sont facturés au
  // forfait semaine, 30 au forfait mois, et un reliquat plus cher que le forfait
  // supérieur y est remonté. Le client ne paie jamais plus que le palier suivant.
  const breakdown = useMemo(
    () => computeRentalBasePrice(days, unitPrices),
    [days, unitPrices],
  );

  /** Prix forfaitaire d'une durée quelconque — sert aux propositions 1 j / 1 sem. / 1 mois. */
  const priceForDays = (n: number) => computeRentalBasePrice(n, unitPrices).total;

  const basePrice = breakdown.total;

  // Offre spéciale : la remise porte sur le tarif journalier. On applique le même
  // ratio aux forfaits semaine/mois, sinon une promo « −20 % la journée »
  // disparaîtrait dès que la durée bascule sur un forfait.
  const promoRatio = promo && car && car.priceDay > 0
    ? Math.min(1, Math.max(0, promo.newPrice / car.priceDay))
    : 1;
  const promoBreakdown = useMemo(
    () => (promo && promoRatio < 1
      ? computeRentalBasePrice(days, {
          day: unitPrices.day * promoRatio,
          week: unitPrices.week * promoRatio,
          month: unitPrices.month * promoRatio,
        })
      : null),
    [promo, promoRatio, days, unitPrices],
  );
  const discount = promoBreakdown ? Math.max(0, Math.round(basePrice - promoBreakdown.total)) : 0;
  const servicesTotal = selectedServices.reduce((sum, s) => sum + s.price, 0);
  const assuranceTotal = selectedAssurance ? selectedAssurance.pricePerDay * days : 0;
  const subtotal = Math.max(0, basePrice - discount + servicesTotal + assuranceTotal);
  // Le code promo (en %) s'applique sur le sous-total final
  const promoDiscount = promoStatus === 'valid' && promoDiscountPct > 0
    ? Math.round(subtotal * (promoDiscountPct / 100))
    : 0;
  const total = Math.max(0, subtotal - promoDiscount);

  // ─── Devise de règlement ────────────────────────────────────────────────────
  // Le taux vient des tarifs de la voiture : afficher un total euro calculé à un
  // autre taux que celui annoncé sur sa fiche serait incohérent pour le client.
  const eurRate = carEurRate(car);
  const totalEur = dzdToEur(total, eurRate);
  const money = (amountDzd: number) =>
    paymentCurrency === 'EUR'
      ? formatMoney(dzdToEur(amountDzd, eurRate), 'EUR')
      : formatMoney(amountDzd, 'DZD');

  // ─── Code promo : vérification serveur (RPC, sans exposer la table) ─────────
  const verifyPromo = async () => {
    const code = promoInput.trim();
    if (!code) return;
    setPromoStatus('checking');
    try {
      const res = await DatabaseService.verifyPromoCode(code);
      if (res.valid && res.discountPercentage) {
        setPromoDiscountPct(res.discountPercentage);
        setPromoStatus('valid');
      } else {
        setPromoDiscountPct(0);
        setPromoStatus('invalid');
      }
    } catch {
      setPromoDiscountPct(0);
      setPromoStatus('invalid');
    }
  };

  const clearPromo = () => {
    setPromoInput('');
    setPromoStatus('idle');
    setPromoDiscountPct(0);
  };

  // ─── Soumission via RPC SECURITY DEFINER (fix RLS pour le rôle anon) ─────────
  // Client + réservation + services + consommation du code promo : une seule
  // transaction serveur. Garde anti double-clic ; les saisies survivent à une erreur.
  const submit = async () => {
    // Garde finale : un mineur ne peut pas confirmer, même en forçant l'étape.
    if (!car || isSubmitting || submitted || isUnderage || !personal.dateOfBirth) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const clientPayload = {
        first_name: personal.firstName,
        last_name: personal.lastName,
        phone: personal.phone,
        email: personal.email,
        date_of_birth: personal.dateOfBirth,
        place_of_birth: personal.placeOfBirth,
        id_card_number: personal.additionalDocType === 'id_card' ? (personal.additionalDocNumber || '') : '',
        license_number: personal.licenseNumber,
        license_expiration_date: personal.licenseExpiration,
        license_delivery_date: personal.licenseDelivery,
        license_delivery_place: personal.licenseDeliveryPlace,
        document_type: personal.additionalDocType,
        document_number: personal.additionalDocNumber,
        document_delivery_date: personal.additionalDocDelivery,
        document_expiration_date: personal.additionalDocExpiration,
        document_delivery_address: personal.additionalDocDeliveryAddress,
        wilaya: personal.wilaya,
        complete_address: personal.completeAddress,
        profile_photo: personal.photo,
        scanned_documents: personal.scannedDocuments || [],
      };

      const reservationPayload = {
        car_id: car.id,
        departure_date: range.from!,
        departure_time: departureTime,
        departure_agency_id: departureAgency,
        return_date: range.to!,
        return_time: returnTime,
        return_agency_id: differentReturnAgency ? returnAgency : departureAgency,
        price_per_day: car.priceDay,
        price_week: car.priceWeek ?? '',
        price_month: car.priceMonth ?? '',
        total_days: days,
        total_price: total,
        deposit: car.deposit,
        discount_amount: discount + promoDiscount,
        discount_type: 'fixed',
        notes,
        // Devise réglée par le client. `total_price` reste le montant en dinars ;
        // `total_price_eur` n'est renseigné que si le client paie en euros.
        payment_currency: paymentCurrency,
        euro_rate: eurRate,
        total_price_eur: paymentCurrency === 'EUR' ? totalEur : null,
        // Assurance de protection sélectionnée (snapshot nom + prix/jour)
        protection_assurance_id: selectedAssurance?.id || '',
        protection_assurance_name: selectedAssurance?.name || '',
        protection_assurance_price: selectedAssurance?.pricePerDay ?? 0,
      };

      const servicesPayload = selectedServices.map(s => ({
        category: (s as any).category || 'service',
        service_name: (s as any).name || (s as any).service_name || '',
        description: (s as any).description || '',
        price: s.price,
      }));

      await DatabaseService.createWebsiteReservation({
        client: clientPayload,
        reservation: reservationPayload,
        services: servicesPayload,
        promoCode: promoStatus === 'valid' ? promoInput.trim() : null,
      });

      setSubmitted(true);
    } catch (err: any) {
      console.error('Reservation submit failed:', err);
      setSubmitError(friendlySubmitError(err?.message, lang));
    } finally {
      setIsSubmitting(false);
    }
  };

  const value: WizardContextValue = {
    lang, cars, agencies, isLoadingAgencies,
    step, goToStep, next, prev, isStepValid,
    car, selectCar, range, setRange,
    departureTime, setDepartureTime, returnTime, setReturnTime,
    blockedRanges, loadingBlocked,
    search, availableCars, loadingAvailability,
    departureAgency, setDepartureAgency, differentReturnAgency, setDifferentReturnAgency, returnAgency, setReturnAgency,
    personal, setPersonal, clientAge, isUnderage,
    availableAssurances, loadingAssurances, selectedAssurance, setSelectedAssurance,
    availableServices, loadingServices, selectedServices, toggleService,
    notes, setNotes,
    promoInput, setPromoInput, promoStatus, promoDiscountPct, verifyPromo, clearPromo,
    days, promo, unitPrices, breakdown, priceForDays,
    basePrice, discount, servicesTotal, assuranceTotal, promoDiscount, total,
    paymentCurrency, setPaymentCurrency, eurRate, totalEur, money,
    isSubmitting, submitError, submitted, submit,
  };

  return <WizardContext.Provider value={value}>{children}</WizardContext.Provider>;
};
