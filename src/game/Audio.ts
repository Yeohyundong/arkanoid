const BGM_SRC = '/audio/bgm.mp3';
const BGM_VOLUME = 0.35;
const LASER_THROTTLE_MS = 70;

export class AudioManager {
  private ctx: AudioContext | null = null;
  private bgm: HTMLAudioElement | null = null;
  private bgmStarted = false;
  private bgmPausedByGame = false;
  private lastLaserAt = 0;

  private ensureCtx(): AudioContext | null {
    if (!this.ctx) {
      try {
        const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return null;
        this.ctx = new Ctor();
      } catch {
        return null;
      }
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  private ensureBgm(): HTMLAudioElement | null {
    if (!this.bgm) {
      try {
        const audio = new Audio(BGM_SRC);
        audio.loop = true;
        audio.volume = BGM_VOLUME;
        audio.preload = 'auto';
        this.bgm = audio;
      } catch {
        return null;
      }
    }
    return this.bgm;
  }

  startBgm(): void {
    const audio = this.ensureBgm();
    if (!audio) return;
    if (this.bgmStarted && !audio.paused) return;
    this.bgmStarted = true;
    void audio.play().catch(() => {
      this.bgmStarted = false;
    });
  }

  pauseBgm(): void {
    const audio = this.bgm;
    if (!audio || audio.paused) return;
    audio.pause();
    this.bgmPausedByGame = true;
  }

  resumeBgm(): void {
    const audio = this.bgm;
    if (!audio || !this.bgmPausedByGame) return;
    this.bgmPausedByGame = false;
    void audio.play().catch(() => {});
  }

  paddleHit(): void {
    this.beep(180, 70, 'square', 0.1);
  }

  brickHit(): void {
    this.beep(420, 35, 'square', 0.08);
  }

  brickDestroy(): void {
    this.beep(680, 90, 'triangle', 0.14);
  }

  itemPickup(): void {
    this.sweep(440, 990, 140, 'sine', 0.18);
  }

  launch(): void {
    this.sweep(220, 440, 90, 'sine', 0.12);
  }

  rocketLaunch(): void {
    this.sweep(180, 720, 220, 'sawtooth', 0.1);
  }

  rocketExplode(): void {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    const thump = ctx.createOscillator();
    const thumpGain = ctx.createGain();
    thump.type = 'sine';
    thump.frequency.setValueAtTime(110, now);
    thump.frequency.exponentialRampToValueAtTime(35, now + 0.35);
    thumpGain.gain.setValueAtTime(0.32, now);
    thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    thump.connect(thumpGain).connect(ctx.destination);
    thump.start(now);
    thump.stop(now + 0.42);

    const noise = ctx.createBufferSource();
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.35, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    noise.buffer = buf;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.22, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1800;
    noise.connect(filter).connect(noiseGain).connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.36);
  }

  laserHit(): void {
    const now = performance.now();
    if (now - this.lastLaserAt < LASER_THROTTLE_MS) return;
    this.lastLaserAt = now;
    this.sweep(1400, 320, 110, 'square', 0.07);
  }

  private beep(freq: number, durationMs: number, type: OscillatorType, volume: number): void {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    const dur = durationMs / 1000;
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + dur);
  }

  private sweep(fromHz: number, toHz: number, durationMs: number, type: OscillatorType, volume: number): void {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    const dur = durationMs / 1000;
    osc.frequency.setValueAtTime(fromHz, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(toHz, ctx.currentTime + dur);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + dur);
  }
}
