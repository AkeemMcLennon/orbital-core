import { crc32, deflateSync } from "node:zlib";

/**
 * Tiny dependency-free PNG generator used to build a synthetic "business card"
 * image for real-LLM vision tests — avoids checking in a binary fixture or
 * pulling in an image/browser dependency just to render a few lines of text.
 */

// 5x7 bitmap font. Each glyph is 7 rows of a 5-bit mask (bit 4 = leftmost column).
const FONT: Record<string, number[]> = {
  A: [0b01110, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
  C: [0b01111, 0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b01111],
  D: [0b11110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b11110],
  E: [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b11111],
  I: [0b11111, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b11111],
  J: [0b00111, 0b00010, 0b00010, 0b00010, 0b00010, 0b10010, 0b01100],
  M: [0b10001, 0b11011, 0b10101, 0b10001, 0b10001, 0b10001, 0b10001],
  N: [0b10001, 0b11001, 0b10101, 0b10011, 0b10001, 0b10001, 0b10001],
  O: [0b01110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
  P: [0b11110, 0b10001, 0b10001, 0b11110, 0b10000, 0b10000, 0b10000],
  R: [0b11110, 0b10001, 0b10001, 0b11110, 0b10100, 0b10010, 0b10001],
  T: [0b11111, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100],
  "@": [0b01110, 0b10001, 0b10111, 0b10101, 0b10111, 0b10000, 0b01111],
  ".": [0b00000, 0b00000, 0b00000, 0b00000, 0b00000, 0b01100, 0b01100],
  " ": [0, 0, 0, 0, 0, 0, 0],
};

const GLYPH_W = 5;
const GLYPH_H = 7;

/** Renders left-aligned lines of text onto a white RGB canvas and returns a valid PNG buffer. */
export function renderTextPng(
  lines: string[],
  opts: { scale?: number; padding?: number } = {},
): Buffer {
  const scale = opts.scale ?? 8;
  const padding = opts.padding ?? scale * 2;
  const lineGap = scale * 3;

  const maxChars = Math.max(...lines.map((l) => l.length));
  const width = padding * 2 + maxChars * (GLYPH_W + 1) * scale;
  const height =
    padding * 2 + lines.length * GLYPH_H * scale + (lines.length - 1) * lineGap;

  // White RGB canvas.
  const pixels = new Uint8Array(width * height * 3).fill(255);
  const setPixel = (x: number, y: number) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const i = (y * width + x) * 3;
    pixels[i] = pixels[i + 1] = pixels[i + 2] = 0;
  };

  lines.forEach((line, lineIdx) => {
    const baseY = padding + lineIdx * (GLYPH_H * scale + lineGap);
    for (let c = 0; c < line.length; c++) {
      const glyph = FONT[line[c].toUpperCase()];
      if (!glyph) continue;
      const baseX = padding + c * (GLYPH_W + 1) * scale;
      for (let row = 0; row < GLYPH_H; row++) {
        const bits = glyph[row];
        for (let col = 0; col < GLYPH_W; col++) {
          if ((bits >> (GLYPH_W - 1 - col)) & 1) {
            for (let sy = 0; sy < scale; sy++) {
              for (let sx = 0; sx < scale; sx++) {
                setPixel(baseX + col * scale + sx, baseY + row * scale + sy);
              }
            }
          }
        }
      }
    }
  });

  return encodePng(width, height, pixels);
}

function encodePng(width: number, height: number, rgb: Uint8Array): Buffer {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 2; // color type: RGB
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;
  const ihdr = chunk("IHDR", ihdrData);

  // Each scanline prefixed with filter type 0.
  const raw = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    const rowStart = y * (1 + width * 3);
    raw[rowStart] = 0;
    raw.set(rgb.subarray(y * width * 3, (y + 1) * width * 3), rowStart + 1);
  }
  const idat = chunk("IDAT", deflateSync(raw));
  const iend = chunk("IEND", Buffer.alloc(0));

  return Buffer.concat([sig, ihdr, idat, iend]);
}

function chunk(type: string, data: Buffer): Buffer {
  const typeBuf = Buffer.from(type, "ascii");
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}
