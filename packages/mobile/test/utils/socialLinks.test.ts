import {
  detectChannelFromUrl,
  getSocialLinkMeta,
  SOCIAL_LINK_META,
} from "../../src/utils/socialLinks";

describe("detectChannelFromUrl", () => {
  describe("known platforms", () => {
    it.each([
      ["https://www.linkedin.com/in/johndoe", "linkedin", "johndoe"],
      ["https://twitter.com/jack", "twitter", "jack"],
      ["https://x.com/jack", "twitter", "jack"],
      ["https://instagram.com/natgeo", "instagram", "natgeo"],
      ["https://github.com/torvalds", "github", "torvalds"],
      ["https://facebook.com/zuck", "facebook", "zuck"],
      ["https://youtube.com/@mkbhd", "youtube", "mkbhd"],
      ["https://www.youtube.com/channel/UC123", "youtube", "channel/UC123"],
      ["https://www.youtube.com/c/CoolChannel", "youtube", "c/CoolChannel"],
      ["https://www.youtube.com/user/SomeUser", "youtube", "user/SomeUser"],
      ["https://www.tiktok.com/@charli", "tiktok", "charli"],
    ])("extracts handle from %s", (url, type, value) => {
      expect(detectChannelFromUrl(url)).toEqual({ type, value });
    });
  });

  describe("schemeless and mobile-subdomain input", () => {
    it.each([
      ["linkedin.com/in/johndoe", "linkedin", "johndoe"],
      ["www.github.com/torvalds", "github", "torvalds"],
      ["m.facebook.com/zuck", "facebook", "zuck"],
      ["mobile.twitter.com/jack", "twitter", "jack"],
    ])("detects %s", (url, type, value) => {
      expect(detectChannelFromUrl(url)).toEqual({ type, value });
    });

    it("prefixes a scheme on the website fallback so the value is openable", () => {
      expect(detectChannelFromUrl("acme.com/about")).toEqual({
        type: "website",
        value: "https://acme.com/about",
      });
    });
  });

  describe("non-profile paths fall back to website", () => {
    it.each([
      "https://twitter.com/home",
      "https://www.instagram.com/p/abc123",
      "https://github.com/orgs/anthropics",
      "https://www.facebook.com/groups/12345",
      "https://www.facebook.com/profile.php?id=123",
    ])("treats %s as a website", (url) => {
      expect(detectChannelFromUrl(url)).toEqual({
        type: "website",
        value: url,
      });
    });

    it("excludes reserved segments case-insensitively", () => {
      expect(
        detectChannelFromUrl("https://github.com/Orgs/anthropics"),
      ).toEqual({
        type: "website",
        value: "https://github.com/Orgs/anthropics",
      });
    });
  });

  it("falls back to website for an unrecognized host", () => {
    const url = "https://example.com/about";
    expect(detectChannelFromUrl(url)).toEqual({ type: "website", value: url });
  });

  it("returns null for non-URL input", () => {
    expect(detectChannelFromUrl("johndoe")).toBeNull();
    expect(detectChannelFromUrl("")).toBeNull();
  });
});

describe("getUrl", () => {
  it("builds a profile URL from a bare handle", () => {
    expect(SOCIAL_LINK_META.linkedin.getUrl("johndoe")).toBe(
      "https://linkedin.com/in/johndoe",
    );
  });

  it("passes through a value that is already a full URL", () => {
    const full = "https://linkedin.com/in/foo";
    expect(SOCIAL_LINK_META.linkedin.getUrl(full)).toBe(full);
  });

  it("returns website values unchanged", () => {
    expect(SOCIAL_LINK_META.website.getUrl("https://example.com")).toBe(
      "https://example.com",
    );
  });

  // A detected handle fed back through getUrl must reproduce a working URL.
  describe("round-trips a detected handle back to a working URL", () => {
    it.each([
      ["youtube", "channel/UC123", "https://youtube.com/channel/UC123"],
      ["youtube", "c/CoolChannel", "https://youtube.com/c/CoolChannel"],
      ["youtube", "mkbhd", "https://youtube.com/@mkbhd"],
      ["youtube", "@mkbhd", "https://youtube.com/@mkbhd"],
      ["tiktok", "charli", "https://tiktok.com/@charli"],
      ["tiktok", "@charli", "https://tiktok.com/@charli"],
    ])("%s getUrl(%s)", (type, value, expected) => {
      expect(getSocialLinkMeta(type).getUrl(value)).toBe(expected);
    });
  });
});

describe("getSocialLinkMeta", () => {
  it("resolves a known type", () => {
    expect(getSocialLinkMeta("linkedin")).toBe(SOCIAL_LINK_META.linkedin);
  });

  it('falls back to "other" for an unknown type', () => {
    expect(getSocialLinkMeta("myspace")).toBe(SOCIAL_LINK_META.other);
  });
});
