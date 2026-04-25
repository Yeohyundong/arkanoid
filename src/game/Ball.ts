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
  laserHorizontalUntil = 0;
  laserVerticalUntil = 0;
  readonly radius = 10;
  private fireTrail: { x: number; y: number; bornAt: number }[] = [];

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

  accelerateWithoutStack(): void {
    this.speed = Math.min(this.speed + BALL_SPEED_STEP, BALL_MAX_SPEED);
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

  grantLaserHorizontal(durationMs: number): void {
    const now = performance.now();
    const remaining = Math.max(0, this.laserHorizontalUntil - now);
    this.laserHorizontalUntil = now + durationMs + remaining;
  }

  grantLaserVertical(durationMs: number): void {
    const now = performance.now();
    const remaining = Math.max(0, this.laserVerticalUntil - now);
    this.laserVerticalUntil = now + durationMs + remaining;
  }

  get isLaserHorizontal(): boolean {
    return performance.now() < this.laserHorizontalUntil;
  }

  get isLaserVertical(): boolean {
    return performance.now() < this.laserVerticalUntil;
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
    this.recordFireTrail();
    return bounced;
  }

  private recordFireTrail(): void {
    const now = performance.now();
    if (!this.isFireball) {
      if (this.fireTrail.length > 0) this.fireTrail.length = 0;
      return;
    }
    while (this.fireTrail.length > 0 && now - this.fireTrail[0].bornAt > 350) {
      this.fireTrail.shift();
    }
    const last = this.fireTrail[this.fireTrail.length - 1];
    if (last) {
      const dx = this.x - last.x;
      const dy = this.y - last.y;
      if (dx * dx + dy * dy < 16) return;
    }
    this.fireTrail.push({ x: this.x, y: this.y, bornAt: now });
  }

  getHeatTier(): HeatTier {
    return stackToTier(this.stack);
  }

  draw(ctx: CanvasRenderingContext2D): void {
    if (this.fireTrail.length > 0) this.drawFireTrail(ctx);
    if (this.isLaserHorizontal || this.isLaserVertical) this.drawLaserBeacon(ctx);

    const tier = this.getHeatTier();
    const tierColor = HEAT_TIERS[tier].color;
    const auraRadius = this.radius + 3 + 1.5 * tier;

    ctx.save();
    ctx.fillStyle = tierColor;
    ctx.globalAlpha = 0.15 + 0.1 * tier;
    ctx.beginPath();
    ctx.arc(this.x, this.y, auraRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.shadowColor = tierColor;
    ctx.shadowBlur = 8 + 5 * tier;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawLaserBeacon(ctx: CanvasRenderingContext2D): void {
    const now = performance.now();
    const color = '#c44dff';
    const pulse = 0.55 + 0.45 * Math.sin(now * 0.012);
    const len = 16;
    const thick = 3;
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.fillStyle = color;
    ctx.globalAlpha = pulse;
    if (this.isLaserHorizontal) {
      ctx.fillRect(this.x - this.radius - len, this.y - thick / 2, len, thick);
      ctx.fillRect(this.x + this.radius, this.y - thick / 2, len, thick);
    }
    if (this.isLaserVertical) {
      ctx.fillRect(this.x - thick / 2, this.y - this.radius - len, thick, len);
      ctx.fillRect(this.x - thick / 2, this.y + this.radius, thick, len);
    }
    ctx.restore();
  }

  private drawFireTrail(ctx: CanvasRenderingContext2D): void {
    const now = performance.now();
    ctx.save();
    ctx.shadowColor = '#ff6a2e';
    ctx.shadowBlur = 14;
    for (let i = 0; i < this.fireTrail.length; i++) {
      const p = this.fireTrail[i];
      const age = now - p.bornAt;
      const t = Math.min(1, age / 350);
      if (t >= 1) continue;
      const alpha = (1 - t) * 0.75;
      const rad = (1 - t * 0.5) * this.radius * 0.9;
      const color = t < 0.4 ? '#ffee66' : t < 0.75 ? '#ff8a2e' : '#ff3d2e';
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, rad, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
