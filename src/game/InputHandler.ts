export class InputHandler {
  private readonly canvas: HTMLCanvasElement;
  private readonly worldW: number;
  private pointerWorldX: number | null = null;
  private tapPending = false;

  constructor(canvas: HTMLCanvasElement, worldW: number) {
    this.canvas = canvas;
    this.worldW = worldW;
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerdown', this.onPointerDown);
  }

  getPointerX(): number | null {
    return this.pointerWorldX;
  }

  consumeTap(): boolean {
    if (!this.tapPending) return false;
    this.tapPending = false;
    return true;
  }

  private updatePointer(e: PointerEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const ratio = this.worldW / rect.width;
    this.pointerWorldX = (e.clientX - rect.left) * ratio;
  }

  private readonly onPointerMove = (e: PointerEvent): void => {
    this.updatePointer(e);
  };

  private readonly onPointerDown = (e: PointerEvent): void => {
    this.updatePointer(e);
    this.tapPending = true;
  };
}
