export const ContactStatus = {
  AVAILABLE: 'available',
  ACTIVE: 'active',
} as const;

export const ContactGroup = {
  WORK: 'work',
  PERSONAL: 'personal',
} as const;

export const ActionItemStatus = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  SNOOZED: 'snoozed',
} as const;

export const ActionItemSource = {
  MANUAL: 'manual',
  BIRTHDAY: 'birthday',
  CADENCE: 'cadence',
} as const;

export const InteractionType = {
  CALL: 'call',
  COFFEE: 'coffee',
  MEETING: 'meeting',
  EMAIL: 'email',
  SOCIAL: 'social',
} as const;

export const Sentiment = {
  POSITIVE: 'positive',
  NEUTRAL: 'neutral',
  NEGATIVE: 'negative',
} as const;
