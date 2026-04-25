export class AudioManager {
  private ctx: AudioContext | null = null;

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
