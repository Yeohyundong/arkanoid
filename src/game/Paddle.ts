export class Paddle {
  x: number;
  readonly y: number;
  readonly width = 110;
  readonly height = 16;

  constructor(worldW: number, worldH: number) {
    this.x = worldW / 2;
    this.y = worldH - 60;
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
    ctx.shadowBlur = 18;
    ctx.fillStyle = '#ff3df4';
    ctx.fillRect(this.left, this.top, this.width, this.height);
    ctx.restore();
  }
}
