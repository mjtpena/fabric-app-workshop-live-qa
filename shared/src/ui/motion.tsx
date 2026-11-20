/**
 * @x10/shared/motion: layout animation for screens where order changes live (Q&A board, triage queue, pulse gauge).
 * The kit itself is CSS-first; import this only where items move. Respects prefers-reduced-motion via MotionConfig.
 *
 *   import { motion, AnimatePresence, MotionProvider, layoutSpring } from '@x10/shared/motion';
 *   <MotionProvider><motion.li layout transition={layoutSpring} /></MotionProvider>
 */
import type { ReactNode } from 'react';
import { MotionConfig } from 'motion/react';

export { motion, AnimatePresence, LayoutGroup, Reorder, useReducedMotion, MotionConfig } from 'motion/react';

/** The design system's easing, cubic-bezier(0.2, 0, 0, 1). */
export const ease = [0.2, 0, 0, 1] as const;

/** Spring for list re-ordering: quick, no overshoot you can see. */
export const layoutSpring = { type: 'spring', stiffness: 520, damping: 42, mass: 0.9 } as const;

/** Enter/exit for list items. */
export const fadeUp = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
  transition: { duration: 0.18, ease },
} as const;

/** Wrap animated regions: turns motion off for users who ask for reduced motion. */
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
