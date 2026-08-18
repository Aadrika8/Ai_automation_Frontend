/* Ordinal blue ramp reused for layer accents. Layers are server-defined,
   so colors are assigned by display order rather than layer id. */
const LAYER_PALETTE = ['--tier-unit', '--tier-integration', '--tier-system', '--tier-e2e']

export const layerColorVar = (order: number): string =>
  LAYER_PALETTE[((order % LAYER_PALETTE.length) + LAYER_PALETTE.length) % LAYER_PALETTE.length]
