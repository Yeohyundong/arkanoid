import { Brick } from './Brick';

const ROW_COLORS = ['#ff2e6a', '#ff9f2e', '#ffee00', '#2effa2', '#2e9cff', '#b52eff'];

export const BRICK_HEIGHT = 26;
export const TOP_PADDING = 110;
export const GRID_COLS = 10;
export const BASE_SPEED = 500;

// === Arcade mode ===

interface ArcadeStageDef {
  rows: string[];
  baseSpeed: number;
}

const ARCADE_STAGES: ArcadeStageDef[] = [
  // Stage 1 — Welcome Wall
  {
    rows: [
      '..........',
      '.11111111.',
      '1111111111',
      '1111111111',
      '.11111111.',
    ],
    baseSpeed: 500,
  },
  // Stage 2 — Stripes
  {
    rows: [
      '..........',
      '2222222222',
      '1111111111',
      '2222222222',
      '1111111111',
      '.11111111.',
    ],
    baseSpeed: 500,
  },
  // Stage 3 — Frame
  {
    rows: [
      '2222222222',
      '2........2',
      '2.111111.2',
      '2.111111.2',
      '2.111111.2',
      '2........2',
      '2222222222',
    ],
    baseSpeed: 520,
  },
  // Stage 4 — H Letter
  {
    rows: [
      '2........2',
      '2........2',
      '2........2',
      '2222222222',
      '2222222222',
      '2........2',
      '2........2',
      '2........2',
    ],
    baseSpeed: 540,
  },
  // Stage 5 — Diamond
  {
    rows: [
      '....11....',
      '...1221...',
      '..122221..',
      '.12222221.',
      '..122221..',
      '...1221...',
      '....11....',
    ],
    baseSpeed: 540,
  },
  // Stage 6 — Checkerboard
  {
    rows: [
      '1.2.1.2.1.',
      '.1.2.1.2.1',
      '1.2.1.2.1.',
      '.1.2.1.2.1',
      '1.2.1.2.1.',
      '.1.2.1.2.1',
    ],
    baseSpeed: 560,
  },
  // Stage 7 — Pyramid
  {
    rows: [
      '....33....',
      '...3223...',
      '..322223..',
      '.32111123.',
      '3211111123',
    ],
    baseSpeed: 580,
  },
  // Stage 8 — Zigzag
  {
    rows: [
      '333.......',
      '1333......',
      '.1333.....',
      '..1333....',
      '...1333...',
      '....1333..',
      '.....1333.',
      '......1333',
      '.......333',
    ],
    baseSpeed: 580,
  },
  // Stage 9 — Fortress
  {
    rows: [
      '3333333333',
      '3........3',
      '3.222222.3',
      '3.2....2.3',
      '3.2.11.2.3',
      '3.2.11.2.3',
      '3.2....2.3',
      '3.222222.3',
      '3........3',
      '3333333333',
    ],
    baseSpeed: 600,
  },
  // Stage 10 — Boss Wall
  {
    rows: [
      '5555555555',
      '4444444444',
      '3333333333',
      '3222222223',
      '3211111123',
      '3211111123',
      '3222222223',
      '3333333333',
      '4444444444',
      '5555555555',
    ],
    baseSpeed: 620,
  },
];

export const ARCADE_STAGE_COUNT = ARCADE_STAGES.length;

export interface ArcadeStageData {
  bricks: Brick[];
  baseSpeed: number;
}

export function loadArcadeStage(index: number, worldW: number): ArcadeStageData {
  const def = ARCADE_STAGES[index];
  if (!def) throw new Error(`Arcade stage ${index} not found`);
  const bricks: Brick[] = [];
  for (let r = 0; r < def.rows.length; r++) {
    const y = TOP_PADDING + r * BRICK_HEIGHT + BRICK_HEIGHT / 2;
    const color = ROW_COLORS[r % ROW_COLORS.length];
    bricks.push(...buildRowFromPattern(def.rows[r], worldW, y, color, 1, true));
  }
  return { bricks, baseSpeed: def.baseSpeed };
}

// === Wave mode ===

const INITIAL_PATTERNS: string[] = [
  '.11111111.',
  '11.1111.11',
  '.11111111.',
];

const PATTERNS_DENSE: string[] = [
  '.11111111.',
  '11.1111.11',
  '111.11.111',
  '1.11111111',
  '11111111.1',
];

const PATTERNS_MIXED: string[] = [
  '.11.11.11.',
  '11..11..11',
  '.1.1111.1.',
  '11.1111.11',
  '1.111.111.',
  '.11.1111.1',
];

export interface InitialWaveData {
  bricks: Brick[];
  baseSpeed: number;
}

export function loadInitialWave(worldW: number): InitialWaveData {
  const bricks: Brick[] = [];
  for (let r = 0; r < INITIAL_PATTERNS.length; r++) {
    const y = TOP_PADDING + r * BRICK_HEIGHT + BRICK_HEIGHT / 2;
    const color = ROW_COLORS[r % ROW_COLORS.length];
    bricks.push(...buildRowFromPattern(INITIAL_PATTERNS[r], worldW, y, color, 1, true));
  }
  return { bricks, baseSpeed: BASE_SPEED };
}

export function generateWaveRow(waveNumber: number, worldW: number): Brick[] {
  const y = TOP_PADDING + BRICK_HEIGHT / 2;
  const color = ROW_COLORS[waveNumber % ROW_COLORS.length];
  const pattern = selectWavePattern(waveNumber);
  return buildRowFromPattern(pattern, worldW, y, color, waveNumber, false);
}

export function getWaveIntervalMs(waveNumber: number): number {
  const start = 15000;
  const floor = 5000;
  const step = 1000;
  return Math.max(floor, start - (waveNumber - 1) * step);
}

function selectWavePattern(wave: number): string {
  const r = Math.random();
  let pool: string[];
  if (wave <= 3) {
    pool = PATTERNS_DENSE;
  } else if (wave <= 10) {
    pool = r < 0.65 ? PATTERNS_DENSE : PATTERNS_MIXED;
  } else {
    pool = r < 0.4 ? PATTERNS_DENSE : PATTERNS_MIXED;
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

function buildRowFromPattern(
  pattern: string,
  worldW: number,
  y: number,
  color: string,
  waveNumber: number,
  arcadeHp: boolean,
): Brick[] {
  const cols = pattern.length;
  const brickW = worldW / cols;
  const bricks: Brick[] = [];
  for (let c = 0; c < cols; c++) {
    const ch = pattern[c];
    if (ch === '.') continue;
    const hp = arcadeHp && ch >= '1' && ch <= '9' ? Number(ch) : rollHp(waveNumber);
    const x = c * brickW + brickW / 2;
    bricks.push(new Brick(x, y, brickW, BRICK_HEIGHT, hp, color));
  }
  return bricks;
}

function rollHp(wave: number): number {
  if (wave <= 3) return 1;
  if (wave <= 6) return Math.random() < 0.7 ? 1 : 2;
  if (wave <= 10) {
    const r = Math.random();
    if (r < 0.5) return 1;
    if (r < 0.85) return 2;
    return 3;
  }
  const r = Math.random();
  if (r < 0.35) return 1;
  if (r < 0.75) return 2;
  return 3;
}
