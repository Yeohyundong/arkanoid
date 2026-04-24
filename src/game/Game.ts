import { Ball } from './Ball';
import { Paddle } from './Paddle';
import { InputHandler } from './InputHandler';
import { Brick } from './Brick';
import { loadStage, STAGE_COUNT } from './Stage';
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

type GameState = 'menu' | 'playing' | 'cleared' | 'ending';

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
  private stageIndex = 0;
  private baseSpeed = 500;
  private state: GameState = 'menu';
  private lastTime = 0;
  private running = false;
  private ballAttached = true;
  private floaters: ComboFloater[] = [];
  private nextItemSpawnAt = 0;

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
    this.baseSpeed = data.baseSpeed;
    this.balls = [new Ball(this.paddle.x, this.paddle.top - 10, this.baseSpeed)];
    this.items = [];
    this.ballAttached = true;
    this.floaters = [];
    this.nextItemSpawnAt = performance.now() + ITEM_BLOCK_SPAWN_INTERVAL_MS;
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

    if (this.ballAttached && this.balls.length > 0) {
      const ball = this.balls[0];
      const attachOffset = (LAUNCH_ANGLE / MAX_REFLECT_ANGLE) * (this.paddle.width / 2);
      ball.x = this.paddle.x + attachOffset;
      ball.y = this.paddle.top - ball.radius;
      if (tapped) this.launchBall();
      return;
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
      this.checkStageClear();
      if (this.state !== 'playing') return;
    }
    this.handleBottomOut();
  }

  private tickItemBlocks(): void {
    const now = performance.now();

    for (const brick of this.bricks) {
      if (!brick.itemType || brick.destroyed) continue;
      if (now - brick.itemSpawnedAt >= ITEM_BLOCK_LIFETIME_MS) {
        brick.itemType = null;
        brick.itemSpawnedAt = 0;
      }
    }

    if (now < this.nextItemSpawnAt) return;
    this.nextItemSpawnAt = now + ITEM_BLOCK_SPAWN_INTERVAL_MS;

    if (this.ballAttached) return;

    const eligible: Brick[] = [];
    let maxY = -Infinity;
    for (const b of this.bricks) {
      if (b.destroyed || b.itemType) continue;
      if (b.y > maxY) maxY = b.y;
    }
    if (!isFinite(maxY)) return;
    for (const b of this.bricks) {
      if (b.destroyed || b.itemType) continue;
      if (Math.abs(b.y - maxY) < 1) eligible.push(b);
    }
    if (eligible.length === 0) return;

    const pick = eligible[Math.floor(Math.random() * eligible.length)];
    pick.itemType = ITEM_POOL[Math.floor(Math.random() * ITEM_POOL.length)];
    pick.itemSpawnedAt = now;
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
    if (this.balls.length === 0) {
      this.balls = [new Ball(this.paddle.x, this.paddle.top - 10, this.baseSpeed)];
      this.ballAttached = true;
    }
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
    for (const item of this.items) item.draw(ctx);
    this.paddle.draw(ctx);
    for (const ball of this.balls) ball.draw(ctx);
    this.drawFloaters();
    this.drawHud();

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
