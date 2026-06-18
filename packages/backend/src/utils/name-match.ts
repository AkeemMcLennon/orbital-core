import { parseNameParts, determineNameInfo, type Gender } from "gender-name";

export interface MatchCandidate {
  id: string;
  first?: string; // lowercased
  last?: string; // lowercased
  gender?: Gender;
}

/**
 * Build a candidate from a stored contact id + name. First/last are lowercased once,
 * and gender is derived from the FIRST name so multi-word names still resolve
 * (`determineNameInfo` returns null for full strings like "Bob Smith").
 */
export function toMatchCandidate(id: string, name: string): MatchCandidate {
  const p = parseNameParts(name);
  return {
    id,
    first: p.firstName?.toLowerCase(),
    last: p.lastName?.toLowerCase(),
    gender: determineNameInfo(p.firstName ?? name)?.gender,
  };
}

/**
 * Score how well a parsed mention matches a candidate. Higher = stronger; null = no
 * match. First-name matches outrank last-name matches.
 */
function score(
  mFirst: string | undefined,
  mLast: string | undefined,
  c: MatchCandidate,
): number | null {
  if (mFirst && mLast) {
    // Mention carries both first and last: require first-name agreement, and never
    // link two people who share a first name but carry different last names.
    if (c.first === mFirst && c.last === mLast) return 100; // exact full-name match
    if (c.first === mFirst && !c.last) return 90; // mention fuller than stored
    return null; // "Bob Smith" ↛ "Bob Jones"
  }
  if (mFirst) {
    // Single-token mention: match either name part, first ranked above last.
    if (c.first === mFirst) return 70; // first-name match ("Kyle" → "Kyle Smith")
    if (c.last === mFirst) return 40; // last-name match ("Swain" → "Matt Swain")
  }
  return null;
}

/**
 * Best-matching candidate id for a mention, or null. Ties are broken by a soft gender
 * preference (used only to rank, never to exclude) then lowest id for determinism.
 */
export function bestMatch(
  mention: string,
  candidates: MatchCandidate[],
): string | null {
  const p = parseNameParts(mention);
  const mf = p.firstName?.toLowerCase();
  const ml = p.lastName?.toLowerCase();
  const mGender = determineNameInfo(p.firstName ?? mention)?.gender;

  let best: { c: MatchCandidate; score: number } | null = null;
  for (const c of candidates) {
    const s = score(mf, ml, c);
    if (s === null) continue;

    if (best === null || s > best.score) {
      best = { c, score: s };
      continue;
    }
    if (s === best.score) {
      const cG = mGender ? c.gender === mGender : false;
      const bG = mGender ? best.c.gender === mGender : false;
      if (cG && !bG) {
        best = { c, score: s };
      } else if (cG === bG && c.id < best.c.id) {
        best = { c, score: s };
      }
    }
  }
  return best?.c.id ?? null;
}
