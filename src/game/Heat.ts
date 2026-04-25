export type HeatTier = 0 | 1 | 2 | 3;

export interface HeatTierDef {
  name: string;
  color: string;
  mult: number;
  minStack: number;
  damage: number;
}

export const HEAT_TIERS: readonly HeatTierDef[] = [
  { name: 'COOL',  color: '#2eeaff', mult: 1, minStack: 0,  damage: 1 },
  { name: 'WARM',  color: '#ffd84a', mult: 2, minStack: 15, damage: 1 },
  { name: 'HOT',   color: '#ff7a2e', mult: 3, minStack: 30, damage: 2 },
  { name: 'BLAZE', color: '#ff2e4a', mult: 5, minStack: 50, damage: 3 },
];

const DEFAULT_HEAT_TIERS = HEAT_TIERS.map((t) => ({ ...t }));

export function resetHeatTiers(): void {
  for (let i = 0; i < HEAT_TIERS.length; i++) {
    Object.assign(HEAT_TIERS[i], DEFAULT_HEAT_TIERS[i]);
  }
}

export function stackToTier(stack: number): HeatTier {
  for (let i = HEAT_TIERS.length - 1; i >= 0; i--) {
    if (stack >= HEAT_TIERS[i].minStack) return i as HeatTier;
  }
  return 0;
}
