import sharp from "sharp";

export type RasterPage = {
  buffer: Buffer;
  width: number;
  height: number;
};

/**
 * Saddle-stitch print PDFs store each sheet side as a landscape pair:
 *   even PDF pages:  (N-i) | (i+1)     e.g. 28|1, 26|3, …
 *   odd  PDF pages:  (i+1) | (N-i)     e.g.  2|27, 4|25, …
 * Rebuild single pages in reader order (1…N).
 *
 * Expects lossless (or near-lossless) buffers — typically PNG from pdf render.
 * Outputs PNG halves; caller encodes the final delivery format once.
 */
export async function deimposeSaddleStitchSpreads(spreads: RasterPage[]): Promise<RasterPage[]> {
  if (spreads.length === 0) return [];

  const sample = spreads[0];
  const isLandscape = sample.width > sample.height * 1.15;
  if (!isLandscape) {
    return spreads;
  }

  const total = spreads.length * 2;
  const slots: Array<RasterPage | null> = Array.from({ length: total }, () => null);

  for (let i = 0; i < spreads.length; i++) {
    const spread = spreads[i];
    const mid = Math.floor(spread.width / 2);
    const leftWidth = mid;
    const rightWidth = spread.width - mid;

    const leftBuf = await sharp(spread.buffer)
      .extract({ left: 0, top: 0, width: leftWidth, height: spread.height })
      .png()
      .toBuffer();
    const rightBuf = await sharp(spread.buffer)
      .extract({ left: mid, top: 0, width: rightWidth, height: spread.height })
      .png()
      .toBuffer();

    const left: RasterPage = { buffer: leftBuf, width: leftWidth, height: spread.height };
    const right: RasterPage = { buffer: rightBuf, width: rightWidth, height: spread.height };

    if (i % 2 === 0) {
      slots[total - i - 1] = left;
      slots[i] = right;
    } else {
      slots[i] = left;
      slots[total - i - 1] = right;
    }
  }

  if (slots.some((slot) => !slot)) {
    throw new Error("Не удалось разобрать спуск полос PDF");
  }

  return slots as RasterPage[];
}

export function isLikelyPrintSpread(width: number, height: number) {
  return width > height * 1.15;
}
