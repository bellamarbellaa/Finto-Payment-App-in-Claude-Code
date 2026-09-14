import { motion } from 'framer-motion';

/**
 * A one-time tilt-and-settle entrance for the login brand panel's product
 * preview. Login is a single-viewport form, not a scrolling page, so this
 * plays once on mount rather than tracking scroll position — same easing
 * and transform shape as a scroll-driven reveal, just triggered differently.
 */
export function BrandReveal({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="brand-reveal">
      <motion.div
        className="brand-reveal-card"
        initial={{ rotateX: 18, scale: 0.94, opacity: 0 }}
        animate={{ rotateX: 0, scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 90, damping: 20, delay: 0.2 }}
      >
        <img src={src} alt={alt} />
      </motion.div>
    </div>
  );
}
