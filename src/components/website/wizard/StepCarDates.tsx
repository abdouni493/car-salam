import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, ChevronRight, Search, CalendarCheck, Loader2, Sun, CalendarRange, CalendarDays } from 'lucide-react';
import { Car } from '../../../types';
import { useWizard } from './WizardContext';
import { CarBookingCalendar } from './CarBookingCalendar';
import { SectionCard, SectionTitle, FieldLabel, inputClass, inputStyle, focusInput, blurInput, C, fromYmd, toYmd } from './wizardUi';
import { carPricesEur, formatMoney } from '../../../utils/currency';
import { describeRentalBreakdown, DAYS_PER_WEEK, DAYS_PER_MONTH } from '../../../utils/rentalPricing';

/**
 * Étape 1 — Choisir une voiture + dates.
 * Sans voiture choisie : grille de sélection (avec recherche).
 * Si une recherche de disponibilité vient du landing : seules les voitures
 * DISPONIBLES sur la période choisie sont proposées (dates pré-remplies).
 * Avec voiture : calendrier aux dates réservées bloquées + heures de départ/retour.
 */
export const StepCarDates: React.FC = () => {
  const {
    lang, car, selectCar, range, setRange,
    departureTime, setDepartureTime, returnTime, setReturnTime,
    blockedRanges, loadingBlocked, days, promo, total,
    search, availableCars, loadingAvailability, agencies,
    unitPrices, breakdown, priceForDays,
  } = useWizard();

  // Proposition de durée refusée parce qu'elle chevauche une période réservée.
  const [durationError, setDurationError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');

  const filteredCars = searchQuery.trim()
    ? availableCars.filter(c =>
        c.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.registration.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : availableCars;

  const fmt = (s: string) => fromYmd(s).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'ar-DZ');
  const agencyName = (id?: string) => agencies.find(a => a.id === id)?.name;

  // ─── Sélection de voiture ────────────────────────────────────────────────────
  if (!car) {
    return (
      <div className="space-y-8">
        <div className="text-center">
          <h1 className="font-black text-3xl sm:text-4xl text-vel-ink mb-2" style={{ fontFamily: 'var(--font-display)' }}>
            {search
              ? { fr: 'Voitures disponibles', ar: 'السيارات المتاحة' }[lang]
              : { fr: 'Choisissez votre voiture', ar: 'اختر سيارتك' }[lang]}
          </h1>
          <p className="text-vel-muted">
            {{ fr: 'Cliquez sur un véhicule pour commencer votre réservation', ar: 'انقر على سيارة لبدء الحجز' }[lang]}
          </p>
        </div>

        {/* Bandeau récapitulatif de la recherche lancée depuis l'accueil */}
        {search && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-2xl mx-auto flex flex-wrap items-center justify-center gap-x-4 gap-y-1 px-5 py-3.5 rounded-2xl text-sm"
            style={{ background: 'rgba(234, 88, 12, 0.05)', border: '1px solid rgba(234, 88, 12, 0.16)' }}
          >
            <span className="flex items-center gap-2 font-bold" style={{ color: C.accent }}>
              <CalendarCheck size={15} />
              {fmt(search.from)} → {fmt(search.to)}
            </span>
            {agencyName(search.departureAgencyId) && (
              <span className="text-vel-slate">
                🛫 {agencyName(search.departureAgencyId)}
                {search.returnAgencyId && search.returnAgencyId !== search.departureAgencyId && (
                  <> · 🛬 {agencyName(search.returnAgencyId)}</>
                )}
              </span>
            )}
            <span className="text-vel-muted text-xs">
              {loadingAvailability
                ? { fr: 'Vérification des disponibilités…', ar: 'جاري التحقق من التوفر…' }[lang]
                : `${filteredCars.length} ${{ fr: 'voiture(s) disponible(s)', ar: 'سيارة متاحة' }[lang]}`}
            </span>
          </motion.div>
        )}

        {/* Recherche */}
        <div className="relative flex items-center max-w-xl mx-auto">
          <Search size={18} className="absolute left-4 text-vel-muted pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={lang === 'fr' ? 'Rechercher par marque, modèle, immatriculation…' : 'ابحث بالماركة أو الموديل…'}
            className="w-full pl-12 pr-4 py-3.5 text-base rounded-2xl outline-none transition-all text-vel-ink placeholder:text-vel-dim font-medium"
            style={{ background: C.elevated, border: '1px solid rgba(234, 88, 12, 0.16)' }}
            onFocus={focusInput} onBlur={blurInput}
          />
        </div>

        {loadingAvailability ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={30} className="animate-spin" style={{ color: C.accent }} />
          </div>
        ) : filteredCars.length === 0 ? (
          <div className="text-center py-16">
            <span className="text-5xl block mb-4">🚗</span>
            <p className="text-vel-muted font-bold">
              {search
                ? { fr: 'Aucune voiture disponible sur cette période — modifiez vos dates', ar: 'لا توجد سيارات متاحة في هذه الفترة — غيّر التواريخ' }[lang]
                : { fr: 'Aucun véhicule disponible', ar: 'لا توجد سيارات متاحة' }[lang]}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredCars.map((c, i) => (
              <motion.button
                key={c.id}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 + i * 0.05, duration: 0.4 }}
                whileHover={{ y: -6 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => selectCar(c)}
                className="text-left rounded-2xl overflow-hidden transition-all duration-400 group cursor-pointer"
                style={{ background: C.elevated, border: '1px solid rgba(15, 23, 42, 0.06)' }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'rgba(234, 88, 12, 0.28)';
                  (e.currentTarget as HTMLElement).style.boxShadow = '0 0 30px rgba(234, 88, 12, 0.08)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'rgba(15, 23, 42, 0.06)';
                  (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                }}
              >
                <div className="h-40 overflow-hidden relative" style={{ background: C.surface }}>
                  {c.images?.[0] ? (
                    <img src={c.images[0]} alt={c.model} loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-600"
                      referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-5xl">🚗</div>
                  )}
                  <div className="absolute top-3 left-3 px-2 py-0.5 rounded-lg text-xs font-bold"
                    style={{ background: 'rgba(234, 88, 12, 0.1)', border: '1px solid rgba(234, 88, 12, 0.25)', color: C.accent, fontFamily: 'var(--font-display)' }}>
                    {c.year}
                  </div>
                </div>
                <div className="p-5">
                  <h3 className="font-black text-vel-ink text-base mb-0.5" style={{ fontFamily: 'var(--font-display)' }}>
                    {c.brand} <span style={{ color: C.accent }}>{c.model}</span>
                  </h3>
                  <p className="text-vel-muted text-xs mb-3">{c.registration} · {c.color}</p>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-black text-lg" style={{ color: C.accent, fontFamily: 'var(--font-display)' }}>
                        {c.priceDay.toLocaleString()}
                        <span className="text-xs ml-1" style={{ color: 'rgba(234, 88, 12, 0.75)' }}>
                          {{ fr: 'DA/j', ar: 'د.ج/ي' }[lang]}
                        </span>
                      </p>
                      <p className="text-xs font-bold text-vel-muted">
                        {formatMoney(carPricesEur(c).day, 'EUR')}{{ fr: ' / jour', ar: ' / يوم' }[lang]}
                      </p>
                      {/* Forfaits : le client voit dès la sélection qu'une semaine
                          ou un mois coûte moins cher que le cumul des journées. */}
                      <p className="text-[11px] text-vel-dim mt-1 font-medium">
                        {{ fr: 'sem.', ar: 'أسبوع' }[lang]} {(c.priceWeek || c.priceDay * 7).toLocaleString()}
                        {' · '}
                        {{ fr: 'mois', ar: 'شهر' }[lang]} {(c.priceMonth || c.priceDay * 30).toLocaleString()}
                      </p>
                    </div>
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                      style={{ background: 'rgba(234, 88, 12, 0.09)', border: '1px solid rgba(234, 88, 12, 0.25)' }}>
                      <ChevronRight size={15} style={{ color: C.accent }} />
                    </div>
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ─── Propositions de durée ──────────────────────────────────────────────────
  // Le client voit d'emblée ce que coûtent 1 jour, 1 semaine (forfait) et
  // 1 mois (forfait) : sans ça, seul le tarif journalier était lisible et les
  // forfaits semblaient ne jamais s'appliquer.
  const todayYmd = toYmd(new Date());
  const addDays = (ymd: string, n: number) => {
    const d = fromYmd(ymd);
    d.setDate(d.getDate() + n);
    return toYmd(d);
  };
  const overlapsBlocked = (from: string, to: string) =>
    blockedRanges.some(b => from <= b.to && b.from <= to);

  /** Applique une durée en repartant de la date de départ choisie, sinon d'aujourd'hui. */
  const applyDuration = (n: number) => {
    const start = range.from && range.from >= todayYmd ? range.from : todayYmd;
    const end = addDays(start, n);
    if (overlapsBlocked(start, end)) {
      setDurationError(
        lang === 'fr'
          ? 'Cette durée chevauche des dates déjà réservées — choisissez une date de départ puis ajustez au calendrier.'
          : 'هذه المدة تتداخل مع تواريخ محجوزة — اختر تاريخ مغادرة ثم عدّل في التقويم.'
      );
      return;
    }
    setDurationError(null);
    setRange({ from: start, to: end });
  };

  const durationOffers = [
    {
      n: 1,
      icon: Sun,
      label: { fr: '1 jour', ar: 'يوم واحد' },
      tag: { fr: 'Tarif journalier', ar: 'السعر اليومي' },
      price: priceForDays(1),
    },
    {
      n: DAYS_PER_WEEK,
      icon: CalendarRange,
      label: { fr: '1 semaine', ar: 'أسبوع واحد' },
      tag: { fr: 'Forfait semaine (7 jours)', ar: 'باقة الأسبوع (7 أيام)' },
      price: priceForDays(DAYS_PER_WEEK),
    },
    {
      n: DAYS_PER_MONTH,
      icon: CalendarDays,
      label: { fr: '1 mois', ar: 'شهر واحد' },
      tag: { fr: 'Forfait mois (30 jours)', ar: 'باقة الشهر (30 يومًا)' },
      price: priceForDays(DAYS_PER_MONTH),
    },
  ];

  // ─── Calendrier + heures pour la voiture choisie ────────────────────────────
  return (
    <div className="space-y-6">
      {/* Bandeau voiture sélectionnée */}
      <div className="rounded-2xl flex gap-4 p-5 items-center"
        style={{ background: 'rgba(234, 88, 12, 0.05)', border: '1px solid rgba(234, 88, 12, 0.16)' }}>
        <div className="w-20 h-16 rounded-xl overflow-hidden flex-shrink-0" style={{ background: C.surface }}>
          {car.images?.[0]
            ? <img src={car.images[0]} alt={car.model} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            : <div className="w-full h-full flex items-center justify-center text-2xl">🚗</div>
          }
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-black text-xl text-vel-ink truncate" style={{ fontFamily: 'var(--font-display)' }}>
            {car.brand} <span style={{ color: C.accent }}>{car.model}</span>
          </h2>
          <p className="text-vel-muted text-sm">
            {car.registration} · {promo
              ? <>
                  <span className="line-through">{car.priceDay.toLocaleString()}</span>{' '}
                  <span className="font-bold" style={{ color: C.accent }}>{promo.newPrice.toLocaleString()} DA/j</span>
                </>
              : <>{car.priceDay.toLocaleString()} DA/j</>}
          </p>
        </div>
        <button
          onClick={() => selectCar(null)}
          className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-vel-slate transition-colors"
          style={{ border: '1px solid rgba(15, 23, 42, 0.12)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = C.accent; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(234, 88, 12, 0.25)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = ''; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(15, 23, 42, 0.12)'; }}
        >
          <ChevronLeft size={14} />
          {{ fr: 'Choisir une autre voiture', ar: 'اختيار سيارة أخرى' }[lang]}
        </button>
      </div>

      {/* Propositions de durée — affichées AVANT le choix des dates */}
      <SectionCard>
        <SectionTitle>🏷️ {{ fr: 'Nos formules', ar: 'صيغنا' }[lang]}</SectionTitle>
        <p className="text-vel-muted text-sm -mt-3">
          {{ fr: 'Choisissez une formule : les dates se remplissent automatiquement et le forfait est appliqué.',
             ar: 'اختر صيغة: تُملأ التواريخ تلقائيًا ويُطبَّق السعر المقطوع.' }[lang]}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {durationOffers.map(o => {
            const active = days === o.n;
            const perDay = Math.round(o.price / o.n);
            return (
              <motion.button
                key={o.n}
                type="button"
                onClick={() => applyDuration(o.n)}
                whileHover={{ y: -4 }}
                whileTap={{ scale: 0.97 }}
                className="text-left rounded-2xl p-5 transition-all cursor-pointer"
                style={{
                  background: active ? 'rgba(234, 88, 12, 0.08)' : C.elevated,
                  border: active ? '2px solid var(--color-vel-cta)' : '1px solid rgba(15, 23, 42, 0.08)',
                  boxShadow: active ? '0 0 24px rgba(234, 88, 12, 0.12)' : 'none',
                }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(234, 88, 12, 0.1)', border: '1px solid rgba(234, 88, 12, 0.25)' }}>
                    <o.icon size={17} style={{ color: C.accent }} />
                  </span>
                  <span className="font-black text-vel-ink text-base" style={{ fontFamily: 'var(--font-display)' }}>
                    {o.label[lang]}
                  </span>
                </div>
                <p className="font-black text-2xl leading-none" style={{ color: C.accent, fontFamily: 'var(--font-display)' }}>
                  {o.price.toLocaleString()}
                  <span className="text-xs ml-1 font-bold">{{ fr: 'DA', ar: 'د.ج' }[lang]}</span>
                </p>
                <p className="text-vel-muted text-[11px] font-bold mt-1.5 uppercase tracking-wider">{o.tag[lang]}</p>
                {o.n > 1 && (
                  <p className="text-vel-slate text-xs mt-2">
                    {{ fr: 'soit', ar: 'أي' }[lang]} <span className="font-bold">{perDay.toLocaleString()} {{ fr: 'DA / jour', ar: 'د.ج / يوم' }[lang]}</span>
                  </p>
                )}
              </motion.button>
            );
          })}
        </div>

        {durationError && (
          <p className="text-sm font-bold px-4 py-3 rounded-xl"
            style={{ color: 'var(--color-vel-cta-bright)', background: 'rgba(234, 88, 12, 0.08)', border: '1px solid rgba(234, 88, 12, 0.25)' }}>
            ⚠️ {durationError}
          </p>
        )}

        <p className="text-vel-dim text-xs">
          {{ fr: 'Au-delà, tout est combiné automatiquement : 12 jours = 1 semaine + 5 jours, 39 jours = 1 mois + 1 semaine + 2 jours.',
             ar: 'وما بعد ذلك يُجمع تلقائيًا: 12 يومًا = أسبوع + 5 أيام، 39 يومًا = شهر + أسبوع + يومان.' }[lang]}
        </p>
      </SectionCard>

      {/* Calendrier */}
      <SectionCard>
        <SectionTitle>📅 {{ fr: 'Dates de location', ar: 'تواريخ الإيجار' }[lang]}</SectionTitle>
        <CarBookingCalendar
          lang={lang}
          range={range}
          onRangeChange={setRange}
          blockedRanges={blockedRanges}
          loading={loadingBlocked}
        />
      </SectionCard>

      {/* Heures */}
      <SectionCard>
        <SectionTitle>🕒 {{ fr: 'Heures', ar: 'الساعات' }[lang]}</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <FieldLabel>{{ fr: 'Heure de départ *', ar: 'ساعة المغادرة *' }[lang]}</FieldLabel>
            <input type="time" value={departureTime}
              onChange={e => setDepartureTime(e.target.value)}
              className={inputClass} style={inputStyle}
              onFocus={focusInput} onBlur={blurInput} />
          </div>
          <div>
            <FieldLabel>{{ fr: 'Heure de retour *', ar: 'ساعة العودة *' }[lang]}</FieldLabel>
            <input type="time" value={returnTime}
              onChange={e => setReturnTime(e.target.value)}
              className={inputClass} style={inputStyle}
              onFocus={focusInput} onBlur={blurInput} />
          </div>
        </div>

        {/* Aperçu durée + ventilation par forfaits */}
        {days > 0 && range.to && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="px-4 py-4 rounded-xl space-y-2"
            style={{ background: 'rgba(234, 88, 12, 0.05)', border: '1px solid rgba(234, 88, 12, 0.1)' }}
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">📅</span>
              <span className="text-vel-slate font-bold text-sm">
                {days} {{ fr: 'jour(s)', ar: 'يوم' }[lang]}
                {' — '}
                <span className="text-vel-ink">{describeRentalBreakdown(breakdown, lang === 'ar' ? 'ar' : 'fr')}</span>
                {promo && (
                  <span className="ml-2 text-xs px-2 py-0.5 rounded font-bold text-white" style={{ background: 'var(--color-vel-cta)' }}>
                    {promo.label || (lang === 'fr' ? 'Promo' : 'عرض')}
                  </span>
                )}
              </span>
            </div>

            {/* Le détail rend visible l'application des forfaits semaine / mois */}
            <div className="space-y-1 pl-9 text-xs text-vel-muted">
              {breakdown.months > 0 && (
                <div className="flex justify-between gap-4">
                  <span>{breakdown.months} × {{ fr: 'mois (30 j)', ar: 'شهر (30 يومًا)' }[lang]} × {unitPrices.month ? unitPrices.month.toLocaleString() : '—'}</span>
                  <span className="font-bold text-vel-slate">{breakdown.monthsPrice.toLocaleString()} {{ fr: 'DA', ar: 'د.ج' }[lang]}</span>
                </div>
              )}
              {breakdown.weeks > 0 && (
                <div className="flex justify-between gap-4">
                  <span>{breakdown.weeks} × {{ fr: 'semaine (7 j)', ar: 'أسبوع (7 أيام)' }[lang]} × {unitPrices.week ? unitPrices.week.toLocaleString() : '—'}</span>
                  <span className="font-bold text-vel-slate">{breakdown.weeksPrice.toLocaleString()} {{ fr: 'DA', ar: 'د.ج' }[lang]}</span>
                </div>
              )}
              {breakdown.days > 0 && (
                <div className="flex justify-between gap-4">
                  <span>{breakdown.days} × {{ fr: 'jour', ar: 'يوم' }[lang]} × {unitPrices.day.toLocaleString()}</span>
                  <span className="font-bold text-vel-slate">{breakdown.daysPrice.toLocaleString()} {{ fr: 'DA', ar: 'د.ج' }[lang]}</span>
                </div>
              )}
            </div>

            <div className="flex justify-between items-baseline gap-4 pt-2 border-t"
              style={{ borderColor: 'rgba(234, 88, 12, 0.18)' }}>
              {/* `total` inclut services et assurance si le client est déjà passé
                  par les étapes suivantes — d'où « estimé » plutôt qu'un libellé
                  qui promettrait le seul prix du véhicule. */}
              <span className="text-vel-slate font-bold text-sm">{{ fr: 'Total estimé', ar: 'المجموع التقديري' }[lang]}</span>
              <span className="font-black text-lg" style={{ color: C.accent, fontFamily: 'var(--font-display)' }}>
                {total.toLocaleString()} {{ fr: 'DA', ar: 'د.ج' }[lang]}
              </span>
            </div>
          </motion.div>
        )}
      </SectionCard>
    </div>
  );
};
