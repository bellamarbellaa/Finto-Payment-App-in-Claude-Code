/** The avatar chip palette from the design, as [background, foreground]. */
const TINTS: Record<string, [string, string]> = {
  lime: ['var(--tint-lime-bg)', 'var(--tint-lime-fg)'],
  forest: ['var(--tint-forest-bg)', 'var(--tint-forest-fg)'],
  sand: ['var(--tint-sand-bg)', 'var(--tint-sand-fg)'],
  sky: ['var(--tint-sky-bg)', 'var(--tint-sky-fg)'],
  stone: ['var(--tint-stone-bg)', 'var(--tint-stone-fg)']
};

export function tint(key: string | undefined): { background: string; color: string } {
  const [background, color] = TINTS[key ?? 'stone'] ?? TINTS.stone!;
  return { background, color };
}
