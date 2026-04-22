import { HEAT_TIERS, heatToTier } from './Heat';
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
  }

  get vx(): number {
    return this.dirX * this.speed;
  }

  get vy(): number {
    return this.dirY * this.speed;
  }

  setDirection(dx: number, dy: number): void {
    const len = Math.hypot(dx, dy) || 1;
    this.dirX = dx / len;
    this.dirY = dy / len;
  }

  accelerateOnBounce(): void {
    this.speed = Math.min(this.speed + BALL_SPEED_STEP, BALL_MAX_SPEED);
  }

  resetSpeed(): void {
    this.speed = this.baseSpeed;
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

  getHeat(): number {
    const range = BALL_MAX_SPEED - this.baseSpeed;
    if (range <= 0) return 0;
    return Math.min(1, Math.max(0, (this.speed - this.baseSpeed) / range));
  }

  getHeatTier(): HeatTier {
    return heatToTier(this.getHeat());
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
