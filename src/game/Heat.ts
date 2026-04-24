export type HeatTier = 0 | 1 | 2 | 3;

export interface HeatTierDef {
  name: string;
  color: string;
  mult: number;
  minStack: number;
}

export const HEAT_TIERS: readonly HeatTierDef[] = [
  { name: 'COOL', color: '#2eeaff', mult: 1, minStack: 0 },
  { name: 'WARM', color: '#ffaa2e', mult: 2, minStack: 5 },
  { name: 'HOT', color: '#ff3d5c', mult: 3, minStack: 15 },
  { name: 'BLAZE', color: '#fff1a8', mult: 5, minStack: 30 },
];

export function stackToTier(stack: number): HeatTier {
  for (let i = HEAT_TIERS.length - 1; i >= 0; i--) {
    if (stack >= HEAT_TIERS[i].minStack) return i as HeatTier;
  }
  return 0;
}
