import {
  HUE_BUCKETS,
  TAG_FILLS,
  contrastWithWhite,
  getTagFill,
} from "../../src/utils/tag-colors";

describe("tag-colors", () => {
  it("produces one fill per hue bucket, all valid hex", () => {
    expect(TAG_FILLS).toHaveLength(HUE_BUCKETS);
    for (const fill of TAG_FILLS) {
      expect(fill).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  // The reason TAG_L/TAG_C are what they are. Tag labels render as white text,
  // so lightening the fill would silently ship unreadable chips.
  it("clears WCAG AA (4.5:1) against white text on every hue", () => {
    const failures = TAG_FILLS.map((fill, i) => ({
      hue: i * (360 / HUE_BUCKETS),
      fill,
      ratio: contrastWithWhite(fill),
    })).filter((c) => c.ratio < 4.5);

    expect(failures).toEqual([]);
  });

  it("keeps contrast even across hues, which is the point of OKLCH", () => {
    const ratios = TAG_FILLS.map(contrastWithWhite);
    const spread = Math.max(...ratios) - Math.min(...ratios);
    // HSL at fixed lightness swings far wider than this.
    expect(spread).toBeLessThan(1.5);
  });

  it("is deterministic for a given tag name", () => {
    expect(getTagFill("Founders")).toBe(getTagFill("Founders"));
    expect(TAG_FILLS).toContain(getTagFill("Founders"));
  });

  it("distributes names across most buckets", () => {
    const names = Array.from({ length: 200 }, (_, i) => `tag-${i}`);
    const used = new Set(names.map(getTagFill));
    // A hash with weak low bits (e.g. BKDRHash) collapses onto a handful here.
    expect(used.size).toBeGreaterThanOrEqual(HUE_BUCKETS - 4);
  });

  it("separates names that differ only in their last character", () => {
    // The murmur finalizer exists so these don't land on adjacent buckets.
    const fills = ["Alumni1", "Alumni2", "Alumni3", "Alumni4"].map(getTagFill);
    expect(new Set(fills).size).toBeGreaterThan(1);
  });
});
