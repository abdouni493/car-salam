import React, { useRef, useState } from 'react';
import { Language, Agency } from '../../types';
import { motion, useScroll, useTransform } from 'motion/react';
import {
  ChevronDown, Zap, ArrowRight, Car as CarIcon, MapPin, CalendarDays, Search,
  Check, ShieldCheck, Headphones, Receipt, Gem, Wallet, Headset,
} from 'lucide-react';
import { Hero3D } from './Hero3D';
import { ShowcaseBand } from './ShowcaseBand';
import { HERO_SPLINE_SCENE_URL } from '../../constants';
import { WizardSearchCriteria } from './wizard/WizardContext';
import { toYmd } from './wizard/wizardUi';

// ─── Colour tokens for this page ───────────────────────────────────────────
const C = {
  accent:    '#B45309',   // or lisible sur fond clair (AA)
  gold:      '#D4AF37',   // or métallique : aplats et dégradés
  black:     '#0F172A',   // texte posé sur les aplats or
  amber:     '#D97706',
  accentDim: 'rgba(180,83,9,0.1)',
  amberDim:  'rgba(217,119,6,0.1)',
  bg:        '#F8FAFC',
  surface:   '#FFFFFF',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
const shortName = (name: string | undefined) =>
  name ? name.split(/\s+/).slice(0, 3).join(' ') : 'AutoLocation';

// ─── Pure CSS + Framer Motion hero visual (anneaux animés uniquement) ────────
function HeroVisual() {
  return (
    <div className="relative w-full h-[500px] flex items-center justify-center">

      {/* Outer slow rotating ring */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 28, repeat: Infinity, ease: 'linear' }}
        className="absolute w-[400px] h-[400px] rounded-full"
        style={{ border: '1px solid rgba(180,83,9,0.09)' }}
      >
        <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full"
          style={{ background: C.accent, boxShadow: `0 0 14px ${C.accent}` }} />
      </motion.div>

      {/* Middle violet counter-ring */}
      <motion.div
        animate={{ rotate: -360 }}
        transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
        className="absolute w-[290px] h-[290px] rounded-full"
        style={{ border: '1px dashed rgba(217,119,6,0.2)' }}
      >
        <div className="absolute top-0 right-6 w-2 h-2 rounded-full"
          style={{ background: C.amber, boxShadow: `0 0 10px ${C.amber}` }} />
      </motion.div>

      {/* Inner pulsing ring */}
      <motion.div
        animate={{ scale: [1, 1.07, 1], opacity: [0.35, 0.65, 0.35] }}
        transition={{ duration: 3, repeat: Infinity }}
        className="absolute w-[180px] h-[180px] rounded-full"
        style={{ border: '1px solid rgba(180,83,9,0.3)' }}
      />

      {/* Corner accent dots */}
      <div className="absolute top-8 left-8 w-1.5 h-1.5 rounded-full opacity-60"
        style={{ background: C.amber }} />
      <div className="absolute bottom-12 left-12 w-1 h-1 rounded-full opacity-40"
        style={{ background: C.accent }} />
      <div className="absolute top-16 right-16 w-1 h-1 rounded-full opacity-50"
        style={{ background: C.accent }} />
    </div>
  );
}

// ─── Widget de réservation du hero (agences + période → voitures dispo) ─────
function BookingSearchPanel({ lang, agencies, onSearch, hasBg }: {
  lang: Language;
  agencies: Agency[];
  onSearch: (criteria: WizardSearchCriteria) => void;
  hasBg?: boolean;
}) {
  const today = toYmd(new Date());
  const [departureAgencyId, setDepartureAgencyId] = useState('');
  const [returnAgencyId, setReturnAgencyId] = useState('');   // '' = même agence
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const isValid = !!departureAgencyId && !!from && !!to && from <= to && from >= today;

  const selectClass = "w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-900 outline-none hover:border-vel-gold focus:border-vel-gold focus:ring-4 focus:ring-vel-gold/10 transition-all duration-200 cursor-pointer shadow-sm";
  const inputClass = "w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-900 outline-none hover:border-vel-gold focus:border-vel-gold focus:ring-4 focus:ring-vel-gold/10 transition-all duration-200 shadow-sm";

  const fields: { label: string; icon: React.ReactNode; el: React.ReactNode }[] = [
    {
      label: { fr: 'Lieu de départ', ar: 'مكان المغادرة' }[lang],
      icon: <MapPin size={13} className="text-vel-gold" />,
      el: (
        <select value={departureAgencyId} onChange={e => setDepartureAgencyId(e.target.value)}
          className={selectClass}>
          <option value="">{{ fr: 'Sélectionner…', ar: 'اختر…' }[lang]}</option>
          {agencies.map(a => <option key={a.id} value={a.id}>{a.name} — {a.city}</option>)}
        </select>
      ),
    },
    {
      label: { fr: 'Lieu de retour', ar: 'مكان الإرجاع' }[lang],
      icon: <MapPin size={13} className="text-vel-gold" />,
      el: (
        <select value={returnAgencyId} onChange={e => setReturnAgencyId(e.target.value)}
          className={selectClass}>
          <option value="">{{ fr: 'Même lieu', ar: 'نفس المكان' }[lang]}</option>
          {agencies.map(a => <option key={a.id} value={a.id}>{a.name} — {a.city}</option>)}
        </select>
      ),
    },
    {
      label: { fr: 'Date de départ', ar: 'تاريخ البدء' }[lang],
      icon: <CalendarDays size={13} className="text-vel-gold" />,
      el: (
        <input type="date" value={from} min={today}
          onChange={e => { setFrom(e.target.value); if (to && e.target.value > to) setTo(''); }}
          className={inputClass} />
      ),
    },
    {
      label: { fr: 'Date de retour', ar: 'تاريخ الإرجاع' }[lang],
      icon: <CalendarDays size={13} className="text-vel-gold" />,
      el: (
        <input type="date" value={to} min={from || today}
          onChange={e => setTo(e.target.value)}
          className={inputClass} />
      ),
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.75 }}
      className="relative z-20 rounded-3xl p-6 sm:p-8"
      style={{
        background: 'rgba(255, 255, 255, 0.12)',
        border: '1px solid rgba(255, 255, 255, 0.35)',
        backdropFilter: 'blur(20px) saturate(140%)',
        WebkitBackdropFilter: 'blur(20px) saturate(140%)',
        boxShadow: '0 20px 60px rgba(15, 23, 42, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.4)',
      }}
    >
      <p className="text-xs font-bold tracking-[0.2em] uppercase mb-5 flex items-center gap-2"
        style={{ color: C.accent, fontFamily: 'var(--font-display)' }}>
        <Search size={14} className="animate-pulse" />
        {{ fr: 'Trouvez votre voiture disponible', ar: 'اعثر على سيارتك المتاحة' }[lang]}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_auto] gap-4 items-end">
        {fields.map((f, i) => (
          <div key={i}>
            <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2"
              style={{ fontFamily: 'var(--font-display)' }}>
              {f.icon} {f.label}
            </label>
            {f.el}
          </div>
        ))}

        <motion.button
          onClick={() => isValid && onSearch({
            from, to,
            departureAgencyId,
            returnAgencyId: returnAgencyId || undefined,
          })}
          disabled={!isValid}
          whileHover={isValid ? { scale: 1.03, y: -1 } : {}}
          whileTap={isValid ? { scale: 0.97 } : {}}
          className={`px-8 py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 whitespace-nowrap transition-all ${!isValid ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:shadow-lg hover:shadow-vel-gold/20'}`}
          style={{
            fontFamily: 'var(--font-display)',
            background: `linear-gradient(135deg, ${C.gold}, ${C.accent})`,
            color: C.black,
            boxShadow: isValid ? '0 6px 20px rgba(180,83,9,0.25)' : 'none',
          }}
        >
          {{ fr: 'Suivant', ar: 'التالي' }[lang]} <ArrowRight size={16} />
        </motion.button>
      </div>

      <p className="text-slate-400 text-[11px] mt-4 font-medium">
        {{ fr: 'Nous afficherons uniquement les voitures disponibles sur la période choisie.',
           ar: 'سنعرض فقط السيارات المتاحة في الفترة المختارة.' }[lang]}
      </p>
    </motion.div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
interface WelcomeProps {
  lang: Language;
  websiteSettings: any;
  /** Agences pour le widget de recherche de disponibilité. */
  agencies: Agency[];
  /** Ouvre la grille des voitures ("Voir les voitures"). */
  onStartRenting: () => void;
  /** Lance le wizard de réservation ("Réserver"). */
  onReserve: () => void;
  /** Recherche de disponibilité : ouvre le wizard pré-rempli (agences + dates). */
  onSearch: (criteria: WizardSearchCriteria) => void;
  /** Photo d'une voiture de la flotte pour la bande vitrine. */
  showcaseImage?: string;
}

export const Welcome: React.FC<WelcomeProps> = ({ lang, websiteSettings, agencies, onStartRenting, onReserve, onSearch, showcaseImage }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: containerRef });
  const heroOpacity = useTransform(scrollYProgress, [0, 0.4], [1, 0]);
  const heroY = useTransform(scrollYProgress, [0, 0.4], [0, -80]);

  const hasBg = !!websiteSettings?.landing_background;

  /** Nom d'enseigne affiché dans le titre « Pourquoi choisir … ? ». */
  const brand = shortName(websiteSettings?.name || 'Car Salam');

  /** Section « Confiance & confort » — cartes à coche. */
  const trustPoints = [
    {
      icon: CarIcon,
      title: { fr: 'Voitures modernes', ar: 'سيارات حديثة' },
      desc:  { fr: 'Une flotte récente, propre et régulièrement entretenue.', ar: 'أسطول حديث ونظيف تتم صيانته بانتظام.' },
    },
    {
      icon: ShieldCheck,
      title: { fr: 'Assurance complète', ar: 'تأمين شامل' },
      desc:  { fr: 'Chaque véhicule est assuré et couvert pendant toute la location.', ar: 'كل سيارة مؤمنة ومغطاة طوال مدة الإيجار.' },
    },
    {
      icon: Headphones,
      title: { fr: 'Service et assistance 24h/24', ar: 'خدمة ومساعدة على مدار الساعة' },
      desc:  { fr: 'Une équipe joignable à toute heure, où que vous soyez.', ar: 'فريق متاح في أي وقت وأينما كنت.' },
    },
    {
      icon: Receipt,
      title: { fr: 'Prix clairs et pas de frais cachés', ar: 'أسعار واضحة بدون رسوم خفية' },
      desc:  { fr: 'Le tarif annoncé est le tarif payé, caution comprise.', ar: 'السعر المعلن هو السعر المدفوع، شاملاً الكفالة.' },
    },
  ];

  /** Section « Pourquoi choisir … ? » — icônes animées. */
  const whyUs = [
    { icon: Gem,       title: { fr: 'Voitures de luxe', ar: 'سيارات فاخرة' } },
    { icon: Wallet,    title: { fr: 'Meilleurs prix', ar: 'أفضل الأسعار' } },
    { icon: Zap,       title: { fr: 'Réservation rapide', ar: 'حجز سريع' } },
    { icon: Headset,   title: { fr: 'Service client professionnel', ar: 'خدمة عملاء احترافية' } },
    { icon: MapPin,    title: { fr: "Disponible dans toute l'Algérie", ar: 'متوفر في جميع أنحاء الجزائر' } },
  ];

  return (
    <div ref={containerRef} className="relative overflow-hidden" style={{ background: C.bg }}>

      {/* ══ HERO SECTION ══ */}
      <section className="relative min-h-screen flex items-center">

        {/* Background image — subtle blur + cinematic dark overlay for readability */}
        {websiteSettings?.landing_background && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
            <motion.img
              src={websiteSettings.landing_background}
              alt=""
              className="w-full h-full object-cover"
              style={{ transform: 'scale(1.05)' }}
              animate={{ scale: [1.05, 1.10, 1.05] }}
              transition={{ duration: 25, repeat: Infinity, ease: 'easeInOut' }}
              referrerPolicy="no-referrer"
            />
            {/* Multi-layer overlay: dark bottom for readability, lighter top to show image */}
            <div className="absolute inset-0" style={{
              background: `linear-gradient(180deg,
                rgba(15,23,42,0.3) 0%,
                rgba(15,23,42,0.2) 30%,
                rgba(15,23,42,0.35) 60%,
                rgba(15,23,42,0.7) 100%)`,
            }} />
            {/* Left-side text protection gradient */}
            <div className="absolute inset-0" style={{
              background: 'linear-gradient(90deg, rgba(15,23,42,0.5) 0%, rgba(15,23,42,0.1) 55%, transparent 100%)',
            }} />
          </div>
        )}

        {/* Fine diagonal grid */}
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: `linear-gradient(${C.accent} 1px, transparent 1px), linear-gradient(90deg, ${C.accent} 1px, transparent 1px)`,
          backgroundSize: '70px 70px',
        }} />

        {/* Cyan top glow */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: `radial-gradient(ellipse 75% 55% at 60% -10%, ${C.accentDim}, transparent)`,
        }} />

        {/* Violet bottom-left blob */}
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] pointer-events-none" style={{
          background: `radial-gradient(circle, ${C.amberDim}, transparent 70%)`,
          transform: 'translate(-30%, 30%)',
        }} />

        {/* Horizontal accent line */}
        <div className="absolute top-[48%] left-0 right-0 h-px pointer-events-none" style={{
          background: `linear-gradient(90deg, transparent, ${C.accent}22, ${C.amber}33, transparent)`,
        }} />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center pt-28 pb-10">

            {/* LEFT: Text */}
            <motion.div style={{ opacity: heroOpacity, y: heroY }} className="space-y-8">

              {/* Badge pill */}
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6 }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full border transition-all duration-300"
                style={{
                  borderColor: hasBg ? 'rgba(255, 255, 255, 0.25)' : `${C.accent}40`,
                  background: hasBg ? 'rgba(255, 255, 255, 0.12)' : `${C.accent}10`,
                  backdropFilter: hasBg ? 'blur(8px)' : 'none',
                }}
              >
                <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: hasBg ? '#FFFFFF' : C.accent }} />
                <span className="text-xs font-bold tracking-[0.2em] uppercase"
                  style={{ color: hasBg ? '#FFFFFF' : C.accent, fontFamily: 'var(--font-display)' }}>
                  {{ fr: 'Location Premium · Algérie', ar: 'تأجير فاخر · الجزائر' }[lang]}
                </span>
              </motion.div>

              {/* Agency name */}
              <motion.p
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="text-sm font-bold tracking-[0.3em] uppercase"
                style={{ color: hasBg ? '#FBBF24' : C.amber, fontFamily: 'var(--font-display)' }}
              >
                {shortName(websiteSettings?.name)}
              </motion.p>

              {/* Main headline */}
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.85, delay: 0.2 }}
              >
                <h1 className="font-black leading-[1.05]" style={{ fontFamily: 'var(--font-display)' }}>
                  <span className={`block text-4xl sm:text-5xl xl:text-6xl mb-1 ${hasBg ? 'text-white' : 'text-vel-ink'}`}>
                    {{ fr: 'Louez votre voiture', ar: 'استأجر سيارتك' }[lang]}
                  </span>
                  <span className="block text-4xl sm:text-5xl xl:text-6xl" style={{ color: C.accent }}>
                    {{ fr: 'en toute confiance et confort.', ar: 'بكل ثقة وراحة.' }[lang]}
                  </span>
                </h1>
              </motion.div>

              {/* Description */}
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.38 }}
                className={`text-base leading-relaxed max-w-md ${hasBg ? 'text-slate-200' : 'text-vel-slate'}`}
              >
                {websiteSettings?.description || (lang === 'fr'
                  ? "Des véhicules d'exception pour des expériences inoubliables. Réservez en quelques clics."
                  : 'مركبات استثنائية لتجارب لا تُنسى. احجز بنقرات قليلة.'
                )}
              </motion.p>

              {/* CTA — un seul bouton : voir les voitures disponibles (la réservation
                  démarre après avoir choisi une voiture, plus de réservation directe). */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.5 }}
                className="flex flex-wrap gap-4"
              >
                <motion.button
                  onClick={onStartRenting}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  className="btn-vel-cta px-8 py-4 text-sm"
                >
                  {{ fr: 'Voir les voitures disponibles', ar: 'عرض السيارات المتاحة' }[lang]}
                  <ArrowRight size={17} />
                </motion.button>
              </motion.div>

            </motion.div>

            {/* RIGHT: 3D (Spline) avec repli sur le visuel CSS statique */}
            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1.1, delay: 0.25, ease: 'easeOut' }}
              className="relative"
            >
              {/* Glow halo */}
              <div className="absolute inset-0 pointer-events-none rounded-full" style={{
                background: `radial-gradient(ellipse at center, ${C.accentDim}, transparent 68%)`,
              }} />
              <Hero3D
                sceneUrl={HERO_SPLINE_SCENE_URL}
                fallback={<HeroVisual />}
              />
            </motion.div>
          </div>

          {/* ── Recherche de disponibilité : agences + période → étape suivante ── */}
          <div className="pb-24">
            <BookingSearchPanel lang={lang} agencies={agencies} onSearch={onSearch} hasBg={hasBg} />
          </div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
          style={{ color: C.accent }}
        >
          <span className="text-xs tracking-widest uppercase opacity-60" style={{ fontFamily: 'var(--font-display)' }}>
            {{ fr: 'Défiler', ar: 'مرر' }[lang]}
          </span>
          <ChevronDown size={18} />
        </motion.div>
      </section>

      {/* ══ CONFIANCE & CONFORT — cartes à coche ══ */}
      <section className="relative py-24 px-4 sm:px-6 lg:px-8" style={{
        background: '#FFFFFF',
        borderTop: '1px solid rgba(15,23,42,0.06)',
        borderBottom: '1px solid rgba(15,23,42,0.06)',
      }}>
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="text-center mb-16"
          >
            <p className="font-bold text-xs tracking-[0.25em] uppercase mb-4"
              style={{ color: C.accent, fontFamily: 'var(--font-display)' }}>
              {{ fr: 'Confiance & confort', ar: 'ثقة وراحة' }[lang]}
            </p>
            <h2 className="font-black text-3xl sm:text-4xl text-vel-ink max-w-3xl mx-auto leading-tight"
              style={{ fontFamily: 'var(--font-display)' }}>
              {{ fr: 'Louez votre voiture en toute confiance et confort.',
                 ar: 'استأجر سيارتك بكل ثقة وراحة.' }[lang]}
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {trustPoints.map((p, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: i * 0.12 }}
                whileHover={{ y: -6 }}
                className="relative overflow-hidden rounded-2xl p-7 flex flex-col gap-4 transition-all duration-300 cursor-default"
                style={{
                  background: 'rgba(180,83,9,0.04)',
                  border: '1px solid rgba(180,83,9,0.09)',
                  backdropFilter: 'blur(12px)',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = `${C.accent}35`;
                  (e.currentTarget as HTMLElement).style.boxShadow = `0 0 30px ${C.accent}12`;
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'rgba(180,83,9,0.09)';
                  (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                }}
              >
                {/* Filet or en tête de carte */}
                <span aria-hidden="true" className="absolute inset-x-0 top-0 h-px"
                  style={{ background: `linear-gradient(90deg, transparent, ${C.gold}, transparent)` }} />

                <div className="flex items-start justify-between gap-3">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: `${C.accent}14`, border: `1px solid ${C.accent}35` }}>
                    <p.icon size={22} style={{ color: C.accent }} />
                  </div>
                  {/* Coche ✔ */}
                  <span className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: `linear-gradient(135deg, ${C.gold}, ${C.accent})` }}>
                    <Check size={15} strokeWidth={3} color={C.black} />
                  </span>
                </div>

                <h3 className="font-bold text-lg text-vel-ink leading-snug" style={{ fontFamily: 'var(--font-display)' }}>
                  {p.title[lang]}
                </h3>
                <p className="text-vel-muted text-sm leading-relaxed">{p.desc[lang]}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ POURQUOI CHOISIR <ENSEIGNE> ? — icônes animées ══ */}
      <section className="relative py-24 px-4 sm:px-6 lg:px-8 overflow-hidden" style={{ background: C.bg }}>
        <div className="absolute inset-0 pointer-events-none" style={{
          background: `radial-gradient(ellipse 60% 50% at 50% 0%, ${C.accentDim}, transparent)`,
        }} />

        <div className="max-w-7xl mx-auto relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="text-center mb-16"
          >
            <p className="font-bold text-xs tracking-[0.25em] uppercase mb-4"
              style={{ color: C.accent, fontFamily: 'var(--font-display)' }}>
              {{ fr: 'Nos atouts', ar: 'مزايانا' }[lang]}
            </p>
            <h2 className="font-black text-3xl sm:text-4xl text-vel-ink" style={{ fontFamily: 'var(--font-display)' }}>
              {lang === 'fr' ? `Pourquoi choisir ${brand} ?` : `لماذا تختار ${brand}؟`}
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
            {whyUs.map((w, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.55, delay: i * 0.1 }}
                whileHover="hover"
                className="group relative rounded-2xl p-6 text-center flex flex-col items-center gap-4 cursor-default"
                style={{ background: C.surface, border: '1px solid rgba(15,23,42,0.06)' }}
                variants={{ hover: { y: -8, boxShadow: `0 18px 40px rgba(180,83,9,0.14)` } }}
              >
                <div className="relative">
                  {/* Halo pulsé derrière l'icône */}
                  <motion.span
                    aria-hidden="true"
                    className="absolute inset-0 rounded-2xl"
                    style={{ background: C.accentDim }}
                    animate={{ scale: [1, 1.25, 1], opacity: [0.5, 0.15, 0.5] }}
                    transition={{ duration: 3, repeat: Infinity, delay: i * 0.3 }}
                  />
                  <motion.div
                    className="relative w-14 h-14 rounded-2xl flex items-center justify-center"
                    style={{
                      background: `linear-gradient(135deg, ${C.gold}22, ${C.accent}18)`,
                      border: `1px solid ${C.accent}35`,
                    }}
                    variants={{ hover: { scale: 1.12, rotate: -6 } }}
                    transition={{ type: 'spring', stiffness: 320, damping: 16 }}
                  >
                    <w.icon size={24} style={{ color: C.accent }} />
                  </motion.div>
                </div>

                <h3 className="font-bold text-base text-vel-ink leading-snug" style={{ fontFamily: 'var(--font-display)' }}>
                  {w.title[lang]}
                </h3>

                {/* Soulignement or au survol */}
                <motion.span
                  aria-hidden="true"
                  className="h-0.5 rounded-full"
                  style={{ background: `linear-gradient(90deg, ${C.gold}, ${C.accent})` }}
                  initial={{ width: 0 }}
                  variants={{ hover: { width: 40 } }}
                  transition={{ duration: 0.25 }}
                />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ SHOWCASE BAND (voiture en arrière-plan + titre) ══ */}
      <ShowcaseBand lang={lang} onReserve={onStartRenting} imageUrl={showcaseImage} />

      {/* ══ CTA BANNER ══ */}
      <section className="relative py-24 px-4 sm:px-6 lg:px-8 overflow-hidden" style={{ background: C.bg }}>
        <div className="absolute inset-0 pointer-events-none" style={{
          background: `radial-gradient(ellipse at center, ${C.accentDim}, transparent 65%)`,
        }} />

        <div className="absolute top-1/2 left-0 right-0 flex items-center justify-center gap-4 pointer-events-none">
          <div className="h-px flex-1" style={{ background: `linear-gradient(to right, transparent, ${C.accent}22)` }} />
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: C.accent }} />
          <div className="h-px flex-1" style={{ background: `linear-gradient(to left, transparent, ${C.accent}22)` }} />
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="max-w-4xl mx-auto text-center relative z-10"
        >
          <h2 className="font-black text-5xl text-vel-ink mb-6" style={{ fontFamily: 'var(--font-display)' }}>
            {{ fr: 'Prêt à prendre la route ?', ar: 'مستعد للانطلاق؟' }[lang]}
          </h2>
          <p className="text-vel-slate text-lg mb-10">
            {{ fr: "Réservez votre véhicule dès aujourd'hui et vivez l'expérience.", ar: 'احجز سيارتك اليوم وعش التجربة.' }[lang]}
          </p>
          <motion.button
            onClick={onStartRenting}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="inline-flex items-center gap-2 text-lg px-12 py-5 rounded-xl font-bold transition-all duration-300"
            style={{
              fontFamily: 'var(--font-display)',
              background: `linear-gradient(135deg, ${C.gold}, ${C.accent})`,
              color: C.black,
              boxShadow: `0 6px 18px rgba(180,83,9,0.28)`,
            }}
          >
            <CarIcon size={20} /> {{ fr: 'Voir tous les véhicules', ar: 'عرض جميع السيارات' }[lang]}
          </motion.button>
        </motion.div>
      </section>
    </div>
  );
};
