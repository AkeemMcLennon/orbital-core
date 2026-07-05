/**
 * A five-point integer scale shared by contact `strength` and relationship
 * `sentiment`: -2 (weakest/most negative) to 2 (strongest/most positive).
 * Mirrors the backend's `fivePointScaleSchema` bounds
 * (packages/backend/src/utils/scale.ts) — keep both in sync if the range changes.
 */
export type FivePointScale = -2 | -1 | 0 | 1 | 2;
