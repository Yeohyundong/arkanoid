export type HeatTier = 0 | 1 | 2 | 3;

export interface HeatTierDef {
  name: string;
  color: string;
  mult: number;
  minHeat: number;
}

export const HEAT_TIERS: readonly HeatTierDef[] = [
  { name: 'COOL', color: '#2eeaff', mult: 1, minHeat: 0 },
  { name: 'WARM', color: '#ffaa2e', mult: 2, minHeat: 0.30 },
  { name: 'HOT', color: '#ff3d5c', mult: 3, minHeat: 0.60 },
  { name: 'BLAZE', color: '#fff1a8', mult: 5, minHeat: 0.85 },
];

export function heatToTier(heat: number): HeatTier {
  for (let i = HEAT_TIERS.length - 1; i >= 0; i--) {
    if (heat >= HEAT_TIERS[i].minHeat) return i as HeatTier;
  }
  return 0;
}
