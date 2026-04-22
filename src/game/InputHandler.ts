export class InputHandler {
  private readonly canvas: HTMLCanvasElement;
  private readonly worldW: number;
  private readonly worldH: number;
  private pointerWorldX: number | null = null;
  private pointerWorldY: number | null = null;
  private tapPending = false;

  constructor(canvas: HTMLCanvasElement, worldW: number, worldH: number) {
    this.canvas = canvas;
    this.worldW = worldW;
    this.worldH = worldH;
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerdown', this.onPointerDown);
  }

  getPointerX(): number | null {
    return this.pointerWorldX;
  }

  getPointerY(): number | null {
    return this.pointerWorldY;
  }

  consumeTap(): boolean {
    if (!this.tapPending) return false;
    this.tapPending = false;
    return true;
  }

  private updatePointer(e: PointerEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const ratioX = this.worldW / rect.width;
    const ratioY = this.worldH / rect.height;
    this.pointerWorldX = (e.clientX - rect.left) * ratioX;
    this.pointerWorldY = (e.clientY - rect.top) * ratioY;
  }

  private readonly onPointerMove = (e: PointerEvent): void => {
    this.updatePointer(e);
  };

  private readonly onPointerDown = (e: PointerEvent): void => {
    this.updatePointer(e);
    this.tapPending = true;
  };
}
