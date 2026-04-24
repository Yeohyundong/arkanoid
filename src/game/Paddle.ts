const BASE_WIDTH = 110;
const PER_STACK_WIDTH = 40;
const MAX_STACKS = 10;
const WARNING_MS = 3000;

export class Paddle {
  x: number;
  readonly y: number;
  readonly height = 16;
  private enlargeExpiries: number[] = [];

  constructor(worldW: number, worldH: number) {
    this.x = worldW / 2;
    this.y = worldH - 60;
  }

  get width(): number {
    return BASE_WIDTH + PER_STACK_WIDTH * this.activeStackCount();
  }

  private activeStackCount(): number {
    const now = performance.now();
    let count = 0;
    for (const t of this.enlargeExpiries) if (t > now) count++;
    return count;
  }

  resetEffects(): void {
    this.enlargeExpiries = [];
  }

  enlarge(durationMs: number): void {
    const now = performance.now();
    const newExpiry = now + durationMs;
    this.pruneExpired();
    if (this.enlargeExpiries.length >= MAX_STACKS) {
      let minIdx = 0;
      for (let i = 1; i < this.enlargeExpiries.length; i++) {
        if (this.enlargeExpiries[i] < this.enlargeExpiries[minIdx]) minIdx = i;
      }
      this.enlargeExpiries[minIdx] = newExpiry;
    } else {
      this.enlargeExpiries.push(newExpiry);
    }
  }

  private pruneExpired(): void {
    const now = performance.now();
    this.enlargeExpiries = this.enlargeExpiries.filter((t) => t > now);
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
    const w = this.width;

    ctx.save();
    ctx.shadowColor = '#ff3df4';
    ctx.shadowBlur = this.activeStackCount() > 0 ? 24 : 18;
    ctx.fillStyle = '#ff3df4';
    ctx.fillRect(this.left, this.top, w, this.height);
    ctx.restore();

    const warning = this.getWarningInfo();
    if (!warning) return;

    const now = performance.now();
    const blink = 0.5 + 0.5 * Math.sin(now * 0.02);
    const zoneW = PER_STACK_WIDTH / 2;

    ctx.save();
    ctx.fillStyle = '#ff3d5c';
    ctx.globalAlpha = blink * 0.75;
    ctx.fillRect(this.left, this.top, zoneW, this.height);
    ctx.fillRect(this.right - zoneW, this.top, zoneW, this.height);
    ctx.restore();
  }

  private getWarningInfo(): { remainingMs: number } | null {
    const now = performance.now();
    let soonest = Infinity;
    for (const t of this.enlargeExpiries) {
      if (t > now && t < soonest) soonest = t;
    }
    if (!isFinite(soonest)) return null;
    const remainingMs = soonest - now;
    if (remainingMs > WARNING_MS) return null;
    return { remainingMs };
  }
}
