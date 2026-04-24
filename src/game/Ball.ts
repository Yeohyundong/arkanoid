import { HEAT_TIERS, stackToTier } from './Heat';
import type { HeatTier } from './Heat';

export const BALL_DEFAULT_BASE_SPEED = 500;
export const BALL_SPEED_STEP = 20;
export const BALL_MAX_SPEED = 1000;

export class Ball {
  x: number;
  y: number;
  dirX: number;
  dirY: number;
  speed: number;
  baseSpeed: number;
  stack = 0;
  fireballUntil = 0;
  readonly radius = 10;

  constructor(x: number, y: number, baseSpeed = BALL_DEFAULT_BASE_SPEED) {
    this.x = x;
    this.y = y;
    const angle = Math.PI * 0.3;
    this.dirX = Math.sin(angle);
    this.dirY = Math.cos(angle);
    this.baseSpeed = baseSpeed;
    this.speed = baseSpeed;
  }

  setBaseSpeed(baseSpeed: number): void {
    this.baseSpeed = baseSpeed;
    this.speed = baseSpeed;
    this.stack = 0;
  }

  get vx(): number {
    return this.dirX * this.speed;
  }

  get vy(): number {
    return this.dirY * this.speed;
  }

  setDirection(dx: number, dy: number): void {
    const len = Math.hypot(dx, dy) || 1;
    let nx = dx / len;
    let ny = dy / len;
    const MIN_VY = 0.3;
    if (Math.abs(ny) < MIN_VY) {
      const ySign = ny === 0 ? 1 : Math.sign(ny);
      ny = ySign * MIN_VY;
      const xSign = nx === 0 ? 1 : Math.sign(nx);
      nx = xSign * Math.sqrt(Math.max(0, 1 - ny * ny));
    }
    this.dirX = nx;
    this.dirY = ny;
  }

  accelerateOnBounce(): void {
    this.speed = Math.min(this.speed + BALL_SPEED_STEP, BALL_MAX_SPEED);
    this.stack += 1;
  }

  addHeatStacks(n: number): void {
    this.stack += n;
    this.speed = Math.min(this.speed + BALL_SPEED_STEP * n, BALL_MAX_SPEED);
  }

  grantFireball(durationMs: number): void {
    const now = performance.now();
    const remaining = Math.max(0, this.fireballUntil - now);
    this.fireballUntil = now + durationMs + remaining;
  }

  get isFireball(): boolean {
    return performance.now() < this.fireballUntil;
  }

  resetSpeed(): void {
    this.speed = this.baseSpeed;
    this.stack = 0;
  }

  update(dt: number, worldW: number): boolean {
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    let bounced = false;

    if (this.x - this.radius < 0) {
      this.x = this.radius;
      this.dirX = -this.dirX;
      bounced = true;
    } else if (this.x + this.radius > worldW) {
      this.x = worldW - this.radius;
      this.dirX = -this.dirX;
      bounced = true;
    }

    if (this.y - this.radius < 0) {
      this.y = this.radius;
      this.dirY = -this.dirY;
      bounced = true;
    }

    if (bounced) this.accelerateOnBounce();
    return bounced;
  }

  getHeatTier(): HeatTier {
    return stackToTier(this.stack);
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const tier = this.getHeatTier();
    const tierColor = HEAT_TIERS[tier].color;
    const auraRadius = this.radius + 4 + 3 * tier;

    ctx.save();
    ctx.fillStyle = tierColor;
    ctx.globalAlpha = 0.15 + 0.12 * tier;
    ctx.beginPath();
    ctx.arc(this.x, this.y, auraRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (this.isFireball) {
      const flicker = 0.7 + 0.3 * Math.sin(performance.now() * 0.03);
      ctx.save();
      ctx.strokeStyle = '#ff6a2e';
      ctx.shadowColor = '#ff6a2e';
      ctx.shadowBlur = 14;
      ctx.globalAlpha = flicker;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius + 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.shadowColor = tierColor;
    ctx.shadowBlur = 10 + 8 * tier;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
