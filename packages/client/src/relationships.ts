/**
 * Relationship type helpers and enums.
 * The actual API functions are auto-generated in generated/client.ts.
 */

/**
 * Sentiment scale: -2 (strongly dislike) to 2 (strongly like), 0 = neutral
 */
export type RelationshipSentiment = -2 | -1 | 0 | 1 | 2;

export const RelationshipSentimentLabel: Record<RelationshipSentiment, string> = {
  [-2]: 'Strongly Dislike',
  [-1]: 'Dislike',
  [0]: 'Neutral',
  [1]: 'Like',
  [2]: 'Strongly Like',
};
