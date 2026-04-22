import { Ball } from './Ball';
import { Paddle } from './Paddle';
import { InputHandler } from './InputHandler';
import { Brick } from './Brick';
import { loadStage, STAGE_COUNT } from './Stage';
import { SaveManager } from './SaveManager';
import { MainMenu } from './MainMenu';
import { HEAT_TIERS } from './Heat';
import type { HeatTier } from './Heat';

export const GAME_WIDTH = 540;
export const GAME_HEIGHT = 960;

const MAX_REFLECT_ANGLE = Math.PI / 3;
const LAUNCH_ANGLE = Math.PI / 6;
const BRICK_SCORE = 10;
const LEVEL_UP_DURATION_MS = 1000;

const COMBO_TIERS: readonly { min: number; mult: number }[] = [
  { min: 40, mult: 3 },
  { min: 20, mult: 2 },
  { min: 10, mult: 1.5 },
  { min: 5, mult: 1.2 },
];

function comboMult(combo: number): number {
  for (const tier of COMBO_TIERS) {
    if (combo >= tier.min) return tier.mult;
  }
  return 1;
}

type GameState = 'menu' | 'playing' | 'cleared' | 'ending';

export class Game {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly ball: Ball;
  private readonly paddle: Paddle;
  private readonly input: InputHandler;
  private readonly save: SaveManager;
  private readonly menu: MainMenu;
  private bricks: Brick[] = [];
  private score = 0;
  private stageIndex = 0;
  private state: GameState = 'menu';
  private lastTime = 0;
  private running = false;
  private ballAttached = true;
  private combo = 0;
  private prevHeatTier: HeatTier = 0;
  private levelUpAt = 0;
  private levelUpTier: HeatTier = 0;

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas context not available');
    this.ctx = ctx;

    canvas.width = GAME_WIDTH;
    canvas.height = GAME_HEIGHT;

    this.paddle = new Paddle(GAME_WIDTH, GAME_HEIGHT);
    this.ball = new Ball(this.paddle.x, this.paddle.top - 10);
    this.input = new InputHandler(canvas, GAME_WIDTH, GAME_HEIGHT);
    this.save = new SaveManager();
    this.menu = new MainMenu(GAME_WIDTH, GAME_HEIGHT);

    this.loadStage(0);
    this.refreshMenu();

    if (import.meta.env.DEV) this.installDebugKeys();
  }

  private installDebugKeys(): void {
    window.addEventListener('keydown', (e) => {
      if (e.key === 'n' || e.key === 'N') {
        for (const brick of this.bricks) brick.hp = 0;
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
    this.combo = 0;
    this.prevHeatTier = 0;
  }

  private refreshMenu(): void {
    this.menu.setState(this.save.hasCheckpoint(), this.save.highScore);
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
    if (pointerX !== null && this.state === 'playing') {
      this.paddle.setTargetX(pointerX, GAME_WIDTH);
    }

    switch (this.state) {
      case 'menu':
        this.updateMenu();
        break;
      case 'playing':
        this.updatePlaying(dt);
        break;
      case 'cleared':
        if (this.input.consumeTap()) this.advanceStage();
        break;
      case 'ending':
        if (this.input.consumeTap()) this.returnToMenu();
        break;
    }
  }

  private updateMenu(): void {
    if (!this.input.consumeTap()) return;
    const x = this.input.getPointerX();
    const y = this.input.getPointerY();
    if (x === null || y === null) return;

    const action = this.menu.hitTest(x, y);
    if (action === 'new-game') this.startNewGame();
    else if (action === 'continue') this.continueFromSave();
  }

  private startNewGame(): void {
    this.save.clearCheckpoint();
    this.refreshMenu();
    this.score = 0;
    this.loadStage(0);
    this.state = 'playing';
  }

  private continueFromSave(): void {
    const cp = this.save.checkpoint;
    if (!cp) return;
    this.score = cp.score;
    this.loadStage(cp.stageIndex);
    this.state = 'playing';
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

    const stepDist = this.ball.radius;
    const steps = Math.max(1, Math.ceil(this.ball.speed * dt / stepDist));
    const subDt = dt / steps;

    for (let i = 0; i < steps; i++) {
      this.ball.update(subDt, GAME_WIDTH);
      this.handlePaddleCollision();
      this.handleBrickCollisions();
      this.detectHeatTierChange();
      this.checkStageClear();
      if (this.state !== 'playing') return;
      if (this.ball.y - this.ball.radius > GAME_HEIGHT) break;
    }
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
    this.combo = 0;
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

      brick.damage();
      ball.accelerateOnBounce();
      this.combo += 1;
      this.awardBrickHitScore();
      return;
    }
  }

  private awardBrickHitScore(): void {
    const heatMult = HEAT_TIERS[this.ball.getHeatTier()].mult;
    const cMult = comboMult(this.combo);
    this.score += Math.round(BRICK_SCORE * heatMult * cMult);
  }

  private detectHeatTierChange(): void {
    const tier = this.ball.getHeatTier();
    if (tier > this.prevHeatTier) {
      this.levelUpAt = performance.now();
      this.levelUpTier = tier;
    }
    this.prevHeatTier = tier;
  }

  private handleBottomOut(): void {
    if (this.ball.y - this.ball.radius <= GAME_HEIGHT) return;
    this.combo = 0;
    this.ball.resetSpeed();
    this.ballAttached = true;
    this.prevHeatTier = 0;
  }

  private checkStageClear(): void {
    if (this.bricks.some((b) => !b.destroyed)) return;

    const isFinal = this.stageIndex + 1 >= STAGE_COUNT;
    if (isFinal) {
      this.save.submitHighScore(this.score);
      this.save.clearCheckpoint();
      this.state = 'ending';
    } else {
      this.save.saveCheckpoint(this.stageIndex + 1, this.score);
      this.state = 'cleared';
    }
  }

  private advanceStage(): void {
    this.loadStage(this.stageIndex + 1);
    this.state = 'playing';
  }

  private returnToMenu(): void {
    this.refreshMenu();
    this.state = 'menu';
  }

  private draw(): void {
    const { ctx } = this;

    if (this.state === 'menu') {
      this.menu.draw(ctx);
      return;
    }

    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    for (const brick of this.bricks) brick.draw(ctx);
    this.paddle.draw(ctx);
    this.ball.draw(ctx);
    this.drawHud();
    this.drawLevelUp();

    if (this.state !== 'playing') this.drawOverlay();
  }

  private drawHud(): void {
    const { ctx } = this;
    ctx.save();
    ctx.font = '600 22px system-ui, sans-serif';
    ctx.textBaseline = 'top';

    ctx.fillStyle = '#e6e6ff';
    ctx.textAlign = 'left';
    ctx.fillText(`SCORE ${this.score}`, 20, 16);

    ctx.textAlign = 'center';
    ctx.fillText(`STAGE ${this.stageIndex + 1}`, GAME_WIDTH / 2, 16);

    ctx.font = '600 16px system-ui, sans-serif';
    ctx.textAlign = 'left';
    const cMult = comboMult(this.combo);
    ctx.fillStyle = this.combo >= 5 ? '#2effa2' : '#8a8ab0';
    ctx.fillText(`COMBO ${this.combo}  ×${cMult}`, 20, 52);

    const tier = this.ball.getHeatTier();
    const tierDef = HEAT_TIERS[tier];
    ctx.textAlign = 'right';
    ctx.fillStyle = tierDef.color;
    ctx.fillText(`${tierDef.name}  ×${tierDef.mult}`, GAME_WIDTH - 20, 52);

    ctx.restore();
  }

  private drawLevelUp(): void {
    const elapsed = performance.now() - this.levelUpAt;
    if (elapsed >= LEVEL_UP_DURATION_MS) return;

    const progress = elapsed / LEVEL_UP_DURATION_MS;
    const alpha = 1 - progress;
    const scale = 1 + progress * 0.4;
    const tierDef = HEAT_TIERS[this.levelUpTier];

    const { ctx } = this;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.translate(GAME_WIDTH / 2, GAME_HEIGHT / 2);
    ctx.scale(scale, scale);

    ctx.shadowColor = tierDef.color;
    ctx.shadowBlur = 24;
    ctx.fillStyle = tierDef.color;
    ctx.font = '800 56px system-ui, sans-serif';
    ctx.fillText('LEVEL UP!', 0, -14);

    ctx.font = '700 28px system-ui, sans-serif';
    ctx.fillText(`${tierDef.name}  ×${tierDef.mult}`, 0, 30);

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
    } else if (this.state === 'ending') {
      title = 'YOU WIN';
      subtitle = `TOTAL ${this.score} · Tap to return`;
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
