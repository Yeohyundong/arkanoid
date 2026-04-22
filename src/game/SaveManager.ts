const STORAGE_KEY = 'arkanoid:save:v1';

interface Checkpoint {
  stageIndex: number;
  lives: number;
  score: number;
}

interface Persisted {
  checkpoint: Checkpoint | null;
  highScore: number;
}

export class SaveManager {
  private data: Persisted;

  constructor() {
    this.data = this.read();
  }

  get checkpoint(): Checkpoint | null {
    return this.data.checkpoint;
  }

  get highScore(): number {
    return this.data.highScore;
  }

  hasCheckpoint(): boolean {
    return this.data.checkpoint !== null;
  }

  saveCheckpoint(stageIndex: number, lives: number, score: number): void {
    this.data.checkpoint = { stageIndex, lives, score };
    this.write();
  }

  clearCheckpoint(): void {
    if (this.data.checkpoint === null) return;
    this.data.checkpoint = null;
    this.write();
  }

  submitHighScore(score: number): boolean {
    if (score <= this.data.highScore) return false;
    this.data.highScore = score;
    this.write();
    return true;
  }

  private read(): Persisted {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { checkpoint: null, highScore: 0 };
      const parsed = JSON.parse(raw);
      return {
        checkpoint: this.parseCheckpoint(parsed.checkpoint),
        highScore: Number(parsed.highScore) || 0,
      };
    } catch {
      return { checkpoint: null, highScore: 0 };
    }
  }

  private parseCheckpoint(v: unknown): Checkpoint | null {
    if (!v || typeof v !== 'object') return null;
    const c = v as Record<string, unknown>;
    const stageIndex = Number(c.stageIndex);
    const lives = Number(c.lives);
    const score = Number(c.score);
    if (!Number.isFinite(stageIndex) || !Number.isFinite(lives) || !Number.isFinite(score)) return null;
    return { stageIndex, lives, score };
  }

  private write(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch {
      // localStorage unavailable or full — ignore
    }
  }
}
