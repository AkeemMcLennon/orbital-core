import { describe, it, expect } from "bun:test";
import { bestMatch, toMatchCandidate } from "../../src/utils/name-match";

// Build candidates the same way the service does: { id, name }.
function candidates(...entries: Array<[string, string]>) {
  return entries.map(([id, name]) => toMatchCandidate(id, name));
}

describe("bestMatch", () => {
  it("matches a single-token mention against a first name", () => {
    const c = candidates(["bob", "Bob Smith"]);
    expect(bestMatch("Bob", c)).toBe("bob");
  });

  it("matches a bare last-name mention against a last name", () => {
    const c = candidates(["matt", "Matt Swain"]);
    expect(bestMatch("Swain", c)).toBe("matt");
  });

  it("prefers a first-name match over a last-name match", () => {
    const c = candidates(
      ["kyleSmith", "Kyle Smith"], // Kyle = first name
      ["selenaKyle", "Selena Kyle"], // Kyle = last name
    );
    expect(bestMatch("Kyle", c)).toBe("kyleSmith");
  });

  it("matches a full-name mention against a contact stored by first name only", () => {
    const c = candidates(["bob", "Bob"]);
    expect(bestMatch("Bob Smith", c)).toBe("bob");
  });

  it("matches a full-name mention exactly", () => {
    const c = candidates(["bobSmith", "Bob Smith"], ["bob", "Bob"]);
    expect(bestMatch("Bob Smith", c)).toBe("bobSmith");
  });

  it("does not link a full-name mention to a different last name", () => {
    const c = candidates(["bobJones", "Bob Jones"]);
    expect(bestMatch("Bob Smith", c)).toBeNull();
  });

  it("does not match on a shared prefix ('Carl' vs 'Carla')", () => {
    const c = candidates(["carla", "Carla"]);
    expect(bestMatch("Carl", c)).toBeNull();
  });

  it("returns null when there are no candidates", () => {
    expect(bestMatch("Bob", [])).toBeNull();
  });

  it("returns null when nothing matches", () => {
    const c = candidates(["alice", "Alice Wong"]);
    expect(bestMatch("Zephyrine", c)).toBeNull();
  });

  it("breaks equal-score ties by lowest id deterministically", () => {
    // Two first-name matches for "Bob" with no distinguishing gender signal.
    const c = candidates(["b2", "Bob Zephyr"], ["b1", "Bob Younger"]);
    expect(bestMatch("Bob", c)).toBe("b1");
  });

  it("strips salutations and suffixes from the mention", () => {
    const c = candidates(["bob", "Bob Smith"]);
    expect(bestMatch("Dr. Bob Smith Jr.", c)).toBe("bob");
  });
});
