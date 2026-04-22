export const BALL_DEFAULT_BASE_SPEED = 400;
export const BALL_SPEED_STEP = 20;
export const BALL_MAX_SPEED = 800;

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

  draw(ctx: CanvasRenderingContext2D): void {
    const t = this.getHeat();
    const r = Math.round(0 + (255 - 0) * t);
    const g = Math.round(234 + (48 - 234) * t);
    const b = Math.round(255 + (96 - 255) * t);
    const color = `rgb(${r}, ${g}, ${b})`;

    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 20 + 20 * t;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
