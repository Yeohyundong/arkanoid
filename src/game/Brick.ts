export type BrickType = 'normal';

export class Brick {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly type: BrickType;
  readonly color: string;
  destroyed = false;

  constructor(x: number, y: number, width: number, height: number, type: BrickType, color: string) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.type = type;
    this.color = color;
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
    ctx.save();
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 14;
    ctx.fillStyle = this.color;
    ctx.fillRect(this.left + 1, this.top + 1, this.width - 2, this.height - 2);
    ctx.restore();
  }
}
