import { planPrefill } from "../../src/import/funnel";
import type { ImportedContact } from "../../src/import/types";

describe("planPrefill", () => {
  it("folds extras, source notes, and birthday in order", () => {
    const c: ImportedContact = {
      name: "Jane",
      phone: "+1",
      company: "Acme",
      jobTitle: "CEO",
      notes: "met at conf",
      birthday: "1990-01-02",
    };
    expect(planPrefill(c).notes).toBe(
      "Phone: +1\nCompany: Acme\nTitle: CEO\nmet at conf\nBirthday: 1990-01-02",
    );
  });

  it("coerces a missing email to null", () => {
    expect(planPrefill({ name: "X" }).email).toBeNull();
    expect(planPrefill({ name: "X", email: "a@b.com" }).email).toBe("a@b.com");
  });

  it("detects a social link from a bare /in/ path (linkedin host prepended)", () => {
    const plan = planPrefill({ name: "X", rawLinks: ["/in/jane"] });
    expect(plan.detectedLink).toEqual({ type: "linkedin", value: "jane" });
  });

  it("prefers an already-resolved link and stops at the first match", () => {
    const plan = planPrefill({
      name: "X",
      links: [{ type: "github", value: "octocat" }],
      rawLinks: ["https://linkedin.com/in/jane"],
    });
    expect(plan.detectedLink).toEqual({ type: "github", value: "octocat" });
  });

  it("exposes a local avatar uri + mimeType", () => {
    const plan = planPrefill({
      name: "X",
      avatar: { kind: "local", uri: "file:///a.png", mimeType: "image/png" },
    });
    expect(plan.avatarUrl).toBe("file:///a.png");
    expect(plan.avatarMimeType).toBe("image/png");
  });

  it("exposes a remote avatar url with no mimeType", () => {
    const plan = planPrefill({
      name: "X",
      avatar: { kind: "remote", url: "https://cdn/a.jpg" },
    });
    expect(plan.avatarUrl).toBe("https://cdn/a.jpg");
    expect(plan.avatarMimeType).toBeNull();
  });
});
