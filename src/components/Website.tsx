import React, { useState, useEffect } from 'react';
import { Language, Car, Agency } from '../types';
import { motion, AnimatePresence, useScroll, useSpring, useMotionValueEvent, useReducedMotion } from 'motion/react';
import { Menu, X } from 'lucide-react';
import { Welcome } from './website/Welcome';
import { OffersListing } from './website/OffersListing';
import { SpecialOffersListing } from './website/SpecialOffersListing';
import { ContactsWebsite } from './website/ContactsWebsite';
import { ReservationWizard } from './website/wizard/ReservationWizard';
import { WizardSearchCriteria } from './website/wizard/WizardContext';
import { SiteLogo } from './website/SiteLogo';

interface WebsiteProps {
  lang: Language;
  onLangChange?: (lang: Language) => void;
  /** Voitures visibles sur le site (les masquées sont déjà filtrées par App). */
  cars: Car[];
  agencies: Agency[];
  isLoadingAgencies?: boolean;
  specialOffers: any[];
  contactInfo: any;
  websiteSettings: any;
}

export const Website: React.FC<WebsiteProps> = ({
  lang,
  onLangChange,
  cars,
  agencies,
  isLoadingAgencies = false,
  specialOffers,
  contactInfo,
  websiteSettings,
}) => {
  const [currentPage, setCurrentPage] = useState<'home' | 'offers' | 'special' | 'contacts' | 'orders'>('home');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [selectedCar, setSelectedCar] = useState<Car | null>(null);
  // Recherche de disponibilité lancée depuis le landing (agences + période)
  const [searchCriteria, setSearchCriteria] = useState<WizardSearchCriteria | null>(null);

  const reduceMotion = useReducedMotion();

  // Navbar réactive au scroll : transparente sur le hero, opaque dès qu'on
  // défile (le logo doit rester lisible une fois la page sous la barre).
  const [isScrolled, setIsScrolled] = useState(false);
  const { scrollY, scrollYProgress } = useScroll();
  useMotionValueEvent(scrollY, 'change', v => setIsScrolled(v > 24));
  const progress = useSpring(scrollYProgress, { stiffness: 260, damping: 26, restDelta: 0.001 });

  // Changer de page remet en haut : sans ça, on arrivait sur « Offres » au
  // milieu de la grille, à la hauteur où on avait quitté la page précédente.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  }, [currentPage, reduceMotion]);

  // Limit displayed agency name to first 3 words
  const shortName = (name: string | undefined) =>
    name ? name.split(/\s+/).slice(0, 3).join(' ') : 'Car Salam';

  // Logo affiché sur le site public : celui dédié à la navbar s'il existe,
  // sinon le logo principal (les agences qui n'en ont téléversé qu'un seul
  // gardent exactement le rendu qu'elles avaient).
  const siteLogo = websiteSettings?.navbar_logo || websiteSettings?.logo;

  const handleReserveClick = (car: Car) => {
    setSelectedCar(car);
    setSearchCriteria(null);
    setCurrentPage('orders');
  };

  // Landing → wizard pré-rempli avec agences + dates, voitures filtrées par dispo
  const handleAvailabilitySearch = (criteria: WizardSearchCriteria) => {
    setSelectedCar(null);
    setSearchCriteria(criteria);
    setCurrentPage('orders');
  };

  const navItems = [
    { id: 'home', label: { fr: 'Accueil', ar: 'الرئيسية' } },
    { id: 'offers', label: { fr: 'Offres', ar: 'العروض' } },
    { id: 'special', label: { fr: 'Spéciales', ar: 'خاصة' } },
    { id: 'orders', label: { fr: 'Commander', ar: 'طلب' } },
    { id: 'contacts', label: { fr: 'Contacts', ar: 'جهات الاتصال' } },
  ];

  return (
    <div className="min-h-screen bg-vel-void" style={{ fontFamily: 'var(--font-sans)' }}>
      {/* ── NAVBAR ── */}
      <motion.nav
        className="sticky top-0 z-50"
        animate={{
          backgroundColor: isScrolled ? 'rgba(8, 8, 10, 0.88)' : 'rgba(8, 8, 10, 0.35)',
          borderBottomColor: isScrolled ? 'rgba(255, 255, 255, 0.09)' : 'rgba(255, 255, 255, 0)',
          boxShadow: isScrolled ? '0 10px 30px rgba(0, 0, 0, 0.5)' : '0 0 0 rgba(0, 0, 0, 0)',
        }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        style={{ borderBottomWidth: 1, borderBottomStyle: 'solid', backdropFilter: 'blur(16px)' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* La barre se resserre au scroll : le logo reste lisible, la page respire */}
          <motion.div
            className="flex justify-between items-center"
            animate={{ height: isScrolled ? 68 : 84 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Logo — wordmark large, rendu par SiteLogo (jamais rogné) */}
            <motion.button
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setCurrentPage('home')}
              className="flex items-center cursor-pointer rounded-lg vel-focusable"
              aria-label={{ fr: "Retour à l'accueil", ar: 'العودة إلى الصفحة الرئيسية' }[lang]}
            >
              <SiteLogo
                logo={siteLogo}
                name={websiteSettings?.name}
                lang={lang}
                height={isScrolled ? 40 : 48}
              />
            </motion.button>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-1">
              {navItems.map((item, i) => (
                <motion.button
                  key={item.id}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  onClick={() => setCurrentPage(item.id as any)}
                  aria-current={currentPage === item.id ? 'page' : undefined}
                  className={`relative px-5 py-2.5 font-bold text-xs tracking-[0.15em] uppercase rounded-lg cursor-pointer vel-focusable transition-colors duration-200 ${
                    currentPage === item.id ? 'text-vel-ink' : 'text-vel-muted hover:text-vel-ink'
                  }`}
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {/* Pastille partagée : elle GLISSE d'un onglet à l'autre (continuité
                      spatiale) au lieu de disparaître/réapparaître. */}
                  {currentPage === item.id && (
                    <motion.span
                      layoutId="nav-pill"
                      className="absolute inset-0 rounded-lg"
                      style={{
                        background: 'rgba(200, 16, 46, 0.16)',
                        border: '1px solid var(--color-vel-border-red)',
                      }}
                      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                    />
                  )}
                  <span className="relative z-10">{item.label[lang]}</span>
                  {currentPage === item.id && (
                    <motion.span
                      layoutId="nav-underline"
                      className="absolute -bottom-px left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full"
                      style={{
                        background: 'var(--color-vel-cta)',
                        boxShadow: '0 0 10px rgba(200, 16, 46, 0.7)',
                      }}
                      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                    />
                  )}
                </motion.button>
              ))}
            </div>

            {/* Right side */}
            <div className="flex items-center gap-3">
              {onLangChange && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => onLangChange(lang === 'fr' ? 'ar' : 'fr')}
                  className="px-3 py-2 rounded-lg text-xs font-bold cursor-pointer vel-focusable transition-colors duration-200 text-vel-cta-bright"
                  style={{
                    fontFamily: 'var(--font-display)',
                    border: '1px solid var(--color-vel-border-red)',
                    background: 'rgba(200, 16, 46, 0.08)',
                  }}
                  aria-label={lang === 'fr' ? 'التبديل إلى العربية' : 'Passer en français'}
                >
                  {lang === 'fr' ? 'عربي' : 'FR'}
                </motion.button>
              )}
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden p-2.5 rounded-lg text-vel-slate hover:text-vel-cta-bright cursor-pointer vel-focusable transition-colors"
                aria-expanded={isMobileMenuOpen}
                aria-label={{ fr: 'Menu', ar: 'القائمة' }[lang]}
                style={{ background: isMobileMenuOpen ? 'rgba(255, 255, 255, 0.06)' : 'transparent' }}
              >
                {isMobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
              </motion.button>
            </div>
          </motion.div>

          {/* Mobile Menu */}
          <AnimatePresence>
            {isMobileMenuOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                className="md:hidden overflow-hidden border-t border-vel-border"
              >
                <div className="py-2">
                  {navItems.map((item, i) => (
                    <motion.button
                      key={item.id}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05, duration: 0.25 }}
                      onClick={() => { setCurrentPage(item.id as any); setIsMobileMenuOpen(false); }}
                      aria-current={currentPage === item.id ? 'page' : undefined}
                      className={`w-full text-left px-4 py-3.5 rounded-lg font-bold text-xs tracking-[0.15em] uppercase cursor-pointer transition-colors ${
                        currentPage === item.id
                          ? 'text-vel-cta-bright bg-vel-cta/15'
                          : 'text-vel-muted hover:text-vel-ink'
                      }`}
                      style={{ fontFamily: 'var(--font-display)' }}
                    >
                      {item.label[lang]}
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Progression de lecture — le seul filet rouge permanent de la page */}
        <motion.div
          className="absolute bottom-0 left-0 right-0 h-0.5 origin-left"
          style={{
            scaleX: progress,
            background: 'linear-gradient(90deg, var(--color-vel-cta-deep), var(--color-vel-cta), var(--color-vel-cta-bright))',
          }}
          aria-hidden="true"
        />
      </motion.nav>

      {/* Page Content —
          `mode="wait"` : l'ancienne page sort avant que la nouvelle entre.
          Sans AnimatePresence autour, le prop `exit` ne se déclenche jamais et
          les pages se remplaçaient d'un coup sec. */}
      <AnimatePresence mode="wait">
      <motion.div
        key={currentPage}
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        // La sortie est plus courte que l'entrée (≈65 %) : l'interface répond vite.
        exit={{
          opacity: 0,
          ...(reduceMotion ? {} : { y: -12 }),
          transition: { duration: reduceMotion ? 0 : 0.18, ease: [0.4, 0, 1, 1] },
        }}
        transition={{ duration: reduceMotion ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}
      >
        {currentPage === 'home' && (
          <Welcome
            lang={lang}
            websiteSettings={websiteSettings}
            agencies={agencies}
            onStartRenting={() => setCurrentPage('offers')}
            onReserve={() => { setSelectedCar(null); setCurrentPage('orders'); }}
            onSearch={handleAvailabilitySearch}
            showcaseImage={cars[0]?.images?.[0]}
          />
        )}
        {currentPage === 'offers' && (
          <OffersListing lang={lang} cars={cars} specialOffers={specialOffers} onOrder={handleReserveClick} />
        )}
        {currentPage === 'special' && (
          <SpecialOffersListing lang={lang} specialOffers={specialOffers} onOrder={handleReserveClick} />
        )}
        {currentPage === 'orders' && (
          <ReservationWizard
            // Nouvelle recherche / nouvelle voiture = wizard réinitialisé
            key={searchCriteria
              ? `search-${searchCriteria.from}-${searchCriteria.to}-${searchCriteria.departureAgencyId}-${searchCriteria.returnAgencyId || ''}`
              : selectedCar ? `car-${selectedCar.id}` : 'default'}
            lang={lang}
            cars={cars}
            specialOffers={specialOffers}
            agencies={agencies}
            isLoadingAgencies={isLoadingAgencies}
            selectedCar={selectedCar}
            initialSearch={searchCriteria}
            websiteSettings={websiteSettings}
            onBackHome={() => { setSelectedCar(null); setSearchCriteria(null); setCurrentPage('home'); }}
          />
        )}
        {currentPage === 'contacts' && (
          <ContactsWebsite lang={lang} contactInfo={contactInfo} websiteSettings={websiteSettings} />
        )}
      </motion.div>
      </AnimatePresence>

      {/* ── FOOTER ── */}
      <footer style={{ background: 'var(--color-vel-abyss)', borderTop: '1px solid var(--color-vel-border)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
            {/* Brand — le logo téléversé, pas seulement le nom */}
            <div>
              <div className="mb-4">
                <SiteLogo logo={siteLogo} name={websiteSettings?.name} lang={lang} height={52} />
              </div>
              <div className="w-12 h-0.5 mb-4" style={{ background: 'var(--color-vel-cta)', boxShadow: '0 0 10px rgba(200, 16, 46, 0.5)' }} />
              <p className="text-vel-muted text-sm leading-relaxed">{websiteSettings?.description}</p>
            </div>

            {/* Nav links */}
            <div>
              <h4 className="font-bold text-xs tracking-[0.2em] uppercase mb-5" style={{ color: 'var(--color-vel-cta-bright)', fontFamily: 'var(--font-display)' }}>
                {{ fr: 'Navigation', ar: 'الملاحة' }[lang]}
              </h4>
              <ul className="space-y-3">
                {navItems.map(item => (
                  <li key={item.id}>
                    <button
                      onClick={() => setCurrentPage(item.id as any)}
                      className="text-vel-muted text-sm transition-colors font-medium"
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--color-vel-cta)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = ''; }}
                    >
                      {item.label[lang]}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h4 className="font-bold text-xs tracking-[0.2em] uppercase mb-5" style={{ color: 'var(--color-vel-cta-bright)', fontFamily: 'var(--font-display)' }}>
                {{ fr: 'Contact', ar: 'اتصل' }[lang]}
              </h4>
              <ul className="space-y-3 text-vel-muted text-sm">
                {contactInfo?.phone && (
                  <li className="flex items-center gap-2">
                    <span style={{ color: 'var(--color-vel-cta-bright)' }}>→</span> {contactInfo.phone}
                  </li>
                )}
                {contactInfo?.email && (
                  <li className="flex items-center gap-2">
                    <span style={{ color: 'var(--color-vel-cta-bright)' }}>→</span> {contactInfo.email}
                  </li>
                )}
                {contactInfo?.address && (
                  <li className="flex items-center gap-2">
                    <span style={{ color: 'var(--color-vel-cta-bright)' }}>→</span> {contactInfo.address}
                  </li>
                )}
              </ul>
            </div>

            {/* Social */}
            <div>
              <h4 className="font-bold text-xs tracking-[0.2em] uppercase mb-5" style={{ color: 'var(--color-vel-cta-bright)', fontFamily: 'var(--font-display)' }}>
                {{ fr: 'Suivez-nous', ar: 'تابعنا' }[lang]}
              </h4>
              <div className="flex flex-wrap gap-3">
                {contactInfo?.facebook && (
                  <a href={contactInfo.facebook} target="_blank" rel="noopener noreferrer"
                    className="w-10 h-10 vel-glass rounded-lg flex items-center justify-center text-vel-muted transition-all text-sm font-bold"
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--color-vel-cta)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = ''; }}>
                    f
                  </a>
                )}
                {contactInfo?.instagram && (
                  <a href={`https://instagram.com/${contactInfo.instagram}`} target="_blank" rel="noopener noreferrer"
                    className="w-10 h-10 vel-glass rounded-lg flex items-center justify-center text-vel-muted hover:text-pink-600 transition-all text-sm font-bold">
                    ig
                  </a>
                )}
                {contactInfo?.tiktok && (
                  <a href={`https://tiktok.com/@${contactInfo.tiktok}`} target="_blank" rel="noopener noreferrer"
                    className="w-10 h-10 vel-glass rounded-lg flex items-center justify-center text-vel-muted hover:text-vel-ink transition-all text-xs font-bold">
                    tt
                  </a>
                )}
                {contactInfo?.whatsapp && (
                  <a href={`https://wa.me/${contactInfo.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                    className="w-10 h-10 vel-glass rounded-lg flex items-center justify-center text-vel-muted hover:text-green-600 transition-all text-xs font-bold">
                    wa
                  </a>
                )}
              </div>
            </div>
          </div>

          <div className="mt-12 pt-8 flex flex-col md:flex-row justify-between items-center gap-4"
            style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <p className="text-vel-dim text-sm">
              © {new Date().getFullYear()} {shortName(websiteSettings?.name)}.{' '}
              <span className="text-vel-muted">{{ fr: 'Tous droits réservés.', ar: 'جميع الحقوق محفوظة.' }[lang]}</span>
            </p>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--color-vel-cta)' }} />
              <span className="text-vel-dim text-xs tracking-wider" style={{ fontFamily: 'var(--font-display)' }}>
                POWERED BY AUTO LOCATION
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
