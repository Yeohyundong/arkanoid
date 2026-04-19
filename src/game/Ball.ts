export class Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  readonly radius = 10;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    this.vx = 220;
    this.vy = 280;
  }

  update(dt: number, worldW: number, worldH: number): void {
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    if (this.x - this.radius < 0) {
      this.x = this.radius;
      this.vx = -this.vx;
    } else if (this.x + this.radius > worldW) {
      this.x = worldW - this.radius;
      this.vx = -this.vx;
    }

    if (this.y - this.radius < 0) {
      this.y = this.radius;
      this.vy = -this.vy;
    } else if (this.y + this.radius > worldH) {
      this.y = worldH - this.radius;
      this.vy = -this.vy;
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.shadowColor = '#00eaff';
    ctx.shadowBlur = 20;
    ctx.fillStyle = '#00eaff';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
