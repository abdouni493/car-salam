import React from 'react';
import { Language, Car, SpecialOffer } from '../../types';
import { motion, useReducedMotion } from 'motion/react';
import { Fuel, Settings, Users, DoorOpen, Gauge } from 'lucide-react';
import { getCurrentSpecialOfferForCar } from '../../utils/specialOffers';
import { carPricesEur, carEurRate, dzdToEur, formatMoney } from '../../utils/currency';

/**
 * Grille commune aux deux pages : 2 cartes par rangée sur téléphone (soit
 * 4 véhicules par écran), 3 sur tablette, 4 sur desktop. Les deux colonnes
 * partent de la plus petite largeur : sur un écran de 320 px, une seule colonne
 * ne montrait qu'une voiture à la fois.
 */
export const PUBLIC_CAR_GRID_CLASS =
  'grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-5';

interface PublicCarCardProps {
  lang: Language;
  car: Car;
  specialOffers: SpecialOffer[];
  /** Position dans la grille — pilote uniquement le délai d'apparition. */
  index?: number;
  /** Clic sur la carte : ouvre la fiche détaillée. */
  onOpenDetails: (car: Car) => void;
  /** Clic sur « Réserver » : démarre le wizard sur cette voiture. */
  onOrder: (car: Car) => void;
}

/**
 * Carte véhicule du site public — SOURCE UNIQUE du design.
 *
 * La page « Offres » et la section « Voitures disponibles » de l'accueil
 * affichent la même carte : même photo, mêmes puces de caractéristiques, même
 * bloc tarifaire (jour / semaine / mois / caution, dinar + contre-valeur euro)
 * et même bouton Réserver. Dupliquer ce balisage, c'était garantir que les deux
 * pages finiraient par diverger.
 *
 * Toute la carte est cliquable (→ détails) ; le bouton Réserver lance le wizard
 * avec la voiture présélectionnée (stopPropagation pour ne pas ouvrir les détails).
 */
export const PublicCarCard: React.FC<PublicCarCardProps> = ({
  lang, car, specialOffers, index = 0, onOpenDetails, onOrder,
}) => {
  const reduceMotion = useReducedMotion();

  const promo = getCurrentSpecialOfferForCar(car.id, specialOffers);
  // Tarifs euros de la fiche, ou conversion au taux implicite de l'agence.
  const eur = carPricesEur(car);
  const promoEur = promo ? dzdToEur(promo.newPrice, carEurRate(car)) : null;

  const specs = [
    { icon: Fuel, value: car.energy },
    { icon: Settings, value: car.transmission },
    { icon: Users, value: `${car.seats}` },
    { icon: DoorOpen, value: `${car.doors}` },
    { icon: Gauge, value: `${(car.mileage / 1000).toFixed(0)}k km` },
  ];

  return (
    <motion.div
      role="button"
      tabIndex={0}
      aria-label={lang === 'fr' ? `Voir les détails de ${car.brand} ${car.model}` : `عرض تفاصيل ${car.brand} ${car.model}`}
      onClick={() => onOpenDetails(car)}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpenDetails(car);
        }
      }}
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ delay: reduceMotion ? 0 : Math.min(index % 8, 6) * 0.05, duration: 0.45 }}
      whileHover={reduceMotion ? {} : { y: -4 }}
      className="vel-glass rounded-xl overflow-hidden group cursor-pointer transition-shadow duration-300 flex flex-col outline-none focus-visible:ring-2 focus-visible:ring-vel-gold"
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.borderColor = 'rgba(234, 88, 12, 0.25)';
        (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 30px rgba(234, 88, 12, 0.09)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.borderColor = 'rgba(15, 23, 42, 0.08)';
        (e.currentTarget as HTMLElement).style.boxShadow = 'none';
      }}
    >
      {/* Image compacte */}
      <div className="relative aspect-[4/3] overflow-hidden bg-vel-abyss">
        <img
          src={car.images?.[0] || 'https://picsum.photos/seed/car/400/300'}
          alt={`${car.brand} ${car.model}`}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(8,12,20,0.7), transparent 55%)' }} />
        <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md text-[10px] font-bold backdrop-blur-sm"
          style={{ color: 'var(--color-vel-cta-bright)', background: 'rgba(234, 88, 12, 0.1)', border: '1px solid rgba(234, 88, 12, 0.25)', fontFamily: 'var(--font-display)' }}>
          {car.year}
        </div>
        {promo && (
          <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md text-[10px] font-bold text-white shadow"
            style={{ background: 'var(--color-vel-cta)', fontFamily: 'var(--font-display)' }}>
            {promo.label || `-${Math.round((1 - promo.newPrice / promo.oldPrice) * 100)}%`}
          </div>
        )}
      </div>

      {/* Contenu compact */}
      <div className="p-3 flex flex-col gap-2.5 flex-1">
        {/* Nom */}
        <div className="min-w-0">
          <h3 className="font-black text-sm text-vel-ink truncate" style={{ fontFamily: 'var(--font-display)' }}>
            {car.brand} <span style={{ color: 'var(--color-vel-cta-bright)' }}>{car.model}</span>
          </h3>
          <p className="text-vel-muted text-[10px] truncate">{car.registration} · {car.color}</p>
        </div>

        {/* Description publique (jamais de données propriétaire ici) */}
        {car.description && (
          <p className="text-vel-muted text-[10px] leading-snug line-clamp-2">{car.description}</p>
        )}

        {/* Specs : tous les détails en micro-puces */}
        <div className="flex flex-wrap gap-1">
          {specs.map((s, i) => (
            <span key={i}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium text-vel-slate"
              style={{ background: 'rgba(15, 23, 42, 0.06)', border: '1px solid rgba(15, 23, 42, 0.07)' }}>
              <s.icon size={9} style={{ color: 'rgba(234, 88, 12, 0.55)' }} />
              {s.value}
            </span>
          ))}
        </div>

        {/* Tous les tarifs, en rangées compactes — dinar puis contre-valeur euro */}
        <div className="rounded-lg px-2.5 py-2 space-y-1 mt-auto"
          style={{ background: 'rgba(234, 88, 12, 0.05)', border: '1px solid rgba(234, 88, 12, 0.1)' }}>
          <div className="flex justify-between items-start gap-2 text-[10px]">
            <span className="text-vel-muted pt-px">{{ fr: 'Jour', ar: 'يوم' }[lang]}</span>
            <span className="text-right">
              {promo ? (
                <span className="font-black text-xs block" style={{ color: 'var(--color-vel-cta-bright)' }}>
                  <span className="line-through mr-1 font-medium" style={{ color: 'rgba(148,163,184,0.7)' }}>
                    {car.priceDay.toLocaleString()}
                  </span>
                  {promo.newPrice.toLocaleString()} DA
                </span>
              ) : (
                <span className="font-black text-xs block" style={{ color: 'var(--color-vel-cta-bright)' }}>{car.priceDay.toLocaleString()} DA</span>
              )}
              <span className="font-bold text-[9px] block text-vel-muted">
                {formatMoney(promoEur ?? eur.day, 'EUR')}
              </span>
            </span>
          </div>
          <div className="flex justify-between items-start gap-2 text-[10px]">
            <span className="text-vel-muted pt-px">{{ fr: 'Semaine', ar: 'أسبوع' }[lang]}</span>
            <span className="text-right">
              <span className="font-bold text-vel-slate block">{car.priceWeek.toLocaleString()} DA</span>
              <span className="font-bold text-[9px] block text-vel-muted">{formatMoney(eur.week, 'EUR')}</span>
            </span>
          </div>
          <div className="flex justify-between items-start gap-2 text-[10px]">
            <span className="text-vel-muted pt-px">{{ fr: 'Mois', ar: 'شهر' }[lang]}</span>
            <span className="text-right">
              <span className="font-bold text-vel-slate block">{car.priceMonth.toLocaleString()} DA</span>
              <span className="font-bold text-[9px] block text-vel-muted">{formatMoney(eur.month, 'EUR')}</span>
            </span>
          </div>
          <div className="flex justify-between items-start gap-2 text-[10px] pt-1" style={{ borderTop: '1px solid rgba(15, 23, 42, 0.06)' }}>
            <span className="text-vel-muted pt-px">{{ fr: 'Caution', ar: 'الكفالة' }[lang]}</span>
            <span className="text-right">
              <span className="font-bold block" style={{ color: 'var(--color-vel-cta-bright)' }}>{car.deposit.toLocaleString()} DA</span>
              <span className="font-bold text-[9px] block text-vel-muted">{formatMoney(eur.deposit, 'EUR')}</span>
            </span>
          </div>
        </div>

        {/* Réserver — stopPropagation pour ne pas ouvrir les détails */}
        <button
          onClick={e => {
            e.stopPropagation();
            onOrder(car);
          }}
          className="btn-vel-cta w-full py-2 text-xs"
        >
          {{ fr: 'Réserver', ar: 'احجز' }[lang]}
        </button>
      </div>
    </motion.div>
  );
};
