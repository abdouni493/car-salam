import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Search, X, Handshake, Check, CarFront } from 'lucide-react';
import { Car, Language } from '../../types';

/**
 * Sélecteur de véhicule de la page « Bénéfices par véhicule ».
 *
 * Une liste déroulante ne suffisait plus : avec une flotte fournie, retrouver
 * une voiture demandait de connaître l'ordre d'affichage. Ici on cherche par
 * marque, modèle, couleur, année ou immatriculation, on filtre par régime
 * (conciergerie / agence), et on choisit sur une vignette qui montre la photo
 * du véhicule — on voit ce qu'on sélectionne.
 */

type Regime = 'all' | 'consignment' | 'personal';

const T = (fr: string, ar: string, lang: Language) => (lang === 'fr' ? fr : ar);

const FALLBACK_IMAGE = 'https://picsum.photos/seed/car/400/300';

/** Texte cherchable d'un véhicule — tout ce qu'un agent peut taper de tête. */
const haystack = (car: Car): string =>
  [car.brand, car.model, car.color, car.registration, car.year, car.energy, car.transmission,
   car.ownerInfo?.ownerName, car.ownerInfo?.internalRef]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

interface CarSelectorProps {
  cars: Car[];
  selectedCarId: string;
  onSelect: (carId: string) => void;
  lang: Language;
}

export const CarSelector: React.FC<CarSelectorProps> = ({ cars, selectedCarId, onSelect, lang }) => {
  const [query, setQuery] = useState('');
  const [regime, setRegime] = useState<Regime>('all');

  const counts = useMemo(() => ({
    all: cars.length,
    consignment: cars.filter(c => c.ownershipType === 'consignment').length,
    personal: cars.filter(c => c.ownershipType !== 'consignment').length,
  }), [cars]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const terms = q.split(/\s+/).filter(Boolean);
    return cars.filter(car => {
      if (regime === 'consignment' && car.ownershipType !== 'consignment') return false;
      if (regime === 'personal' && car.ownershipType === 'consignment') return false;
      if (terms.length === 0) return true;
      const h = haystack(car);
      // Tous les mots doivent correspondre : « clio blanche » ne ramène pas
      // toutes les Clio ni toutes les voitures blanches.
      return terms.every(t => h.includes(t));
    });
  }, [cars, query, regime]);

  const chips: { key: Regime; label: string; count: number }[] = [
    { key: 'all', label: T('Tous', 'الكل', lang), count: counts.all },
    { key: 'consignment', label: T('🤝 Conciergerie', '🤝 وكالة', lang), count: counts.consignment },
    { key: 'personal', label: T('🚗 Véhicules agence', '🚗 مركبات الوكالة', lang), count: counts.personal },
  ];

  return (
    <div className="space-y-4">
      {/* Recherche + filtres de régime */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-teal-600/70"
          />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={T(
              'Rechercher : marque, modèle, couleur, année, immatriculation…',
              'ابحث: العلامة، الموديل، اللون، السنة، رقم التسجيل…',
              lang,
            )}
            className="w-full rounded-xl border border-teal-200 bg-white py-3 ps-10 pe-10 text-sm font-medium text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-teal-400 focus:ring-2 focus:ring-teal-200"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute end-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              aria-label={T('Effacer', 'مسح', lang)}
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {chips.map(chip => (
            <button
              key={chip.key}
              type="button"
              onClick={() => setRegime(chip.key)}
              className={`rounded-lg px-3 py-2 text-xs font-bold transition ${
                regime === chip.key
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
              }`}
            >
              {chip.label}
              <span className={`ms-1.5 tabular-nums ${regime === chip.key ? 'text-teal-100' : 'text-slate-400'}`}>
                {chip.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Vignettes */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-white/60 py-10 text-center">
          <CarFront size={26} className="text-slate-300" />
          <p className="text-sm font-semibold text-slate-500">
            {T('Aucun véhicule ne correspond', 'لا توجد مركبة مطابقة', lang)}
          </p>
          <p className="text-xs text-slate-400">
            {T('Essayez une marque, un modèle, une couleur ou une plaque.', 'جرّب علامة أو موديلًا أو لونًا أو رقم تسجيل.', lang)}
          </p>
        </div>
      ) : (
        <div className="grid max-h-[27rem] grid-cols-1 gap-3 overflow-y-auto pe-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map(car => {
            const selected = car.id === selectedCarId;
            const consignment = car.ownershipType === 'consignment';
            return (
              <motion.button
                key={car.id}
                type="button"
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => onSelect(car.id)}
                className={`group relative overflow-hidden rounded-2xl bg-white text-start shadow-sm transition ring-1 ${
                  selected
                    ? 'ring-2 ring-teal-500 shadow-md'
                    : 'ring-slate-200 hover:ring-teal-300'
                }`}
              >
                <div className="relative h-28 w-full overflow-hidden bg-slate-100">
                  <img
                    src={car.images?.[0] || FALLBACK_IMAGE}
                    alt={`${car.brand} ${car.model}`}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/70 via-slate-900/10 to-transparent" />

                  <span
                    className={`absolute start-2 top-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold backdrop-blur-sm ${
                      consignment
                        ? 'bg-amber-400/90 text-amber-950'
                        : 'bg-white/85 text-slate-700'
                    }`}
                  >
                    {consignment ? <Handshake size={10} /> : <CarFront size={10} />}
                    {consignment ? T('Conciergerie', 'وكالة', lang) : T('Agence', 'الوكالة', lang)}
                  </span>

                  {selected && (
                    <span className="absolute end-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-teal-500 text-white shadow">
                      <Check size={13} strokeWidth={3} />
                    </span>
                  )}

                  <span
                    className="absolute bottom-2 start-2 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-black tracking-[0.1em] text-white backdrop-blur-sm"
                    dir="ltr"
                  >
                    {car.registration}
                  </span>
                </div>

                <div className="p-3">
                  <p className="truncate text-sm font-extrabold text-slate-900">
                    {car.brand} {car.model}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] font-medium text-slate-500">
                    {[car.year, car.color, car.energy].filter(Boolean).join(' · ')}
                  </p>
                  {consignment && car.ownerInfo?.ownerName && (
                    <p className="mt-1.5 truncate text-[11px] font-semibold text-amber-700">
                      {car.ownerInfo.ownerName}
                      {car.ownerInfo.internalRef && (
                        <span className="ms-1 rounded bg-amber-100 px-1 py-0.5 text-[9px] font-bold" dir="ltr">
                          {car.ownerInfo.internalRef}
                        </span>
                      )}
                    </p>
                  )}
                </div>
              </motion.button>
            );
          })}
        </div>
      )}
    </div>
  );
};
