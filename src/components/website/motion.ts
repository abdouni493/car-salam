import { useReducedMotion, type Variants } from 'motion/react';

/**
 * Rythme de mouvement partagé du site public.
 * Source de vérité : design-system/car_salam/MASTER.md §5.
 *
 * Toutes les animations du site tirent d'ici : une seule cadence, un seul
 * easing. C'est ce qui fait qu'un site "bouge juste" au lieu de bouger beaucoup.
 */
export const EASE_ENTER = [0.22, 1, 0.36, 1] as const;   // ease-out
export const EASE_EXIT = [0.4, 0, 1, 1] as const;        // ease-in
export const DUR_ENTER = 0.28;
export const DUR_EXIT = 0.18;                            // ≈65 % de l'entrée
export const SPRING = { type: 'spring', stiffness: 260, damping: 26 } as const;

/**
 * Variants de révélation au scroll, conscients de `prefers-reduced-motion`.
 *
 * En mouvement réduit on garde le fondu mais on supprime toute translation :
 * le contenu reste immédiatement lisible, ce qui est le but de la préférence.
 */
export function useRevealVariants(): { container: Variants; item: Variants } {
  const reduce = useReducedMotion();

  const container: Variants = {
    hidden: {},
    show: {
      transition: {
        // 50 ms par carte : assez pour lire une cascade, assez court pour ne pas
        // faire attendre. Au-delà de ~8 items la cascade devient une corvée.
        staggerChildren: reduce ? 0 : 0.05,
        delayChildren: reduce ? 0 : 0.04,
      },
    },
  };

  const item: Variants = {
    hidden: reduce ? { opacity: 0 } : { opacity: 0, y: 24 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: DUR_ENTER, ease: EASE_ENTER },
    },
  };

  return { container, item };
}

/** Props à étaler sur une grille dont les enfants portent `variants={item}`. */
export const revealGridProps = {
  initial: 'hidden',
  whileInView: 'show',
  viewport: { once: true, amount: 0.15 },
} as const;

/** Survol de carte : léger soulèvement, ressort. Pas de scale sur les grandes surfaces. */
export const cardHover = {
  whileHover: { y: -4 },
  whileTap: { scale: 0.99 },
  transition: SPRING,
} as const;
