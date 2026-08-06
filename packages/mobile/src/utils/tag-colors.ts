/**
 * Deterministic tag chip colors.
 *
 * Hue is derived from the tag name; lightness and chroma are pinned constants.
 * Because OKLCH is perceptually uniform, every hue lands at the same apparent
 * brightness — unlike HSL, where a green at L 0.5 reads far brighter than a red
 * at the same L and a row of chips ends up with no shared visual weight.
 */

/** Number of evenly-spaced hues. Fewer buckets => more collisions but more
 * separation between the colors that are used. */
export const HUE_BUCKETS = 36;

/** Pinned so white label text clears WCAG AA (4.5:1) on every hue. See the
 * contrast guard in test/unit/tag-colors.test.ts before changing these. */
const TAG_L = 0.55;
const TAG_C = 0.14;

/**
 * FNV-1a with a murmur3 finalizer.
 *
 * The finalizer matters: a plain multiply-accumulate hash (such as the BKDRHash
 * inside `color-hash`) leaves almost no entropy in its low bits, so `% HUE_BUCKETS`
 * collapses unrelated names onto the same bucket.
 */
function hashTagName(name: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  h ^= h >>> 16;
  h = Math.imul(h, 2246822507) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 3266489909) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

/** OKLCH -> *linear* sRGB. Values outside [0,1] are outside the sRGB gamut. */
function oklchToLinearRgb(
  l: number,
  c: number,
  hueDeg: number,
): [number, number, number] {
  const h = (hueDeg * Math.PI) / 180;
  const a = c * Math.cos(h);
  const b = c * Math.sin(h);

  const lRoot = l + 0.3963377774 * a + 0.2158037573 * b;
  const mRoot = l - 0.1055613458 * a - 0.0638541728 * b;
  const sRoot = l - 0.0894841775 * a - 1.291485548 * b;

  const lc = lRoot ** 3;
  const mc = mRoot ** 3;
  const sc = sRoot ** 3;

  return [
    4.0767416621 * lc - 3.3077115913 * mc + 0.2309699292 * sc,
    -1.2684380046 * lc + 2.6097574011 * mc - 0.3413193965 * sc,
    -0.0041960863 * lc - 0.7034186147 * mc + 1.707614701 * sc,
  ];
}

function inGamut(rgb: [number, number, number]): boolean {
  return rgb.every((v) => v >= -0.0001 && v <= 1.0001);
}

/**
 * Linear sRGB for a hue, reducing chroma until the color fits the gamut.
 *
 * Clamping chroma rather than clipping the individual channels matters: channel
 * clipping silently shifts the hue, so two adjacent buckets can converge on the
 * same visible color.
 */
function gamutClampedRgb(
  l: number,
  c: number,
  hueDeg: number,
): [number, number, number] {
  if (inGamut(oklchToLinearRgb(l, c, hueDeg))) {
    return oklchToLinearRgb(l, c, hueDeg);
  }
  let lo = 0;
  let hi = c;
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2;
    if (inGamut(oklchToLinearRgb(l, mid, hueDeg))) lo = mid;
    else hi = mid;
  }
  return oklchToLinearRgb(l, lo, hueDeg);
}

/** Apply the sRGB transfer function and encode one linear channel as hex. */
function encodeChannel(linear: number): string {
  const v =
    linear <= 0.0031308
      ? 12.92 * linear
      : 1.055 * Math.max(linear, 0) ** (1 / 2.4) - 0.055;
  const byte = Math.round(Math.min(1, Math.max(0, v)) * 255);
  return byte.toString(16).padStart(2, "0");
}

function oklchToHex(l: number, c: number, hueDeg: number): string {
  return `#${gamutClampedRgb(l, c, hueDeg).map(encodeChannel).join("")}`;
}

/**
 * The complete set of generated tag fills, computed once at module load.
 * Keeping this precomputed means the gamut binary search never runs per render.
 */
export const TAG_FILLS: readonly string[] = Array.from(
  { length: HUE_BUCKETS },
  (_, i) => oklchToHex(TAG_L, TAG_C, i * (360 / HUE_BUCKETS)),
);

/** Background color for a tag with no explicitly assigned color. */
export function getTagFill(name: string): string {
  return TAG_FILLS[hashTagName(name) % HUE_BUCKETS];
}

/**
 * WCAG relative luminance of a hex color. Exported for the contrast guard test
 * and reused by Tag.tsx for user-supplied colors, which can be any hex.
 */
export function relativeLuminance(hex: string): number {
  const h = hex.replace("#", "");
  const channels = [0, 2, 4].map((i) => {
    const x = parseInt(h.slice(i, i + 2), 16) / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

/** WCAG contrast ratio between a hex color and white. */
export function contrastWithWhite(hex: string): number {
  return 1.05 / (relativeLuminance(hex) + 0.05);
}
