/**
 * A plain 32-bit pixel buffer. Everything the renderer draws lands here
 * first; the buffer is scaled onto the visible canvas once per frame. That
 * indirection is what gives us cheap texturing, per-pixel light and honest
 * chunky pixels.
 *
 * Pass `buffer` to wrap memory that already exists — the presenter uses
 * that to draw straight into an ImageData with no copy.
 */
export function createFramebuffer(width, height, buffer) {
  const data = buffer
    ? new Uint32Array(buffer)
    : new Uint32Array(width * height);

  return {
    width,
    height,
    data,

    clear(color) {
      data.fill(color >>> 0);
    },

    fillRect(x, y, w, h, color) {
      if (w <= 0 || h <= 0) return;
      const x0 = Math.max(0, x | 0);
      const y0 = Math.max(0, y | 0);
      const x1 = Math.min(width, (x | 0) + (w | 0));
      const y1 = Math.min(height, (y | 0) + (h | 0));
      if (x0 >= x1 || y0 >= y1) return;
      const value = color >>> 0;
      for (let row = y0; row < y1; row++) {
        data.fill(value, row * width + x0, row * width + x1);
      }
    },

    verticalLine(x, y0, y1, color) {
      const column = x | 0;
      if (column < 0 || column >= width) return;
      const start = Math.max(0, y0 | 0);
      const end = Math.min(height, y1 | 0);
      const value = color >>> 0;
      for (let y = start; y < end; y++) {
        data[y * width + column] = value;
      }
    },
  };
}

/**
 * Owns the offscreen canvas the buffer is blitted through. Separated from
 * createFramebuffer so the drawing code above stays testable without a DOM.
 */
export function createPresenter(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  const imageData = ctx.createImageData(width, height);
  const fb = createFramebuffer(width, height, imageData.data.buffer);

  return {
    fb,
    width,
    height,
    present(targetCtx, dstWidth, dstHeight) {
      ctx.putImageData(imageData, 0, 0);
      targetCtx.imageSmoothingEnabled = false;
      targetCtx.drawImage(canvas, 0, 0, dstWidth, dstHeight);
    },
  };
}
