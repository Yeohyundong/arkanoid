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
import { Item, ITEM_POOL, ITEM_COLORS, ITEM_NAMES } from './Item';
import type { ItemType } from './Item';
import { AudioManager } from './Audio';

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
const LASER_DURATION_MS = 4000;
const LASER_FLASH_MS = 180;
const HEAT_BOOST_STACKS = 15;
const THRESHOLD_ROWS_ABOVE_PADDLE = 3;
const ITEM_BLOCK_BODY_COLOR = '#1e1e2e';
const ARCADE_STARTING_LIVES = 3;
const ARCADE_MAX_LIVES = 5;
const EXTRA_LIFE_STACK_STEP = 50;
const LIFE_GAIN_PULSE_MS = 1000;
const PAUSE_BUTTON_SIZE = 36;
const PAUSE_BUTTON_PAD = 14;
const PAUSE_MENU_BTN_W = 280;
const PAUSE_MENU_BTN_H = 64;

type GameState = 'menu' | 'playing' | 'paused' | 'cleared' | 'ending';
type GameMode = 'arcade' | 'wave';

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

type PauseAction = 'resume' | 'lobby';

interface ComboFloater {
  x: number;
  y: number;
  value: number;
  tier: HeatTier;
  bornAt: number;
  big: boolean;
  label?: string;
  colorOverride?: string;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  bornAt: number;
  size: number;
}

interface ShockRing {
  x: number;
  y: number;
  bornAt: number;
  color: string;
  maxRadius: number;
  lifetimeMs: number;
}

interface LaserFlash {
  axis: 'h' | 'v';
  pos: number;
  bornAt: number;
}

const PARTICLE_LIFETIME_MS = 480;
const PARTICLE_GRAVITY = 600;
const SHOCK_RING_BASE_RADIUS = 26;
const SHOCK_RING_BASE_LIFETIME_MS = 280;

const MAX_PARTICLES = 240;
const MAX_SHOCK_RINGS = 20;
const MAX_FLOATERS = 40;
const MAX_LASER_FLASHES = 10;

export class Game {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly paddle: Paddle;
  private readonly input: InputHandler;
  private readonly save: SaveManager;
  private readonly menu: MainMenu;
  private readonly audio: AudioManager;
  private particles: Particle[] = [];
  private shockRings: ShockRing[] = [];
  private laserFlashes: LaserFlash[] = [];
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
  private lifeGainedAt = 0;
  private waveNumber = 1;
  private nextWaveAt = 0;
  private thresholdY = 0;
  private lastRunNewBest = false;
  private readonly pauseButtonRect: Rect;
  private readonly pauseMenuButtons: { action: PauseAction; rect: Rect }[];

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
    this.audio = new AudioManager();

    this.thresholdY = this.paddle.top - THRESHOLD_ROWS_ABOVE_PADDLE * BRICK_HEIGHT;

    this.pauseButtonRect = {
      x: GAME_WIDTH - PAUSE_BUTTON_SIZE - PAUSE_BUTTON_PAD,
      y: PAUSE_BUTTON_PAD,
      w: PAUSE_BUTTON_SIZE,
      h: PAUSE_BUTTON_SIZE,
    };
    const menuBtnX = (GAME_WIDTH - PAUSE_MENU_BTN_W) / 2;
    this.pauseMenuButtons = [
      {
        action: 'resume',
        rect: { x: menuBtnX, y: GAME_HEIGHT / 2 - 50, w: PAUSE_MENU_BTN_W, h: PAUSE_MENU_BTN_H },
      },
      {
        action: 'lobby',
        rect: { x: menuBtnX, y: GAME_HEIGHT / 2 + 40, w: PAUSE_MENU_BTN_W, h: PAUSE_MENU_BTN_H },
      },
    ];

    this.refreshMenu();
    this.installPauseKey();
    this.updateCursorVisibility();

    if (import.meta.env.DEV) this.installDebugKeys();
  }

  private setState(next: GameState): void {
    this.state = next;
    this.updateCursorVisibility();
  }

  private updateCursorVisibility(): void {
    this.ctx.canvas.classList.toggle('show-cursor', this.state !== 'playing');
  }

  private installPauseKey(): void {
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.togglePause();
    });
  }

  private togglePause(): void {
    if (this.state === 'playing') this.setState('paused');
    else if (this.state === 'paused') this.setState('playing');
  }

  private exitToLobby(): void {
    this.refreshMenu();
    this.setState('menu');
  }

  private pointInRect(x: number, y: number, r: Rect): boolean {
    return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
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
      case 'paused':
        this.updatePaused();
        break;
      case 'cleared':
        if (this.input.consumeTap()) this.advanceArcadeStage();
        break;
      case 'ending':
        if (this.input.consumeTap()) this.returnToMenu();
        break;
    }
  }

  private updatePaused(): void {
    if (!this.input.consumeTap()) return;
    const x = this.input.getPointerX();
    const y = this.input.getPointerY();
    if (x === null || y === null) return;
    for (const b of this.pauseMenuButtons) {
      if (!this.pointInRect(x, y, b.rect)) continue;
      if (b.action === 'resume') this.setState('playing');
      else this.exitToLobby();
      return;
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
    this.setState('playing');
    this.refreshMenu();
  }

  private startArcadeContinue(): void {
    const cp = this.save.arcadeCheckpoint;
    if (!cp) return;
    this.mode = 'arcade';
    this.score = cp.score;
    this.arcadeLives = cp.lives;
    this.loadArcade(cp.stageIndex);
    this.setState('playing');
  }

  private startWaveNew(): void {
    this.mode = 'wave';
    this.score = 0;
    this.loadWave();
    this.setState('playing');
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

    if (tapped) {
      const px = this.input.getPointerX();
      const py = this.input.getPointerY();
      if (px !== null && py !== null && this.pointInRect(px, py, this.pauseButtonRect)) {
        this.setState('paused');
        return;
      }
    }

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
      this.updateParticles(subDt);
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
    this.setState('ending');
  }

  private checkArcadeClear(): void {
    if (this.bricks.some((b) => !b.destroyed && !b.itemType)) return;

    const isFinal = this.stageIndex + 1 >= ARCADE_STAGE_COUNT;
    if (isFinal) {
      this.finalizeArcade();
    } else {
      this.save.saveArcadeCheckpoint(this.stageIndex + 1, this.score, this.arcadeLives);
      this.setState('cleared');
    }
  }

  private finalizeArcade(): void {
    this.lastRunNewBest = this.save.submitArcadeHighScore(this.score);
    this.save.clearArcadeCheckpoint();
    this.setState('ending');
  }

  private advanceArcadeStage(): void {
    this.loadArcade(this.stageIndex + 1);
    this.setState('playing');
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
      if (s % EXTRA_LIFE_STACK_STEP === 0 && this.mode === 'arcade') {
        this.checkExtraLife(s, ball);
      }
      if (s % 5 !== 0) continue;
      const tierDef = HEAT_TIERS.find((t) => t.minStack === s);
      const big = !!tierDef;
      this.pushFloater({
        x: ball.x,
        y: ball.y,
        value: s,
        tier: ball.getHeatTier(),
        bornAt: now,
        big,
      });
    }
  }

  private checkExtraLife(stack: number, ball: Ball): void {
    const requiredTier = stack / EXTRA_LIFE_STACK_STEP;
    if (this.arcadeLives >= ARCADE_MAX_LIVES) return;
    if (this.arcadeLives >= requiredTier) return;
    this.grantExtraLife(ball);
  }

  private grantExtraLife(ball: Ball): void {
    this.arcadeLives = Math.min(ARCADE_MAX_LIVES, this.arcadeLives + 1);
    this.lifeGainedAt = performance.now();
    this.audio.itemPickup();
    this.pushFloater({
      x: ball.x,
      y: ball.y,
      value: 0,
      tier: 3,
      bornAt: performance.now(),
      big: true,
      label: '1UP!',
    });
  }

  private launchBall(): void {
    if (this.balls.length === 0) return;
    this.balls[0].setDirection(Math.sin(LAUNCH_ANGLE), -Math.cos(LAUNCH_ANGLE));
    this.ballAttached = false;
    this.audio.launch();
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
    this.audio.paddleHit();

    if (this.paddle.consumeMultiBallCharge()) {
      this.burstFromBall(ball);
    }
  }

  private handleBrickCollisions(ball: Ball): void {
    for (const brick of this.bricks) {
      if (brick.destroyed) continue;

      const cx = Math.max(brick.left, Math.min(ball.x, brick.right));
      const cy = Math.max(brick.top, Math.min(ball.y, brick.bottom));
      const dx = ball.x - cx;
      const dy = ball.y - cy;
      if (dx * dx + dy * dy > ball.radius * ball.radius) continue;

      const willPenetrate = ball.isFireball;

      if (!willPenetrate) {
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

      const dmg = HEAT_TIERS[ball.getHeatTier()].damage;
      brick.damage(dmg);
      if (ball.isFireball) ball.accelerateWithoutStack();
      else ball.accelerateOnBounce();
      this.awardBrickHitScore(ball);

      if (brick.destroyed) {
        this.spawnDestroyParticles(brick, ball.getHeatTier());
        this.spawnShockRing(brick, ball.getHeatTier());
        this.audio.brickDestroy();
        if (brick.itemType) {
          this.items.push(new Item(brick.x, brick.y, brick.itemType));
        }
      } else {
        this.audio.brickHit();
      }

      if (ball.isLaserHorizontal) this.applyLaserLineDamage(brick, 'h', ball);
      if (ball.isLaserVertical) this.applyLaserLineDamage(brick, 'v', ball);

      if (willPenetrate) continue;
      return;
    }
  }

  private applyLaserLineDamage(originBrick: Brick, axis: 'h' | 'v', ball: Ball): void {
    const heatMult = HEAT_TIERS[ball.getHeatTier()].mult;
    const tolerance = BRICK_HEIGHT / 2;

    if (this.laserFlashes.length >= MAX_LASER_FLASHES) this.laserFlashes.shift();
    this.laserFlashes.push({
      axis,
      pos: axis === 'h' ? originBrick.y : originBrick.x,
      bornAt: performance.now(),
    });

    for (const brick of this.bricks) {
      if (brick.destroyed) continue;
      if (brick === originBrick) continue;

      const onLine = axis === 'h'
        ? Math.abs(brick.y - originBrick.y) < tolerance
        : Math.abs(brick.x - originBrick.x) < originBrick.width / 2;
      if (!onLine) continue;

      brick.damage(1);
      this.score += Math.round(BRICK_SCORE * heatMult);

      if (brick.destroyed) {
        this.spawnDestroyParticles(brick, ball.getHeatTier());
        this.spawnShockRing(brick, ball.getHeatTier());
        if (brick.itemType) {
          this.items.push(new Item(brick.x, brick.y, brick.itemType));
        }
      }
    }
  }

  private spawnDestroyParticles(brick: Brick, tier: HeatTier): void {
    if (this.particles.length >= MAX_PARTICLES) return;
    const now = performance.now();
    const count = Math.min(10 + tier * 2, MAX_PARTICLES - this.particles.length);
    const speedMin = 130 + tier * 20;
    const speedMax = 280 + tier * 40;
    const sizeBoost = 1 + tier * 0.15;
    const tierColor = HEAT_TIERS[tier].color;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.7;
      const speed = speedMin + Math.random() * (speedMax - speedMin);
      const useTierColor = tier > 0 && Math.random() < 0.4;
      this.particles.push({
        x: brick.x,
        y: brick.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 60,
        color: useTierColor ? tierColor : brick.color,
        bornAt: now,
        size: (4 + Math.random() * 3) * sizeBoost,
      });
    }
  }

  private spawnShockRing(brick: Brick, tier: HeatTier): void {
    if (this.shockRings.length >= MAX_SHOCK_RINGS) {
      this.shockRings.shift();
    }
    const tierColor = HEAT_TIERS[tier].color;
    this.shockRings.push({
      x: brick.x,
      y: brick.y,
      bornAt: performance.now(),
      color: tier > 0 ? tierColor : brick.color,
      maxRadius: SHOCK_RING_BASE_RADIUS + tier * 14,
      lifetimeMs: SHOCK_RING_BASE_LIFETIME_MS + tier * 40,
    });
  }

  private updateParticles(dt: number): void {
    const now = performance.now();
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      if (now - p.bornAt > PARTICLE_LIFETIME_MS) {
        this.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += PARTICLE_GRAVITY * dt;
    }
    for (let i = this.shockRings.length - 1; i >= 0; i--) {
      if (now - this.shockRings[i].bornAt > this.shockRings[i].lifetimeMs) {
        this.shockRings.splice(i, 1);
      }
    }
    for (let i = this.laserFlashes.length - 1; i >= 0; i--) {
      if (now - this.laserFlashes[i].bornAt > LASER_FLASH_MS) {
        this.laserFlashes.splice(i, 1);
      }
    }
  }

  private drawParticles(): void {
    if (this.particles.length === 0) return;
    const now = performance.now();
    const { ctx } = this;
    ctx.save();
    for (const p of this.particles) {
      const t = (now - p.bornAt) / PARTICLE_LIFETIME_MS;
      if (t >= 1) continue;
      const alpha = 1 - t;
      const size = p.size * (1 - t * 0.55);
      ctx.globalAlpha = alpha;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 6;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - size / 2, p.y - size / 2, size, size);
    }
    ctx.restore();
  }

  private drawLaserFlashes(): void {
    if (this.laserFlashes.length === 0) return;
    const now = performance.now();
    const { ctx } = this;
    ctx.save();
    for (const f of this.laserFlashes) {
      const t = (now - f.bornAt) / LASER_FLASH_MS;
      if (t >= 1) continue;
      const alpha = 1 - t;
      const thickness = 10 * (1 - t * 0.4);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#c44dff';
      ctx.shadowColor = '#c44dff';
      ctx.shadowBlur = 22;
      if (f.axis === 'h') {
        ctx.fillRect(0, f.pos - thickness / 2, GAME_WIDTH, thickness);
      } else {
        ctx.fillRect(f.pos - thickness / 2, 0, thickness, GAME_HEIGHT);
      }
    }
    ctx.restore();
  }

  private drawShieldIndicator(): void {
    const { ctx } = this;
    const color = '#4a8eff';
    const pulse = 0.55 + 0.45 * Math.sin(performance.now() * 0.006);
    const y = GAME_HEIGHT - 3;
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.shadowColor = color;
    ctx.shadowBlur = 18;
    ctx.fillStyle = color;
    ctx.fillRect(0, y - 2, GAME_WIDTH, 3);
    ctx.restore();
  }

  private drawShockRings(): void {
    if (this.shockRings.length === 0) return;
    const now = performance.now();
    const { ctx } = this;
    ctx.save();
    for (const r of this.shockRings) {
      const t = (now - r.bornAt) / r.lifetimeMs;
      if (t >= 1) continue;
      const radius = r.maxRadius * (0.2 + t * 0.8);
      const alpha = (1 - t) * 0.7;
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 2.5 * (1 - t);
      ctx.shadowColor = r.color;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(r.x, r.y, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
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
        this.spawnItemPickupFloater(item);
        this.applyItemEffect(item.type);
        this.audio.itemPickup();
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

  private spawnItemPickupFloater(item: Item): void {
    this.pushFloater({
      x: item.x,
      y: this.paddle.top - 14,
      value: 0,
      tier: 0,
      bornAt: performance.now(),
      big: true,
      label: ITEM_NAMES[item.type],
      colorOverride: ITEM_COLORS[item.type],
    });
  }

  private pushFloater(f: ComboFloater): void {
    if (this.floaters.length >= MAX_FLOATERS) this.floaters.shift();
    this.floaters.push(f);
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
      case 'M': this.paddle.chargeMultiBall(); break;
      case 'E': this.paddle.enlarge(ENLARGE_DURATION_MS); break;
      case 'F': for (const b of this.balls) b.grantFireball(FIREBALL_DURATION_MS); break;
      case 'H': this.heatBoost(); break;
      case 'S': this.paddle.chargeShield(); break;
      case 'LH': for (const b of this.balls) b.grantLaserHorizontal(LASER_DURATION_MS); break;
      case 'LV': for (const b of this.balls) b.grantLaserVertical(LASER_DURATION_MS); break;
    }
  }

  private heatBoost(): void {
    for (const ball of this.balls) {
      const prev = ball.stack;
      ball.addHeatStacks(HEAT_BOOST_STACKS);
      this.emitComboMilestones(ball, prev);
    }
  }

  private burstFromBall(source: Ball): void {
    const baseAngle = Math.atan2(source.dirX, -source.dirY);
    for (const delta of [MULTIBALL_ANGLE_OFFSET, -MULTIBALL_ANGLE_OFFSET]) {
      const newBall = new Ball(source.x, source.y, source.baseSpeed);
      const angle = baseAngle + delta;
      newBall.setDirection(Math.sin(angle), -Math.cos(angle));
      newBall.speed = source.speed;
      newBall.stack = source.stack;
      this.balls.push(newBall);
    }
  }

  private handleBottomOut(): void {
    for (let i = this.balls.length - 1; i >= 0; i--) {
      const ball = this.balls[i];
      if (ball.y - ball.radius <= GAME_HEIGHT) continue;

      if (this.paddle.consumeShield()) {
        this.triggerShieldRescue(ball);
        continue;
      }
      this.balls.splice(i, 1);
    }
    if (this.balls.length > 0) return;

    if (this.mode === 'arcade') {
      this.arcadeLives -= 1;
      if (this.arcadeLives <= 0) {
        this.finalizeArcade();
        return;
      }
    }
    this.paddle.resetEffects();
    this.balls = [new Ball(this.paddle.x, this.paddle.top - 10, this.baseSpeed)];
    this.ballAttached = true;
  }

  private triggerShieldRescue(ball: Ball): void {
    ball.y = GAME_HEIGHT - ball.radius - 4;
    ball.dirY = -Math.abs(ball.dirY);
    this.shockRings.push({
      x: ball.x,
      y: GAME_HEIGHT - 2,
      bornAt: performance.now(),
      color: '#4a8eff',
      maxRadius: 80,
      lifetimeMs: 360,
    });
    this.audio.itemPickup();
  }

  private returnToMenu(): void {
    this.refreshMenu();
    this.setState('menu');
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
    if (this.paddle.hasShield) this.drawShieldIndicator();
    for (const brick of this.bricks) brick.draw(ctx);
    this.drawParticles();
    this.drawShockRings();
    this.drawLaserFlashes();
    for (const item of this.items) item.draw(ctx);
    this.paddle.draw(ctx);
    for (const ball of this.balls) ball.draw(ctx);
    this.drawFloaters();
    if (this.ballAttached && this.state === 'playing') this.drawLaunchHint();
    this.drawHud();

    if (this.state === 'paused') this.drawPauseOverlay();
    else if (this.state !== 'playing') this.drawOverlay();
  }

  private drawPauseOverlay(): void {
    const { ctx } = this;
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '800 48px system-ui, sans-serif';
    ctx.fillText('PAUSED', GAME_WIDTH / 2, GAME_HEIGHT / 2 - 140);

    for (const b of this.pauseMenuButtons) this.drawPauseMenuButton(b);

    const lobbyRect = this.pauseMenuButtons[1].rect;
    ctx.fillStyle = '#8a8ab0';
    ctx.font = '500 13px system-ui, sans-serif';
    const noticeY = lobbyRect.y + lobbyRect.h + 22;
    ctx.fillText('클리어한 스테이지는 저장돼요.', GAME_WIDTH / 2, noticeY);
    ctx.fillText('진행 중인 플레이는 저장되지 않아요.', GAME_WIDTH / 2, noticeY + 20);
    ctx.restore();
  }

  private drawPauseMenuButton(b: { action: PauseAction; rect: Rect }): void {
    const { ctx } = this;
    const accent = b.action === 'resume' ? '#2effa2' : '#ff8a8a';
    const cx = b.rect.x + b.rect.w / 2;
    const cy = b.rect.y + b.rect.h / 2;
    ctx.save();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    ctx.shadowColor = accent;
    ctx.shadowBlur = 16;
    ctx.strokeRect(b.rect.x, b.rect.y, b.rect.w, b.rect.h);
    ctx.shadowBlur = 0;
    ctx.fillStyle = accent;
    ctx.font = '700 24px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(b.action === 'resume' ? '재개하기' : '로비로 나가기', cx, cy);
    ctx.restore();
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
    ctx.fillText(`BEST ${bestDisplay}`, GAME_WIDTH - PAUSE_BUTTON_SIZE - PAUSE_BUTTON_PAD - 12, 20);

    ctx.restore();

    this.drawPauseButton();
  }

  private drawPauseButton(): void {
    const { ctx } = this;
    const r = this.pauseButtonRect;
    ctx.save();
    ctx.strokeStyle = '#8a8ab0';
    ctx.lineWidth = 2;
    ctx.strokeRect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = '#e6e6ff';
    const barW = 4;
    const barH = r.h * 0.5;
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    ctx.fillRect(cx - 7, cy - barH / 2, barW, barH);
    ctx.fillRect(cx + 3, cy - barH / 2, barW, barH);
    ctx.restore();
  }

  private drawLaunchHint(): void {
    if (this.balls.length === 0) return;
    const ball = this.balls[0];
    const pulse = 0.55 + 0.45 * Math.sin(performance.now() * 0.005);
    const { ctx } = this;
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#e6e6ff';
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 6;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '600 16px system-ui, sans-serif';
    ctx.fillText('TAP TO LAUNCH', ball.x, ball.y - 34);
    ctx.restore();
  }

  private drawLifeIcons(): void {
    const { ctx } = this;
    const iconRadius = 6;
    const gap = 8;
    const y = 54;
    const now = performance.now();
    const gainAge = now - this.lifeGainedAt;
    const gainPulse = gainAge < LIFE_GAIN_PULSE_MS
      ? 1 - gainAge / LIFE_GAIN_PULSE_MS
      : 0;
    const justGainedIdx = gainPulse > 0 ? this.arcadeLives - 1 : -1;

    ctx.save();
    for (let i = 0; i < ARCADE_MAX_LIVES; i++) {
      const cx = 20 + iconRadius + i * (iconRadius * 2 + gap);
      const filled = i < this.arcadeLives;

      if (filled) {
        const pulse = i === justGainedIdx ? gainPulse : 0;
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 6 + pulse * 14;
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.arc(cx, y, iconRadius + pulse * 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#3a3a4a';
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.arc(cx, y, iconRadius, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    if (this.arcadeLives < ARCADE_MAX_LIVES) {
      const nextIdx = this.arcadeLives;
      const requiredStack = (nextIdx + 1) * EXTRA_LIFE_STACK_STEP;
      const prevReq = nextIdx * EXTRA_LIFE_STACK_STEP;
      const currentStack = this.getMaxBallStack();
      const progress = Math.max(0, Math.min(1, (currentStack - prevReq) / (requiredStack - prevReq)));
      const cx = 20 + iconRadius + nextIdx * (iconRadius * 2 + gap);

      if (progress > 0) {
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = HEAT_TIERS[3].color;
        ctx.beginPath();
        ctx.arc(cx, y, (iconRadius - 1) * progress, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.shadowBlur = 0;
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = currentStack >= prevReq ? '#e6e6ff' : '#8a8ab0';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.font = '600 10px system-ui, sans-serif';
      ctx.fillText(`${Math.min(currentStack, requiredStack)}/${requiredStack}`, cx, y + iconRadius + 4);
    }
    ctx.restore();
  }

  private getMaxBallStack(): number {
    let max = 0;
    for (const b of this.balls) if (b.stack > max) max = b.stack;
    return max;
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
      const color = f.colorOverride ?? HEAT_TIERS[f.tier].color;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = color;
      ctx.shadowBlur = f.big ? 20 : 10;
      ctx.fillStyle = color;
      ctx.font = `${Math.round(baseSize * scale)}px system-ui, sans-serif`;
      const text = f.label ?? String(f.value);
      ctx.fillText(text, f.x + shake, f.y - rise);
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
