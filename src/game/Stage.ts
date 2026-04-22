import { Brick } from './Brick';
import type { BrickType } from './Brick';

const ROW_COLORS = ['#ff2e6a', '#ff9f2e', '#ffee00', '#2effa2', '#2e9cff', '#b52eff'];

const BRICK_HEIGHT = 26;
const TOP_PADDING = 90;

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
      '..BBBBBB..',
      '.BBBBBBBB.',
      '..BBBBBB..',
    ],
    baseSpeed: 360,
  },
  {
    rows: [
      '..........',
      '.BBBBBBBB.',
      'BBBBBBBBBB',
      'BBBBBBBBBB',
      '.BBBBBBBB.',
      '..........',
    ],
    baseSpeed: 420,
  },
  {
    rows: [
      'BBBBBBBBBB',
      'B.BBBBBB.B',
      'BB.BBBB.BB',
      'BBB.BB.BBB',
      'BB.BBBB.BB',
      'B.BBBBBB.B',
      'BBBBBBBBBB',
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
      const ch = row[c];
      const type = charToType(ch);
      if (!type) continue;

      const x = c * brickW + brickW / 2;
      const y = TOP_PADDING + r * BRICK_HEIGHT + BRICK_HEIGHT / 2;
      const color = ROW_COLORS[r % ROW_COLORS.length];
      bricks.push(new Brick(x, y, brickW, BRICK_HEIGHT, type, color));
    }
  }
  return bricks;
}

function charToType(ch: string): BrickType | null {
  if (ch === 'B') return 'normal';
  return null;
}
