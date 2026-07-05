/**
 * Contact relationship-strength helpers and enums.
 * The `strength` field itself lives on the auto-generated contact types in
 * generated/client.ts; this module just adds the semantic type + labels.
 */

import type { FivePointScale } from "./scale";

/**
 * Relationship strength scale: -2 (distant) to 2 (inner circle), 0 = neutral.
 * Unlike relationship sentiment, the low end is "weak" rather than negative.
 */
export type ContactStrength = FivePointScale;

export const ContactStrengthLabel: Record<ContactStrength, string> = {
  [-2]: "Distant",
  [-1]: "Acquaintance",
  [0]: "Neutral",
  [1]: "Close",
  [2]: "Inner Circle",
};
