const TOUCH_SENSITIVITY = 1.5;

export class InputHandler {
  private readonly canvas: HTMLCanvasElement;
  private readonly worldW: number;
  private readonly worldH: number;
  private paddleX: number | null = null;
  private pointerY: number | null = null;
  private pendingTap: { x: number; y: number } | null = null;
  private activeTouchId: number | null = null;
  private touchLastClientX: number | null = null;

  constructor(canvas: HTMLCanvasElement, worldW: number, worldH: number) {
    this.canvas = canvas;
    this.worldW = worldW;
    this.worldH = worldH;
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
  }

  getPointerX(): number | null {
    return this.paddleX;
  }

  getPointerY(): number | null {
    return this.pointerY;
  }

  consumeTap(): { x: number; y: number } | null {
    const t = this.pendingTap;
    this.pendingTap = null;
    return t;
  }

  private toWorld(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left) * (this.worldW / rect.width),
      y: (clientY - rect.top) * (this.worldH / rect.height),
    };
  }

  private isOverCanvas(clientX: number, clientY: number): boolean {
    const rect = this.canvas.getBoundingClientRect();
    return clientX >= rect.left && clientX <= rect.right &&
           clientY >= rect.top && clientY <= rect.bottom;
  }

  private readonly onPointerMove = (e: PointerEvent): void => {
    const w = this.toWorld(e.clientX, e.clientY);
    this.pointerY = w.y;

    if (e.pointerType === 'touch') {
      if (e.pointerId !== this.activeTouchId || this.touchLastClientX === null) return;
      const rect = this.canvas.getBoundingClientRect();
      const dxScreen = e.clientX - this.touchLastClientX;
      this.touchLastClientX = e.clientX;
      const dxWorld = dxScreen * (this.worldW / rect.width) * TOUCH_SENSITIVITY;
      const base = this.paddleX ?? this.worldW / 2;
      this.paddleX = Math.max(0, Math.min(this.worldW, base + dxWorld));
    } else if (this.isOverCanvas(e.clientX, e.clientY)) {
      this.paddleX = w.x;
    }
  };

  private readonly onPointerDown = (e: PointerEvent): void => {
    const w = this.toWorld(e.clientX, e.clientY);
    this.pointerY = w.y;

    if (e.pointerType === 'touch') {
      if (this.activeTouchId === null) {
        this.activeTouchId = e.pointerId;
        this.touchLastClientX = e.clientX;
        if (this.paddleX === null) this.paddleX = w.x;
      }
    } else if (this.isOverCanvas(e.clientX, e.clientY)) {
      this.paddleX = w.x;
    }

    this.pendingTap = { x: w.x, y: w.y };
  };

  private readonly onPointerUp = (e: PointerEvent): void => {
    if (e.pointerType === 'touch' && e.pointerId === this.activeTouchId) {
      this.activeTouchId = null;
      this.touchLastClientX = null;
    }
  };
}
