export type ItemType = 'M' | 'E' | 'F' | 'H' | 'S' | 'LH' | 'LV';

export const ITEM_POOL: ItemType[] = ['M', 'E', 'F', 'H', 'S', 'LH', 'LV'];

export const ITEM_COLORS: Record<ItemType, string> = {
  M: '#2effa2',
  E: '#ffc94a',
  F: '#ff6a2e',
  H: '#ff3d5c',
  S: '#4a8eff',
  LH: '#c44dff',
  LV: '#c44dff',
};

export const ITEM_LABELS: Record<ItemType, string> = {
  M: 'M',
  E: 'E',
  F: 'F',
  H: 'H',
  S: 'S',
  LH: '═',
  LV: '║',
};

export const ITEM_NAMES: Record<ItemType, string> = {
  M: 'Multi-Ball!',
  E: 'Enlarge!',
  F: 'Fireball!',
  H: 'Heat Up!',
  S: 'Shield Up!',
  LH: 'Laser ═',
  LV: 'Laser ║',
};

export const ITEM_FALL_SPEED = 220;

export class Item {
  x: number;
  y: number;
  vy = ITEM_FALL_SPEED;
  readonly type: ItemType;
  readonly width = 42;
  readonly height = 16;

  constructor(x: number, y: number, type: ItemType) {
    this.x = x;
    this.y = y;
    this.type = type;
  }

  get left(): number { return this.x - this.width / 2; }
  get right(): number { return this.x + this.width / 2; }
  get top(): number { return this.y - this.height / 2; }
  get bottom(): number { return this.y + this.height / 2; }

  update(dt: number): void {
    this.y += this.vy * dt;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const color = ITEM_COLORS[this.type];
    const r = this.height / 2;

    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(this.left + r, this.top);
    ctx.lineTo(this.right - r, this.top);
    ctx.arc(this.right - r, this.y, r, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(this.left + r, this.bottom);
    ctx.arc(this.left + r, this.y, r, Math.PI / 2, -Math.PI / 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.fillStyle = '#0a0a0f';
    ctx.font = '700 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ITEM_LABELS[this.type], this.x, this.y + 1);
    ctx.restore();
  }
}
