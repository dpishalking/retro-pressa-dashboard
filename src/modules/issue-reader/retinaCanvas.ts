/**
 * page-flip sizes its canvas in CSS pixels only, so Retina screens look soft.
 * Patch resize to use devicePixelRatio and clear without a scaled transform.
 */
export function enableFlipbookRetinaCanvas(flip: {
  getUI: () => {
    getCanvas: () => HTMLCanvasElement;
    update: () => void;
    resizeCanvas?: () => void;
  };
  getRender: () => {
    getContext: () => CanvasRenderingContext2D;
    clear?: () => void;
    update: () => void;
  };
}): () => void {
  const ui = flip.getUI();
  const render = flip.getRender();
  const canvas = ui.getCanvas();
  const ctx = render.getContext();

  const applyDpr = () => {
    const cs = getComputedStyle(canvas);
    const cssW = parseInt(cs.getPropertyValue("width"), 10) || canvas.clientWidth || 1;
    const cssH = parseInt(cs.getPropertyValue("height"), 10) || canvas.clientHeight || 1;
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const pixelW = Math.max(1, Math.round(cssW * dpr));
    const pixelH = Math.max(1, Math.round(cssH * dpr));

    if (canvas.width !== pixelW || canvas.height !== pixelH) {
      canvas.width = pixelW;
      canvas.height = pixelH;
    }
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
  };

  ui.resizeCanvas = applyDpr;

  const originalClear = render.clear?.bind(render);
  if (originalClear) {
    render.clear = () => {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = "#fffdf8";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    };
  }

  applyDpr();

  return () => {
    if (originalClear) render.clear = originalClear;
  };
}
