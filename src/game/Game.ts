import { Ball } from './Ball';
import { Paddle } from './Paddle';
import { InputHandler } from './InputHandler';
import { Brick } from './Brick';
import {
  loadArcadeStage,
  ARCADE_STAGE_COUNT,
  loadInitialWave,
  generateWaveRow,
  getWaveIntervalMs,
  BRICK_HEIGHT,
  GRID_COLS,
  BASE_SPEED,
} from './Stage';
import { SaveManager } from './SaveManager';
import { MainMenu } from './MainMenu';
import { HEAT_TIERS } from './Heat';
import type { HeatTier } from './Heat';
import { Item, ITEM_POOL } from './Item';
import type { ItemType } from './Item';

export const GAME_WIDTH = 540;
export const GAME_HEIGHT = 960;

const MAX_REFLECT_ANGLE = Math.PI / 3;
const LAUNCH_ANGLE = Math.PI / 6;
const BRICK_SCORE = 10;
const FLOATER_MS_SMALL = 700;
const FLOATER_MS_BIG = 1000;
const MULTIBALL_ANGLE_OFFSET = Math.PI / 6;
const ITEM_BLOCK_SPAWN_INTERVAL_MS = 4000;
const ITEM_BLOCK_LIFETIME_MS = 10000;
const ENLARGE_DURATION_MS = 8000;
const FIREBALL_DURATION_MS = 5000;
const HEAT_BOOST_STACKS = 15;
const THRESHOLD_ROWS_ABOVE_PADDLE = 3;
const ITEM_BLOCK_BODY_COLOR = '#1e1e2e';
const ARCADE_STARTING_LIVES = 3;

type GameState = 'menu' | 'playing' | 'cleared' | 'ending';
type GameMode = 'arcade' | 'wave';

interface ComboFloater {
  x: number;
  y: number;
  value: number;
  tier: HeatTier;
  bornAt: number;
  big: boolean;
}

export class Game {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly paddle: Paddle;
  private readonly input: InputHandler;
  private readonly save: SaveManager;
  private readonly menu: MainMenu;
  private balls: Ball[] = [];
  private bricks: Brick[] = [];
  private items: Item[] = [];
  private score = 0;
  private baseSpeed = BASE_SPEED;
  private state: GameState = 'menu';
  private mode: GameMode = 'arcade';
  private lastTime = 0;
  private running = false;
  private ballAttached = true;
  private floaters: ComboFloater[] = [];
  private nextItemSpawnAt = 0;
  private stageIndex = 0;
  private arcadeLives = ARCADE_STARTING_LIVES;
  private waveNumber = 1;
  private nextWaveAt = 0;
  private thresholdY = 0;
  private lastRunNewBest = false;

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas context not available');
    this.ctx = ctx;

    canvas.width = GAME_WIDTH;
    canvas.height = GAME_HEIGHT;

    this.paddle = new Paddle(GAME_WIDTH, GAME_HEIGHT);
    this.balls = [new Ball(this.paddle.x, this.paddle.top - 10)];
    this.input = new InputHandler(canvas, GAME_WIDTH, GAME_HEIGHT);
    this.save = new SaveManager();
    this.menu = new MainMenu(GAME_WIDTH, GAME_HEIGHT);

    this.thresholdY = this.paddle.top - THRESHOLD_ROWS_ABOVE_PADDLE * BRICK_HEIGHT;
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

  private refreshMenu(): void {
    this.menu.setState(
      this.save.hasArcadeCheckpoint(),
      this.save.arcadeHighScore,
      this.save.waveHighScore,
    );
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
        if (this.input.consumeTap()) this.advanceArcadeStage();
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
    if (action === 'arcade-new') this.startArcadeNew();
    else if (action === 'arcade-continue') this.startArcadeContinue();
    else if (action === 'wave-new') this.startWaveNew();
  }

  private startArcadeNew(): void {
    this.save.clearArcadeCheckpoint();
    this.mode = 'arcade';
    this.score = 0;
    this.arcadeLives = ARCADE_STARTING_LIVES;
    this.loadArcade(0);
    this.state = 'playing';
    this.refreshMenu();
  }

  private startArcadeContinue(): void {
    const cp = this.save.arcadeCheckpoint;
    if (!cp) return;
    this.mode = 'arcade';
    this.score = cp.score;
    this.arcadeLives = cp.lives;
    this.loadArcade(cp.stageIndex);
    this.state = 'playing';
  }

  private startWaveNew(): void {
    this.mode = 'wave';
    this.score = 0;
    this.loadWave();
    this.state = 'playing';
  }

  private loadArcade(index: number): void {
    const data = loadArcadeStage(index, GAME_WIDTH);
    this.stageIndex = index;
    this.bricks = data.bricks;
    this.baseSpeed = data.baseSpeed;
    this.balls = [new Ball(this.paddle.x, this.paddle.top - 10, this.baseSpeed)];
    this.items = [];
    this.ballAttached = true;
    this.floaters = [];
    this.paddle.resetEffects();
    this.nextItemSpawnAt = performance.now() + ITEM_BLOCK_SPAWN_INTERVAL_MS;
  }

  private loadWave(): void {
    const data = loadInitialWave(GAME_WIDTH);
    this.bricks = data.bricks;
    this.baseSpeed = data.baseSpeed;
    this.balls = [new Ball(this.paddle.x, this.paddle.top - 10, this.baseSpeed)];
    this.items = [];
    this.ballAttached = true;
    this.floaters = [];
    this.paddle.resetEffects();
    this.waveNumber = 1;
    const now = performance.now();
    this.nextItemSpawnAt = now + ITEM_BLOCK_SPAWN_INTERVAL_MS;
    this.nextWaveAt = now + getWaveIntervalMs(this.waveNumber);
  }

  private updatePlaying(dt: number): void {
    const tapped = this.input.consumeTap();

    if (this.ballAttached && this.balls.length > 0) {
      const ball = this.balls[0];
      const attachOffset = (LAUNCH_ANGLE / MAX_REFLECT_ANGLE) * (this.paddle.width / 2);
      ball.x = this.paddle.x + attachOffset;
      ball.y = this.paddle.top - ball.radius;
      if (tapped) this.launchBall();
      return;
    }

    if (this.mode === 'wave') {
      this.tickWave();
      if (this.state !== 'playing') return;
    }

    this.tickItemBlocks();

    const stepDist = 10;
    const maxSpeed = this.balls.reduce((m, b) => Math.max(m, b.speed), 0);
    const steps = Math.max(1, Math.ceil(maxSpeed * dt / stepDist));
    const subDt = dt / steps;

    for (let i = 0; i < steps; i++) {
      for (const ball of this.balls) {
        const prevStack = ball.stack;
        ball.update(subDt, GAME_WIDTH);
        this.handlePaddleCollision(ball);
        this.handleBrickCollisions(ball);
        this.emitComboMilestones(ball, prevStack);
      }
      this.updateItems(subDt);
      if (this.mode === 'arcade') this.checkArcadeClear();
      if (this.state !== 'playing') return;
    }
    this.handleBottomOut();
  }

  private tickWave(): void {
    const now = performance.now();
    if (now < this.nextWaveAt) return;

    for (const brick of this.bricks) {
      if (brick.destroyed) continue;
      brick.y += BRICK_HEIGHT;
    }

    this.bricks = this.bricks.filter((b) => !b.destroyed);

    const newRow = generateWaveRow(this.waveNumber, GAME_WIDTH);
    this.bricks.push(...newRow);

    this.waveNumber += 1;
    this.nextWaveAt = now + getWaveIntervalMs(this.waveNumber);

    this.checkWaveGameOver();
  }

  private checkWaveGameOver(): void {
    for (const brick of this.bricks) {
      if (brick.destroyed) continue;
      if (brick.bottom > this.thresholdY) {
        this.endWaveGame();
        return;
      }
    }
  }

  private endWaveGame(): void {
    this.lastRunNewBest = this.save.submitWaveHighScore(this.score);
    this.state = 'ending';
  }

  private checkArcadeClear(): void {
    if (this.bricks.some((b) => !b.destroyed && !b.itemType)) return;

    const isFinal = this.stageIndex + 1 >= ARCADE_STAGE_COUNT;
    if (isFinal) {
      this.finalizeArcade();
    } else {
      this.save.saveArcadeCheckpoint(this.stageIndex + 1, this.score, this.arcadeLives);
      this.state = 'cleared';
    }
  }

  private finalizeArcade(): void {
    this.lastRunNewBest = this.save.submitArcadeHighScore(this.score);
    this.save.clearArcadeCheckpoint();
    this.state = 'ending';
  }

  private advanceArcadeStage(): void {
    this.loadArcade(this.stageIndex + 1);
    this.state = 'playing';
  }

  private tickItemBlocks(): void {
    const now = performance.now();

    for (let i = this.bricks.length - 1; i >= 0; i--) {
      const brick = this.bricks[i];
      if (!brick.itemType || brick.destroyed) continue;
      if (now - brick.itemSpawnedAt >= ITEM_BLOCK_LIFETIME_MS) {
        this.bricks.splice(i, 1);
      }
    }

    if (now < this.nextItemSpawnAt) return;
    this.nextItemSpawnAt = now + ITEM_BLOCK_SPAWN_INTERVAL_MS;

    if (this.ballAttached) return;

    let wallMaxY = -Infinity;
    for (const b of this.bricks) {
      if (b.destroyed || b.itemType) continue;
      if (b.y > wallMaxY) wallMaxY = b.y;
    }
    if (!isFinite(wallMaxY)) return;

    const itemY = wallMaxY + BRICK_HEIGHT;
    if (itemY + BRICK_HEIGHT / 2 > this.thresholdY) return;

    const brickW = GAME_WIDTH / GRID_COLS;
    const occupied = new Set<number>();
    for (const b of this.bricks) {
      if (b.destroyed) continue;
      if (Math.abs(b.y - itemY) < 1) {
        occupied.add(Math.round((b.x - brickW / 2) / brickW));
      }
    }
    const avail: number[] = [];
    for (let c = 0; c < GRID_COLS; c++) if (!occupied.has(c)) avail.push(c);
    if (avail.length === 0) return;

    const col = avail[Math.floor(Math.random() * avail.length)];
    const x = col * brickW + brickW / 2;
    const itemType = ITEM_POOL[Math.floor(Math.random() * ITEM_POOL.length)];
    const newBrick = new Brick(x, itemY, brickW, BRICK_HEIGHT, 1, ITEM_BLOCK_BODY_COLOR);
    newBrick.itemType = itemType;
    newBrick.itemSpawnedAt = now;
    this.bricks.push(newBrick);
  }

  private emitComboMilestones(ball: Ball, prevStack: number): void {
    const newStack = ball.stack;
    if (newStack <= prevStack) return;
    const now = performance.now();
    for (let s = prevStack + 1; s <= newStack; s++) {
      if (s % 5 !== 0) continue;
      const tierDef = HEAT_TIERS.find((t) => t.minStack === s);
      const big = !!tierDef;
      this.floaters.push({
        x: ball.x,
        y: ball.y,
        value: s,
        tier: ball.getHeatTier(),
        bornAt: now,
        big,
      });
    }
  }

  private launchBall(): void {
    if (this.balls.length === 0) return;
    this.balls[0].setDirection(Math.sin(LAUNCH_ANGLE), -Math.cos(LAUNCH_ANGLE));
    this.ballAttached = false;
  }

  private handlePaddleCollision(ball: Ball): void {
    const { paddle } = this;
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

  private handleBrickCollisions(ball: Ball): void {
    for (const brick of this.bricks) {
      if (brick.destroyed) continue;

      const cx = Math.max(brick.left, Math.min(ball.x, brick.right));
      const cy = Math.max(brick.top, Math.min(ball.y, brick.bottom));
      const dx = ball.x - cx;
      const dy = ball.y - cy;
      if (dx * dx + dy * dy > ball.radius * ball.radius) continue;

      if (!ball.isFireball) {
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
      }

      brick.damage();
      ball.accelerateOnBounce();
      this.awardBrickHitScore(ball);

      if (brick.destroyed && brick.itemType) {
        this.items.push(new Item(brick.x, brick.y, brick.itemType));
      }

      if (ball.isFireball) continue;
      return;
    }
  }

  private awardBrickHitScore(ball: Ball): void {
    const heatMult = HEAT_TIERS[ball.getHeatTier()].mult;
    this.score += Math.round(BRICK_SCORE * heatMult);
  }

  private updateItems(dt: number): void {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      item.update(dt);
      if (this.itemHitsPaddle(item)) {
        this.applyItemEffect(item.type);
        this.items.splice(i, 1);
        continue;
      }
      if (item.bottom > GAME_HEIGHT && item.vy > 0) {
        item.y = GAME_HEIGHT - item.height / 2;
        item.vy = -Math.abs(item.vy);
      } else if (item.top < 0 && item.vy < 0) {
        item.y = item.height / 2;
        item.vy = Math.abs(item.vy);
      }
    }
  }

  private itemHitsPaddle(item: Item): boolean {
    const { paddle } = this;
    return (
      item.right >= paddle.left &&
      item.left <= paddle.right &&
      item.bottom >= paddle.top &&
      item.top <= paddle.bottom
    );
  }

  private applyItemEffect(type: ItemType): void {
    switch (type) {
      case 'M': this.spawnMultiBall(); break;
      case 'E': this.paddle.enlarge(ENLARGE_DURATION_MS); break;
      case 'F': for (const b of this.balls) b.grantFireball(FIREBALL_DURATION_MS); break;
      case 'H': this.heatBoost(); break;
    }
  }

  private heatBoost(): void {
    for (const ball of this.balls) {
      const prev = ball.stack;
      ball.addHeatStacks(HEAT_BOOST_STACKS);
      this.emitComboMilestones(ball, prev);
    }
  }

  private spawnMultiBall(): void {
    if (this.balls.length === 0 || this.ballAttached) return;
    const primary = this.balls[0];
    const baseAngle = Math.atan2(primary.dirX, -primary.dirY);
    for (const delta of [MULTIBALL_ANGLE_OFFSET, -MULTIBALL_ANGLE_OFFSET]) {
      const newBall = new Ball(primary.x, primary.y, primary.baseSpeed);
      const angle = baseAngle + delta;
      newBall.setDirection(Math.sin(angle), -Math.cos(angle));
      newBall.speed = primary.speed;
      newBall.stack = primary.stack;
      this.balls.push(newBall);
    }
  }

  private handleBottomOut(): void {
    for (let i = this.balls.length - 1; i >= 0; i--) {
      const ball = this.balls[i];
      if (ball.y - ball.radius > GAME_HEIGHT) {
        this.balls.splice(i, 1);
      }
    }
    if (this.balls.length > 0) return;

    if (this.mode === 'arcade') {
      this.arcadeLives -= 1;
      if (this.arcadeLives <= 0) {
        this.finalizeArcade();
        return;
      }
    }
    this.balls = [new Ball(this.paddle.x, this.paddle.top - 10, this.baseSpeed)];
    this.ballAttached = true;
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

    if (this.mode === 'wave') this.drawThresholdLine();
    for (const brick of this.bricks) brick.draw(ctx);
    for (const item of this.items) item.draw(ctx);
    this.paddle.draw(ctx);
    for (const ball of this.balls) ball.draw(ctx);
    this.drawFloaters();
    this.drawHud();

    if (this.state !== 'playing') this.drawOverlay();
  }

  private drawThresholdLine(): void {
    const { ctx } = this;
    ctx.save();
    ctx.strokeStyle = '#ff3d5c';
    ctx.globalAlpha = 0.35;
    ctx.setLineDash([8, 8]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, this.thresholdY);
    ctx.lineTo(GAME_WIDTH, this.thresholdY);
    ctx.stroke();
    ctx.restore();
  }

  private drawHud(): void {
    const { ctx } = this;
    ctx.save();
    ctx.font = '600 22px system-ui, sans-serif';
    ctx.textBaseline = 'top';

    ctx.fillStyle = '#e6e6ff';
    ctx.textAlign = 'left';
    ctx.fillText(`SCORE ${this.score}`, 20, 16);

    if (this.mode === 'arcade') this.drawLifeIcons();

    ctx.textAlign = 'center';
    ctx.fillStyle = '#8a8ab0';
    ctx.font = '500 16px system-ui, sans-serif';
    const centerLabel = this.mode === 'arcade'
      ? `STAGE ${this.stageIndex + 1}/${ARCADE_STAGE_COUNT}`
      : `WAVE ${this.waveNumber}`;
    ctx.fillText(centerLabel, GAME_WIDTH / 2, 20);

    const savedBest = this.mode === 'arcade' ? this.save.arcadeHighScore : this.save.waveHighScore;
    ctx.font = '500 16px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillStyle = this.score > savedBest ? '#2effa2' : '#8a8ab0';
    const bestDisplay = Math.max(savedBest, this.score);
    ctx.fillText(`BEST ${bestDisplay}`, GAME_WIDTH - 20, 20);

    ctx.restore();
  }

  private drawLifeIcons(): void {
    const { ctx } = this;
    const iconRadius = 6;
    const gap = 6;
    const y = 54;
    ctx.save();
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 6;
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < this.arcadeLives; i++) {
      const cx = 20 + iconRadius + i * (iconRadius * 2 + gap);
      ctx.beginPath();
      ctx.arc(cx, y, iconRadius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawFloaters(): void {
    if (this.floaters.length === 0) return;
    const now = performance.now();
    const { ctx } = this;

    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      const duration = f.big ? FLOATER_MS_BIG : FLOATER_MS_SMALL;
      const age = now - f.bornAt;
      if (age >= duration) {
        this.floaters.splice(i, 1);
        continue;
      }
      const p = age / duration;
      const alpha = 1 - p;
      const rise = p * (f.big ? 60 : 40);
      const baseSize = f.big ? 32 : 18;
      const scale = f.big ? 1 + p * 0.35 : 1;
      const shake = f.big ? (Math.sin(age * 0.05) * (1 - p) * 3) : 0;
      const color = HEAT_TIERS[f.tier].color;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = color;
      ctx.shadowBlur = f.big ? 20 : 10;
      ctx.fillStyle = color;
      ctx.font = `${Math.round(baseSize * scale)}px system-ui, sans-serif`;
      ctx.fillText(String(f.value), f.x + shake, f.y - rise);
      ctx.restore();
    }
  }

  private drawOverlay(): void {
    const { ctx } = this;
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    if (this.state === 'cleared') {
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '800 56px system-ui, sans-serif';
      ctx.fillText('STAGE CLEAR', GAME_WIDTH / 2, GAME_HEIGHT / 2 - 20);

      ctx.fillStyle = '#c0c0ff';
      ctx.font = '500 20px system-ui, sans-serif';
      ctx.fillText('Tap to continue', GAME_WIDTH / 2, GAME_HEIGHT / 2 + 40);
    } else {
      // 'ending'
      const title = this.mode === 'wave' ? 'GAME OVER' : 'YOU WIN';
      const titleColor = this.mode === 'wave' ? '#ff3d5c' : '#2effa2';

      ctx.fillStyle = titleColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '800 56px system-ui, sans-serif';
      ctx.fillText(title, GAME_WIDTH / 2, GAME_HEIGHT / 2 - 80);

      ctx.fillStyle = '#e6e6ff';
      ctx.font = '700 40px system-ui, sans-serif';
      ctx.fillText(`SCORE  ${this.score}`, GAME_WIDTH / 2, GAME_HEIGHT / 2 - 10);

      if (this.lastRunNewBest) {
        ctx.fillStyle = '#2effa2';
        ctx.font = '700 22px system-ui, sans-serif';
        ctx.fillText('NEW BEST!', GAME_WIDTH / 2, GAME_HEIGHT / 2 + 30);
      } else {
        const savedBest = this.mode === 'arcade' ? this.save.arcadeHighScore : this.save.waveHighScore;
        ctx.fillStyle = '#8a8ab0';
        ctx.font = '500 20px system-ui, sans-serif';
        ctx.fillText(`BEST  ${savedBest}`, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 30);
      }

      ctx.fillStyle = '#c0c0ff';
      ctx.font = '500 20px system-ui, sans-serif';
      ctx.fillText('Tap to return', GAME_WIDTH / 2, GAME_HEIGHT / 2 + 90);
    }
    ctx.restore();
  }
}
