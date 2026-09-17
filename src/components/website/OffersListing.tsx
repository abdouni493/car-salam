import React, { useState } from 'react';
import { Language, Car, SpecialOffer } from '../../types';
import { motion, useReducedMotion } from 'motion/react';
import { CarDetailsModal } from './CarDetailsModal';
import { PublicCarCard, PUBLIC_CAR_GRID_CLASS } from './PublicCarCard';

interface OffersListingProps {
  lang: Language;
  /** Voitures visibles sur le site (les masquées sont déjà exclues en amont). */
  cars: Car[];
  specialOffers: SpecialOffer[];
  onOrder: (car: Car) => void;
}

/**
 * Grille publique dense : 4 cartes par rangée sur desktop, 2 sur téléphone.
 * La carte elle-même vit dans `PublicCarCard`, partagée avec la section
 * « Voitures disponibles » de l'accueil.
 */
export const OffersListing: React.FC<OffersListingProps> = ({ lang, cars, specialOffers, onOrder }) => {
  const [selectedCar, setSelectedCar] = useState<Car | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const reduceMotion = useReducedMotion();

  const openDetails = (car: Car) => {
    setSelectedCar(car);
    setShowDetails(true);
  };

  return (
    <div className="min-h-screen bg-vel-void py-20 px-3 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <motion.div
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="text-center mb-14"
        >
          <p className="font-bold text-xs tracking-[0.25em] uppercase mb-4"
            style={{ color: 'var(--color-vel-cta-bright)', fontFamily: 'var(--font-display)' }}>
            {{ fr: 'Nos Véhicules', ar: 'سياراتنا' }[lang]}
          </p>
          <h1 className="font-black text-5xl sm:text-6xl text-vel-ink" style={{ fontFamily: 'var(--font-display)' }}>
            {{ fr: 'La Flotte', ar: 'الأسطول' }[lang]}
          </h1>
          <p className="text-vel-muted text-lg mt-4 max-w-2xl mx-auto">
            {{ fr: 'Découvrez notre sélection de véhicules premium avec les meilleures offres', ar: 'اكتشف تشكيلتنا من السيارات الفاخرة مع أفضل العروض' }[lang]}
          </p>
        </motion.div>

        {/* Grille compacte : 2 (téléphone) / 3 (tablette) / 4 (desktop) */}
        <div className={PUBLIC_CAR_GRID_CLASS}>
          {cars.map((car, index) => (
            <PublicCarCard
              key={car.id}
              lang={lang}
              car={car}
              specialOffers={specialOffers}
              index={index}
              onOpenDetails={openDetails}
              onOrder={onOrder}
            />
          ))}
        </div>

        {cars.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-24"
          >
            <p className="text-vel-muted text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
              {{ fr: 'Aucun véhicule disponible actuellement', ar: 'لا توجد سيارات متاحة حالياً' }[lang]}
            </p>
          </motion.div>
        )}
      </div>

      {/* Détails : ouverts par un clic n'importe où sur la carte */}
      {showDetails && selectedCar && (
        <CarDetailsModal
          lang={lang}
          car={selectedCar}
          onClose={() => setShowDetails(false)}
          onOrder={onOrder}
        />
      )}
    </div>
  );
};
