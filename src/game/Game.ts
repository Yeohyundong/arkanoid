import { Ball } from './Ball';
import { Paddle } from './Paddle';
import { InputHandler } from './InputHandler';
import { Brick } from './Brick';
import { loadStage1 } from './Stage';

export const GAME_WIDTH = 540;
export const GAME_HEIGHT = 960;

const MAX_REFLECT_ANGLE = Math.PI / 3;
const LAUNCH_ANGLE = Math.PI / 6;
const BRICK_SCORE = 10;

export class Game {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly ball: Ball;
  private readonly paddle: Paddle;
  private readonly input: InputHandler;
  private bricks: Brick[];
  private score = 0;
  private lastTime = 0;
  private running = false;
  private ballAttached = true;

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas context not available');
    this.ctx = ctx;

    canvas.width = GAME_WIDTH;
    canvas.height = GAME_HEIGHT;

    this.paddle = new Paddle(GAME_WIDTH, GAME_HEIGHT);
    this.ball = new Ball(this.paddle.x, this.paddle.top - 10);
    this.input = new InputHandler(canvas, GAME_WIDTH);
    this.bricks = loadStage1(GAME_WIDTH);
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
    const pointerX = this.input.getPointerX();
    if (pointerX !== null) this.paddle.setTargetX(pointerX, GAME_WIDTH);

    if (this.ballAttached) {
      const attachOffset = (LAUNCH_ANGLE / MAX_REFLECT_ANGLE) * (this.paddle.width / 2);
      this.ball.x = this.paddle.x + attachOffset;
      this.ball.y = this.paddle.top - this.ball.radius;
      if (this.input.consumeTap()) this.launchBall();
      return;
    }

    this.ball.update(dt, GAME_WIDTH);
    this.handlePaddleCollision();
    this.handleBrickCollisions();
    this.handleBottomOut();
  }

  private launchBall(): void {
    this.ball.setDirection(Math.sin(LAUNCH_ANGLE), -Math.cos(LAUNCH_ANGLE));
    this.ballAttached = false;
  }

  private handlePaddleCollision(): void {
    const { ball, paddle } = this;
    if (ball.vy <= 0) return;

    const withinX = ball.x + ball.radius >= paddle.left && ball.x - ball.radius <= paddle.right;
    const hitY = ball.y + ball.radius >= paddle.top && ball.y - ball.radius <= paddle.bottom;
    if (!withinX || !hitY) return;

    ball.y = paddle.top - ball.radius;

    const offset = (ball.x - paddle.x) / (paddle.width / 2);
    const clamped = Math.max(-1, Math.min(1, offset));
    const angle = clamped * MAX_REFLECT_ANGLE;
    ball.setDirection(Math.sin(angle), -Math.cos(angle));

    ball.accelerateOnBounce();
  }

  private handleBrickCollisions(): void {
    const { ball } = this;
    for (const brick of this.bricks) {
      if (brick.destroyed) continue;

      const cx = Math.max(brick.left, Math.min(ball.x, brick.right));
      const cy = Math.max(brick.top, Math.min(ball.y, brick.bottom));
      const dx = ball.x - cx;
      const dy = ball.y - cy;
      if (dx * dx + dy * dy > ball.radius * ball.radius) continue;

      const movingRight = ball.dirX > 0;
      const movingDown = ball.dirY > 0;

      const penX = movingRight
        ? ball.x + ball.radius - brick.left
        : brick.right - (ball.x - ball.radius);
      const penY = movingDown
        ? ball.y + ball.radius - brick.top
        : brick.bottom - (ball.y - ball.radius);

      if (penX < penY) {
        ball.dirX = -ball.dirX;
        ball.x += movingRight ? -penX : penX;
      } else {
        ball.dirY = -ball.dirY;
        ball.y += movingDown ? -penY : penY;
      }

      brick.destroyed = true;
      ball.accelerateOnBounce();
      this.score += BRICK_SCORE;
      return;
    }
  }

  private handleBottomOut(): void {
    if (this.ball.y - this.ball.radius > GAME_HEIGHT) {
      this.ball.resetSpeed();
      this.ballAttached = true;
    }
  }

  private draw(): void {
    const { ctx } = this;
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    for (const brick of this.bricks) brick.draw(ctx);
    this.paddle.draw(ctx);
    this.ball.draw(ctx);
    this.drawHud();
  }

  private drawHud(): void {
    const { ctx } = this;
    ctx.save();
    ctx.fillStyle = '#e6e6ff';
    ctx.font = '600 24px system-ui, sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText(`SCORE ${this.score}`, 20, 20);
    ctx.restore();
  }
}

