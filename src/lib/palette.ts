/* Ordinal blue ramp reused for layer accents. Layers are server-defined,
   so colors are assigned by display order rather than layer id. */
const LAYER_PALETTE = ['--tier-1', '--tier-2', '--tier-3', '--tier-4', '--tier-5']

/** Cycles through the ramp — for series that only need to be distinguishable
    from each other (chart sections), not to convey pyramid position. */
export const layerColorVar = (order: number): string =>
  LAYER_PALETTE[((order % LAYER_PALETTE.length) + LAYER_PALETTE.length) % LAYER_PALETTE.length]

/** Accent for a layer itself. Spreads however many layers exist across the
    ramp, so the base is always darkest and the tip always lightest — a 5-layer
    pyramid uses every step, a 3-layer one uses the ends and the middle. */
export function layerAccentVar(order: number, total: number): string {
  if (total <= 1) return LAYER_PALETTE[0]
  const position = Math.min(Math.max(order, 0), total - 1)
  return LAYER_PALETTE[Math.round((position / (total - 1)) * (LAYER_PALETTE.length - 1))]
}
