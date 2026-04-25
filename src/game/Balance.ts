import { HEAT_TIERS } from './Heat';

export interface BalanceParams {
  ballSpeedStep: number;
  ballMaxSpeed: number;
  enlargeDurationMs: number;
  fireballDurationMs: number;
  laserDurationMs: number;
  heatBoostStacks: number;
  itemSpawnIntervalMs: number;
  itemBlockLifetimeMs: number;
  extraLifeStackStep: number;
  brickScore: number;
  arcadeStartingLives: number;
  arcadeMaxLives: number;
}

export const DEFAULT_BALANCE: BalanceParams = {
  ballSpeedStep: 10,
  ballMaxSpeed: 800,
  enlargeDurationMs: 8000,
  fireballDurationMs: 5000,
  laserDurationMs: 4000,
  heatBoostStacks: 15,
  itemSpawnIntervalMs: 4000,
  itemBlockLifetimeMs: 10000,
  extraLifeStackStep: 30,
  brickScore: 10,
  arcadeStartingLives: 3,
  arcadeMaxLives: 5,
};

export const balance: BalanceParams = { ...DEFAULT_BALANCE };

export function resetBalance(): void {
  Object.assign(balance, DEFAULT_BALANCE);
}

const STORAGE_KEY = 'arkanoid:balance:dev:v1';

interface SavedSnapshot {
  balance: Partial<BalanceParams>;
  heatTiers: { minStack: number; mult: number; damage: number }[];
}

export function saveBalanceSnapshot(): boolean {
  try {
    const snapshot: SavedSnapshot = {
      balance: { ...balance },
      heatTiers: HEAT_TIERS.map((t) => ({ minStack: t.minStack, mult: t.mult, damage: t.damage })),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    return true;
  } catch {
    return false;
  }
}

export function loadBalanceSnapshot(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as Partial<SavedSnapshot>;
    if (parsed.balance) {
      for (const key of Object.keys(DEFAULT_BALANCE) as (keyof BalanceParams)[]) {
        const v = parsed.balance[key];
        if (typeof v === 'number' && Number.isFinite(v)) balance[key] = v;
      }
    }
    if (Array.isArray(parsed.heatTiers)) {
      for (let i = 0; i < HEAT_TIERS.length && i < parsed.heatTiers.length; i++) {
        const saved = parsed.heatTiers[i];
        if (saved && typeof saved.minStack === 'number') HEAT_TIERS[i].minStack = saved.minStack;
        if (saved && typeof saved.mult === 'number') HEAT_TIERS[i].mult = saved.mult;
        if (saved && typeof saved.damage === 'number') HEAT_TIERS[i].damage = saved.damage;
      }
    }
    return true;
  } catch {
    return false;
  }
}

export function clearBalanceSnapshot(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function hasSavedSnapshot(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}
