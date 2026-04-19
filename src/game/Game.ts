import { Ball } from './Ball';

export const GAME_WIDTH = 540;
export const GAME_HEIGHT = 960;

export class Game {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly ball: Ball;
  private lastTime = 0;
  private running = false;

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas context not available');
    this.ctx = ctx;

    canvas.width = GAME_WIDTH;
    canvas.height = GAME_HEIGHT;

    this.ball = new Ball(GAME_WIDTH / 2, GAME_HEIGHT / 2);
  }

  start(): void {
    this.running = true;
    this.lastTime = performance.now();
    requestAnimationFrame(this.tick);
  }

  private readonly tick = (now: number): void => {
    if (!this.running) return;
    const dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;

    this.update(dt);
    this.draw();

    requestAnimationFrame(this.tick);
  };

  private update(dt: number): void {
    this.ball.update(dt, GAME_WIDTH, GAME_HEIGHT);
  }

  private draw(): void {
    const { ctx } = this;
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    this.ball.draw(ctx);
  }
}
