import { Brick } from './Brick';

const ROW_COLORS = ['#ff2e6a', '#ff9f2e', '#ffee00', '#2effa2', '#2e9cff', '#b52eff', '#ff2e6a'];

const BRICK_HEIGHT = 26;
const TOP_PADDING = 110;

export interface StageData {
  bricks: Brick[];
  baseSpeed: number;
}

interface StageDef {
  rows: string[];
  baseSpeed: number;
}

const STAGES: StageDef[] = [
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
  {
    rows: [
      '..........',
      '1111111111',
      '1222222221',
      '1222222221',
      '1111111111',
      '.11111111.',
    ],
    baseSpeed: 500,
  },
  {
    rows: [
      '1111111111',
      '1222222221',
      '1233333321',
      '1233333321',
      '1222222221',
      '1111111111',
      '.11111111.',
    ],
    baseSpeed: 500,
  },
];

export const STAGE_COUNT = STAGES.length;

export function loadStage(index: number, worldW: number): StageData {
  const def = STAGES[index];
  if (!def) throw new Error(`Stage ${index} not found`);
  return {
    bricks: buildBricks(def.rows, worldW),
    baseSpeed: def.baseSpeed,
  };
}

function buildBricks(rows: string[], worldW: number): Brick[] {
  const cols = rows[0].length;
  const brickW = worldW / cols;
  const bricks: Brick[] = [];

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    for (let c = 0; c < cols; c++) {
      const hp = charToHp(row[c]);
      if (hp === null) continue;

      const x = c * brickW + brickW / 2;
      const y = TOP_PADDING + r * BRICK_HEIGHT + BRICK_HEIGHT / 2;
      const color = ROW_COLORS[r % ROW_COLORS.length];
      bricks.push(new Brick(x, y, brickW, BRICK_HEIGHT, hp, color));
    }
  }
  return bricks;
}

function charToHp(ch: string): number | null {
  if (ch >= '1' && ch <= '9') return Number(ch);
  return null;
}
