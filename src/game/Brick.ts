export class Brick {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly color: string;
  readonly maxHp: number;
  hp: number;

  constructor(x: number, y: number, width: number, height: number, hp: number, color: string) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.color = color;
    this.maxHp = hp;
    this.hp = hp;
  }

  get destroyed(): boolean {
    return this.hp <= 0;
  }

  damage(): void {
    if (this.hp > 0) this.hp -= 1;
  }

  get left(): number {
    return this.x - this.width / 2;
  }

  get right(): number {
    return this.x + this.width / 2;
  }

  get top(): number {
    return this.y - this.height / 2;
  }

  get bottom(): number {
    return this.y + this.height / 2;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    if (this.destroyed) return;

    const alpha = 0.5 + 0.5 * (this.hp / this.maxHp);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 14;
    ctx.fillStyle = this.color;
    ctx.fillRect(this.left + 1, this.top + 1, this.width - 2, this.height - 2);
    ctx.restore();

    ctx.save();
    ctx.fillStyle = '#0a0a0f';
    ctx.font = '700 14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(this.hp), this.x, this.y + 1);
    ctx.restore();
  }
}
