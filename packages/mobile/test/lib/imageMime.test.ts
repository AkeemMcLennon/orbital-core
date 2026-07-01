import {
  canonicalImageMimeType,
  imageMimeToExt,
} from "../../src/lib/imageMime";

describe("canonicalImageMimeType", () => {
  it("accepts supported types", () => {
    expect(canonicalImageMimeType("image/jpeg")).toBe("image/jpeg");
    expect(canonicalImageMimeType("image/png")).toBe("image/png");
    expect(canonicalImageMimeType("image/webp")).toBe("image/webp");
    expect(canonicalImageMimeType("image/gif")).toBe("image/gif");
  });

  it("normalizes image/jpg and is case-insensitive", () => {
    expect(canonicalImageMimeType("image/jpg")).toBe("image/jpeg");
    expect(canonicalImageMimeType("IMAGE/PNG")).toBe("image/png");
  });

  it("returns null for unsupported types", () => {
    expect(canonicalImageMimeType("image/heic")).toBeNull();
    expect(canonicalImageMimeType("image/bmp")).toBeNull();
    expect(canonicalImageMimeType("application/pdf")).toBeNull();
  });
});

describe("imageMimeToExt", () => {
  it("maps each supported type to an extension", () => {
    expect(imageMimeToExt("image/jpeg")).toBe("jpg");
    expect(imageMimeToExt("image/png")).toBe("png");
    expect(imageMimeToExt("image/webp")).toBe("webp");
    expect(imageMimeToExt("image/gif")).toBe("gif");
  });
});
