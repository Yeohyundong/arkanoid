const STORAGE_KEY = 'arkanoid:save:v4';

interface ArcadeCheckpoint {
  stageIndex: number;
  score: number;
  lives: number;
}

interface Persisted {
  arcadeHighScore: number;
  waveHighScore: number;
  arcadeCheckpoint: ArcadeCheckpoint | null;
}

export class SaveManager {
  private data: Persisted;

  constructor() {
    this.data = this.read();
  }

  get arcadeHighScore(): number {
    return this.data.arcadeHighScore;
  }

  get waveHighScore(): number {
    return this.data.waveHighScore;
  }

  get arcadeCheckpoint(): ArcadeCheckpoint | null {
    return this.data.arcadeCheckpoint;
  }

  hasArcadeCheckpoint(): boolean {
    return this.data.arcadeCheckpoint !== null;
  }

  saveArcadeCheckpoint(stageIndex: number, score: number, lives: number): void {
    this.data.arcadeCheckpoint = { stageIndex, score, lives };
    this.write();
  }

  clearArcadeCheckpoint(): void {
    if (this.data.arcadeCheckpoint === null) return;
    this.data.arcadeCheckpoint = null;
    this.write();
  }

  submitArcadeHighScore(score: number): boolean {
    if (score <= this.data.arcadeHighScore) return false;
    this.data.arcadeHighScore = score;
    this.write();
    return true;
  }

  submitWaveHighScore(score: number): boolean {
    if (score <= this.data.waveHighScore) return false;
    this.data.waveHighScore = score;
    this.write();
    return true;
  }

  private read(): Persisted {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return this.defaults();
      const parsed = JSON.parse(raw);
      return {
        arcadeHighScore: Number(parsed.arcadeHighScore) || 0,
        waveHighScore: Number(parsed.waveHighScore) || 0,
        arcadeCheckpoint: this.parseCheckpoint(parsed.arcadeCheckpoint),
      };
    } catch {
      return this.defaults();
    }
  }

  private defaults(): Persisted {
    return { arcadeHighScore: 0, waveHighScore: 0, arcadeCheckpoint: null };
  }

  private parseCheckpoint(v: unknown): ArcadeCheckpoint | null {
    if (!v || typeof v !== 'object') return null;
    const c = v as Record<string, unknown>;
    const stageIndex = Number(c.stageIndex);
    const score = Number(c.score);
    const lives = Number(c.lives);
    if (!Number.isFinite(stageIndex) || !Number.isFinite(score) || !Number.isFinite(lives)) return null;
    return { stageIndex, score, lives };
  }

  private write(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch {
      // localStorage unavailable or full — ignore
    }
  }
}
