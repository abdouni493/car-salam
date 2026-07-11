import React, { useRef } from 'react';
import { motion, useScroll, useTransform, useReducedMotion } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { Language } from '../../types';
import { SplineScene } from '../ui/splite';
import { HERO_SPLINE_SCENE_URL } from '../../constants';

interface ShowcaseBandProps {
  lang: Language;
  onReserve: () => void;
  /** Photo d'une voiture de la flotte réelle (arrière-plan si pas de scène 3D). */
  imageUrl?: string;
}

/** Canaux de --color-vel-void (#08080A) : le voile doit pouvoir varier en alpha. */
const VOID = '8, 8, 10';

/**
 * Bande vitrine pleine largeur : une voiture en arrière-plan — scène Spline 3D
 * si une URL est configurée, sinon photo avec effet parallaxe — derrière le
 * titre. Le décor reprend celui des autres sections du site (fond vel-void,
 * grille de piste, halo rouge, filets de bord) : le voile est SOMBRE, jamais
 * clair, sinon le texte vel-ink quasi blanc devient illisible.
 * La couche visuelle est décorative : pointer-events-none, aria-hidden,
 * parallaxe désactivée si prefers-reduced-motion.
 */
export const ShowcaseBand: React.FC<ShowcaseBandProps> = ({ lang, onReserve, imageUrl }) => {
  const sectionRef = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start end', 'end start'],
  });
  const parallaxY = useTransform(scrollYProgress, [0, 1], ['-12%', '12%']);

  const use3D = !!HERO_SPLINE_SCENE_URL && !reduceMotion;
  const hasVisual = use3D || !!imageUrl;

  return (
    <section
      ref={sectionRef}
      className="relative overflow-hidden py-28 px-4 sm:px-6 lg:px-8"
      style={{
        background: 'var(--color-vel-void)',
        borderTop: '1px solid var(--color-vel-border)',
        borderBottom: '1px solid var(--color-vel-border)',
      }}
    >
      {/* ── Couche visuelle d'arrière-plan (décorative, non interactive) ── */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        {use3D ? (
          <SplineScene scene={HERO_SPLINE_SCENE_URL} className="w-full h-full" />
        ) : imageUrl ? (
          // Photo d'une voiture de la flotte réelle, avec parallaxe douce
          <motion.img
            src={imageUrl}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            className="w-full h-[130%] object-cover -mt-[15%]"
            style={reduceMotion ? {} : { y: parallaxY }}
          />
        ) : null}

        {hasVisual && (
          <>
            {/* Voile cinématographique : la voiture émerge du noir à droite,
                le texte repose sur du vel-void quasi plein à gauche. */}
            <div className="absolute inset-0" style={{
              background: `linear-gradient(90deg,
                rgba(${VOID}, 0.97) 0%,
                rgba(${VOID}, 0.88) 34%,
                rgba(${VOID}, 0.45) 66%,
                rgba(${VOID}, 0.10) 100%)`,
            }} />
            {/* Fondu haut/bas : la bande se raccorde aux sections voisines. */}
            <div className="absolute inset-0" style={{
              background: `linear-gradient(180deg,
                var(--color-vel-void) 0%,
                rgba(${VOID}, 0) 28%,
                rgba(${VOID}, 0) 68%,
                var(--color-vel-void) 100%)`,
            }} />
          </>
        )}

        {/* Grille de piste — même décor que le hero et les autres sections. */}
        <div className="absolute inset-0 vel-grid-bg" />

        {/* Halo rouge diffus derrière le texte (seule grande surface colorée). */}
        <div className="absolute inset-0" style={{
          background: 'radial-gradient(ellipse 60% 70% at 12% 50%, rgba(200, 16, 46, 0.14), transparent 70%)',
        }} />

        {/* Filet rouge → chrome le long du bord haut (signature du hero). */}
        <div className="absolute top-0 left-0 right-0 h-px" style={{
          background: 'linear-gradient(90deg, transparent, rgba(200, 16, 46, 0.5), rgba(233, 235, 238, 0.25), transparent)',
        }} />
      </div>

      {/* ── Contenu ── */}
      <div className="relative z-10 max-w-7xl mx-auto">
        <motion.div
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          className="max-w-xl space-y-6"
        >
          <p className="font-bold text-xs tracking-[0.25em] uppercase"
            style={{ color: 'var(--color-vel-cta-bright)', fontFamily: 'var(--font-display)' }}>
            {{ fr: 'Prêt quand vous l\'êtes', ar: 'جاهزون عندما تكون جاهزًا' }[lang]}
          </p>
          <h2 className="font-black text-4xl sm:text-5xl text-vel-ink leading-tight"
            style={{ fontFamily: 'var(--font-display)' }}>
            {{ fr: 'Une flotte entretenue, des clés en main le jour même', ar: 'أسطول مُعتنى به، ومفاتيح بين يديك في نفس اليوم' }[lang]}
          </h2>
          <p className="text-vel-slate text-lg leading-relaxed">
            {{
              fr: 'Choisissez vos dates, nous préparons le véhicule. Assurance incluse, kilométrage clair, aucune surprise.',
              ar: 'اختر تواريخك ونحن نجهّز السيارة. التأمين مشمول، عدّاد واضح، بلا مفاجآت.',
            }[lang]}
          </p>
          <motion.button
            onClick={onReserve}
            whileHover={reduceMotion ? {} : { scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="btn-vel-cta px-8 py-4 text-sm"
          >
            {{ fr: 'Voir les voitures disponibles', ar: 'عرض السيارات المتاحة' }[lang]}
            <ArrowRight size={17} />
          </motion.button>
        </motion.div>
      </div>
    </section>
  );
};
