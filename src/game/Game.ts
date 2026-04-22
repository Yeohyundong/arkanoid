import { Ball } from './Ball';
import { Paddle } from './Paddle';
import { InputHandler } from './InputHandler';
import { Brick } from './Brick';
import { loadStage, STAGE_COUNT } from './Stage';

export const GAME_WIDTH = 540;
export const GAME_HEIGHT = 960;

const MAX_REFLECT_ANGLE = Math.PI / 3;
const LAUNCH_ANGLE = Math.PI / 6;
const BRICK_SCORE = 10;
const INITIAL_LIVES = 3;

type GameState = 'playing' | 'cleared' | 'gameover' | 'ending';

export class Game {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly ball: Ball;
  private readonly paddle: Paddle;
  private readonly input: InputHandler;
  private bricks: Brick[] = [];
  private score = 0;
  private lives = INITIAL_LIVES;
  private stageIndex = 0;
  private state: GameState = 'playing';
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

    this.loadStage(0);

    if (import.meta.env.DEV) this.installDebugKeys();
  }

  private installDebugKeys(): void {
    window.addEventListener('keydown', (e) => {
      if (e.key === 'n' || e.key === 'N') {
        for (const brick of this.bricks) brick.destroyed = true;
      }
    });
  }

  start(): void {
    this.running = true;
    this.lastTime = performance.now();
    requestAnimationFrame(this.tick);
  }

  private loadStage(index: number): void {
    const data = loadStage(index, GAME_WIDTH);
    this.stageIndex = index;
    this.bricks = data.bricks;
    this.ball.setBaseSpeed(data.baseSpeed);
    this.ballAttached = true;
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

    switch (this.state) {
      case 'playing':
        this.updatePlaying(dt);
        break;
      case 'cleared':
        if (this.input.consumeTap()) this.advanceStage();
        break;
      case 'gameover':
      case 'ending':
        if (this.input.consumeTap()) this.restart();
        break;
    }
  }

  private updatePlaying(dt: number): void {
    const tapped = this.input.consumeTap();

    if (this.ballAttached) {
      const attachOffset = (LAUNCH_ANGLE / MAX_REFLECT_ANGLE) * (this.paddle.width / 2);
      this.ball.x = this.paddle.x + attachOffset;
      this.ball.y = this.paddle.top - this.ball.radius;
      if (tapped) this.launchBall();
      return;
    }

    this.ball.update(dt, GAME_WIDTH);
    this.handlePaddleCollision();
    this.handleBrickCollisions();
    this.checkStageClear();
    if (this.state === 'playing') this.handleBottomOut();
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
    if (this.ball.y - this.ball.radius <= GAME_HEIGHT) return;
    this.lives -= 1;
    if (this.lives <= 0) {
      this.state = 'gameover';
      return;
    }
    this.ball.resetSpeed();
    this.ballAttached = true;
  }

  private checkStageClear(): void {
    if (this.bricks.some((b) => !b.destroyed)) return;
    this.state = this.stageIndex + 1 >= STAGE_COUNT ? 'ending' : 'cleared';
  }

  private advanceStage(): void {
    this.loadStage(this.stageIndex + 1);
    this.state = 'playing';
  }

  private restart(): void {
    this.score = 0;
    this.lives = INITIAL_LIVES;
    this.loadStage(0);
    this.state = 'playing';
  }

  private draw(): void {
    const { ctx } = this;
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    for (const brick of this.bricks) brick.draw(ctx);
    this.paddle.draw(ctx);
    this.ball.draw(ctx);
    this.drawHud();

    if (this.state !== 'playing') this.drawOverlay();
  }

  private drawHud(): void {
    const { ctx } = this;
    ctx.save();
    ctx.fillStyle = '#e6e6ff';
    ctx.font = '600 22px system-ui, sans-serif';
    ctx.textBaseline = 'top';

    ctx.textAlign = 'left';
    ctx.fillText(`SCORE ${this.score}`, 20, 20);

    ctx.textAlign = 'center';
    ctx.fillText(`STAGE ${this.stageIndex + 1}`, GAME_WIDTH / 2, 20);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#ff6a9a';
    ctx.fillText(`${'♥'.repeat(this.lives)}`, GAME_WIDTH - 20, 20);
    ctx.restore();
  }

  private drawOverlay(): void {
    const { ctx } = this;
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    let title = '';
    let subtitle = '';
    if (this.state === 'cleared') {
      title = 'STAGE CLEAR';
      subtitle = 'Tap to continue';
    } else if (this.state === 'gameover') {
      title = 'GAME OVER';
      subtitle = 'Tap to restart';
    } else if (this.state === 'ending') {
      title = 'YOU WIN';
      subtitle = `TOTAL ${this.score} · Tap to restart`;
    }

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 56px system-ui, sans-serif';
    ctx.fillText(title, GAME_WIDTH / 2, GAME_HEIGHT / 2 - 30);

    ctx.font = '500 22px system-ui, sans-serif';
    ctx.fillStyle = '#c0c0ff';
    ctx.fillText(subtitle, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 30);
    ctx.restore();
  }
}
