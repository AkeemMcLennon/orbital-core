import { composeNotes, planPrefill } from "../../src/import/funnel";
import type { ImportedContact } from "../../src/import/types";

describe("planPrefill", () => {
  it("keeps fields with a column out of the notes", () => {
    const c: ImportedContact = {
      name: "Jane",
      phone: "+1",
      company: "Acme",
      jobTitle: "CEO",
      notes: "met at conf",
      birthday: "1990-01-02",
    };
    const plan = planPrefill(c);
    expect(plan).toMatchObject({
      phone: "+1",
      company: "Acme",
      jobTitle: "CEO",
      birthday: "1990-01-02",
    });
    expect(plan.notes).toBe("met at conf");
  });

  it("coerces missing column fields to null", () => {
    expect(planPrefill({ name: "X" })).toMatchObject({
      phone: null,
      company: null,
      jobTitle: null,
      birthday: null,
    });
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

describe("composeNotes", () => {
  it("puts labelled extras above the source notes", () => {
    expect(
      composeNotes({
        name: "Jane",
        notes: "met at conf",
        extras: [
          { label: "Phone (work)", value: "+1 555" },
          { label: "Nickname", value: "Janey" },
        ],
      }),
    ).toBe("Phone (work): +1 555\nNickname: Janey\nmet at conf");
  });

  it("returns extras alone when the source has no notes", () => {
    expect(
      composeNotes({
        name: "Jane",
        extras: [{ label: "Role", value: "Engineer" }],
      }),
    ).toBe("Role: Engineer");
  });

  it("returns an empty string when there is nothing to say", () => {
    expect(composeNotes({ name: "Jane", phone: "+1", company: "Acme" })).toBe(
      "",
    );
  });
});
