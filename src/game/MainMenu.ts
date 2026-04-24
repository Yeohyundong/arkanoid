export type MenuAction = 'arcade-new' | 'arcade-continue' | 'wave-new';

interface Button {
  action: MenuAction;
  label: string;
  sub?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  enabled: boolean;
  accent: string;
}

export class MainMenu {
  private readonly worldW: number;
  private readonly worldH: number;
  private buttons: Button[] = [];
  private canContinue = false;
  private arcadeHigh = 0;
  private waveHigh = 0;

  constructor(worldW: number, worldH: number) {
    this.worldW = worldW;
    this.worldH = worldH;
    this.rebuildButtons();
  }

  setState(canContinue: boolean, arcadeHigh: number, waveHigh: number): void {
    this.canContinue = canContinue;
    this.arcadeHigh = arcadeHigh;
    this.waveHigh = waveHigh;
    this.rebuildButtons();
  }

  hitTest(x: number, y: number): MenuAction | null {
    for (const b of this.buttons) {
      if (!b.enabled) continue;
      if (x < b.x || x > b.x + b.width) continue;
      if (y < b.y || y > b.y + b.height) continue;
      return b.action;
    }
    return null;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, this.worldW, this.worldH);

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.shadowColor = '#ff3df4';
    ctx.shadowBlur = 24;
    ctx.fillStyle = '#ff3df4';
    ctx.font = '800 72px system-ui, sans-serif';
    ctx.fillText('ARKANOID', this.worldW / 2, 220);

    ctx.shadowBlur = 0;

    for (const b of this.buttons) this.drawButton(ctx, b);

    ctx.restore();
  }

  private drawButton(ctx: CanvasRenderingContext2D, b: Button): void {
    const cx = b.x + b.width / 2;
    const cy = b.y + b.height / 2;
    const color = b.enabled ? b.accent : '#3a3a4a';

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    if (b.enabled) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 16;
    }
    ctx.strokeRect(b.x, b.y, b.width, b.height);
    ctx.restore();

    const hasSub = !!b.sub;
    ctx.fillStyle = color;
    ctx.font = '700 26px system-ui, sans-serif';
    ctx.fillText(b.label, cx, hasSub ? cy - 10 : cy);

    if (b.sub) {
      ctx.fillStyle = b.enabled ? '#8a8ab0' : '#3a3a4a';
      ctx.font = '500 14px system-ui, sans-serif';
      ctx.fillText(b.sub, cx, cy + 16);
    }
  }

  private rebuildButtons(): void {
    const width = 320;
    const height = 70;
    const x = (this.worldW - width) / 2;

    this.buttons = [
      {
        action: 'arcade-new',
        label: 'ARCADE',
        sub: `BEST ${this.arcadeHigh}`,
        x,
        y: 360,
        width,
        height,
        enabled: true,
        accent: '#ffc94a',
      },
      {
        action: 'arcade-continue',
        label: 'CONTINUE',
        sub: 'arcade checkpoint',
        x,
        y: 440,
        width,
        height,
        enabled: this.canContinue,
        accent: '#8abfff',
      },
      {
        action: 'wave-new',
        label: 'WAVE',
        sub: `BEST ${this.waveHigh}`,
        x,
        y: 580,
        width,
        height,
        enabled: true,
        accent: '#2effa2',
      },
    ];
  }
}
