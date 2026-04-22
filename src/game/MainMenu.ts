export type MenuAction = 'new-game' | 'continue';

interface Button {
  action: MenuAction;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  enabled: boolean;
}

export class MainMenu {
  private readonly worldW: number;
  private readonly worldH: number;
  private buttons: Button[] = [];
  private canContinue = false;
  private highScore = 0;

  constructor(worldW: number, worldH: number) {
    this.worldW = worldW;
    this.worldH = worldH;
    this.rebuildButtons();
  }

  setState(canContinue: boolean, highScore: number): void {
    this.canContinue = canContinue;
    this.highScore = highScore;
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
    ctx.fillText('ARKANOID', this.worldW / 2, 260);

    ctx.shadowBlur = 0;
    ctx.fillStyle = '#8a8ab0';
    ctx.font = '500 18px system-ui, sans-serif';
    ctx.fillText(`BEST  ${this.highScore}`, this.worldW / 2, 340);

    for (const b of this.buttons) this.drawButton(ctx, b);

    ctx.restore();
  }

  private drawButton(ctx: CanvasRenderingContext2D, b: Button): void {
    const cx = b.x + b.width / 2;
    const cy = b.y + b.height / 2;
    const color = b.enabled ? '#2effa2' : '#3a3a4a';

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    if (b.enabled) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 16;
    }
    ctx.strokeRect(b.x, b.y, b.width, b.height);
    ctx.restore();

    ctx.fillStyle = color;
    ctx.font = '700 28px system-ui, sans-serif';
    ctx.fillText(b.label, cx, cy);
  }

  private rebuildButtons(): void {
    const width = 320;
    const height = 72;
    const x = (this.worldW - width) / 2;

    this.buttons = [
      {
        action: 'new-game',
        label: 'NEW GAME',
        x,
        y: 480,
        width,
        height,
        enabled: true,
      },
      {
        action: 'continue',
        label: 'CONTINUE',
        x,
        y: 580,
        width,
        height,
        enabled: this.canContinue,
      },
    ];
  }
}
