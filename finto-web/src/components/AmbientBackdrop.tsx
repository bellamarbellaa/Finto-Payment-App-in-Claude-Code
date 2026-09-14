import { motion } from 'framer-motion';

/**
 * A slow, continuous ambient background for the login brand panel — an
 * abstract tilted glass card plus two soft glows, drifting and breathing
 * in a loop. Descended from the classic "scroll-tilt hero card" pattern
 * (rotateX + perspective + scale), just running on a timer instead of
 * scroll position since this panel never scrolls, and abstract instead
 * of a screenshot since it's meant to sit behind the text, not compete
 * with it. Only transform/opacity animate, and it's aria-hidden — purely
 * decorative.
 */
export function AmbientBackdrop() {
  return (
    <div className="ambient-backdrop" aria-hidden="true">
      <motion.div
        className="ambient-glow ambient-glow-a"
        animate={{ x: [0, 26, 0], y: [0, -18, 0], scale: [1, 1.08, 1] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="ambient-glow ambient-glow-b"
        animate={{ x: [0, -22, 0], y: [0, 20, 0], scale: [1, 1.1, 1] }}
        transition={{ duration: 17, repeat: Infinity, ease: 'easeInOut', delay: 1.2 }}
      />

      <div className="ambient-stage">
        <motion.div
          className="ambient-card"
          initial={{ rotateX: 24, rotateZ: -3, opacity: 0, scale: 0.92 }}
          animate={{
            rotateX: [10, 16, 10],
            rotateZ: [-3, 1, -3],
            opacity: 1,
            scale: [1, 1.02, 1]
          }}
          transition={{
            opacity: { duration: 1.1, ease: [0.22, 1, 0.36, 1] },
            rotateX: { duration: 9, repeat: Infinity, ease: 'easeInOut' },
            rotateZ: { duration: 9, repeat: Infinity, ease: 'easeInOut' },
            scale: { duration: 9, repeat: Infinity, ease: 'easeInOut' }
          }}
        >
          <div className="ambient-card-sheen" />
          <div className="ambient-card-row" />
          <div className="ambient-card-row short" />
        </motion.div>
      </div>
    </div>
  );
}
