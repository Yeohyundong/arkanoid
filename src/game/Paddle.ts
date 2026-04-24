const BASE_WIDTH = 110;
const ENLARGE_MULT = 1.5;

export class Paddle {
  x: number;
  readonly y: number;
  readonly height = 16;
  private enlargeUntil = 0;

  constructor(worldW: number, worldH: number) {
    this.x = worldW / 2;
    this.y = worldH - 60;
  }

  get width(): number {
    return performance.now() < this.enlargeUntil ? BASE_WIDTH * ENLARGE_MULT : BASE_WIDTH;
  }

  get isEnlarged(): boolean {
    return performance.now() < this.enlargeUntil;
  }

  enlarge(durationMs: number): void {
    const now = performance.now();
    const remaining = Math.max(0, this.enlargeUntil - now);
    this.enlargeUntil = now + durationMs + remaining;
  }

  setTargetX(targetX: number, worldW: number): void {
    const halfW = this.width / 2;
    this.x = Math.max(halfW, Math.min(worldW - halfW, targetX));
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
    ctx.save();
    ctx.shadowColor = '#ff3df4';
    ctx.shadowBlur = this.isEnlarged ? 26 : 18;
    ctx.fillStyle = '#ff3df4';
    ctx.fillRect(this.left, this.top, this.width, this.height);
    ctx.restore();

    if (this.isEnlarged) {
      ctx.save();
      ctx.strokeStyle = '#2effa2';
      ctx.lineWidth = 2;
      ctx.strokeRect(this.left - 1, this.top - 1, this.width + 2, this.height + 2);
      ctx.restore();
    }
  }
}
