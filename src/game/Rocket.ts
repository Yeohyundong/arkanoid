import type { Brick } from './Brick';

export const ROCKET_SPEED = 620;
export const ROCKET_TURN_RATE = Math.PI * 2.6;
export const ROCKET_RADIUS = 7;
export const ROCKET_EXPLOSION_RADIUS = 51;
export const ROCKET_EXPLOSION_DAMAGE = 1;
const ROCKET_LIFETIME_MS = 4000;
const ROCKET_TRAIL_INTERVAL_MS = 14;
const ROCKET_TRAIL_LIMIT = 22;
const ROCKET_WOBBLE_FREQ = 0.018;
const ROCKET_WOBBLE_AMP = 0.85;

export interface RocketTrailPoint {
  x: number;
  y: number;
  bornAt: number;
}

export class Rocket {
  x: number;
  y: number;
  angle: number;
  target: Brick | null;
  bornAt: number;
  exploded = false;
  trail: RocketTrailPoint[] = [];
  private lastTrailAt = 0;
  private wobblePhase: number;

  constructor(x: number, y: number, angle: number, target: Brick | null) {
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.target = target;
    this.bornAt = performance.now();
    this.wobblePhase = Math.random() * Math.PI * 2;
  }

  get expired(): boolean {
    return performance.now() - this.bornAt > ROCKET_LIFETIME_MS;
  }

  update(dt: number): void {
    const age = performance.now() - this.bornAt;
    if (this.target) {
      const dx = this.target.x - this.x;
      const dy = this.target.y - this.y;
      const dist = Math.hypot(dx, dy);
      const wobbleScale = Math.min(1, dist / 90);
      const wobble = Math.sin(age * ROCKET_WOBBLE_FREQ + this.wobblePhase) * ROCKET_WOBBLE_AMP * wobbleScale;
      const desired = Math.atan2(dy, dx) + wobble;
      let diff = desired - this.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const maxTurn = ROCKET_TURN_RATE * dt;
      if (diff > maxTurn) diff = maxTurn;
      else if (diff < -maxTurn) diff = -maxTurn;
      this.angle += diff;
    }
    this.x += Math.cos(this.angle) * ROCKET_SPEED * dt;
    this.y += Math.sin(this.angle) * ROCKET_SPEED * dt;

    const now = performance.now();
    if (now - this.lastTrailAt > ROCKET_TRAIL_INTERVAL_MS) {
      this.lastTrailAt = now;
      this.trail.push({ x: this.x, y: this.y, bornAt: now });
      if (this.trail.length > ROCKET_TRAIL_LIMIT) this.trail.shift();
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const now = performance.now();

    ctx.save();
    for (let i = 0; i < this.trail.length; i++) {
      const p = this.trail[i];
      const t = (now - p.bornAt) / 380;
      if (t >= 1) continue;
      const lifeFade = 1 - t;
      const head = (i + 1) / this.trail.length;
      const alpha = lifeFade * 0.85 * head;
      const r = ROCKET_RADIUS * (0.5 + head * 1.0) * lifeFade;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = head > 0.7 ? '#fff3a8' : '#ff9d2e';
      ctx.shadowColor = '#ff6a2e';
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    const pulse = 0.7 + 0.3 * Math.sin(now * 0.025);
    ctx.save();
    ctx.globalAlpha = 0.55 * pulse;
    ctx.fillStyle = '#ffd54a';
    ctx.shadowColor = '#ffd54a';
    ctx.shadowBlur = 28;
    ctx.beginPath();
    ctx.arc(this.x, this.y, ROCKET_RADIUS * 2.6 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 18;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(13, 0);
    ctx.lineTo(-7, 6);
    ctx.lineTo(-4, 0);
    ctx.lineTo(-7, -6);
    ctx.closePath();
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ff6a2e';
    ctx.beginPath();
    ctx.moveTo(13, 0);
    ctx.lineTo(2, 3);
    ctx.lineTo(2, -3);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
