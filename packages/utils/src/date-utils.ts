import {
  differenceInCalendarDays,
  differenceInDays,
  differenceInMinutes,
  format,
  parseISO,
  addMonths,
  isAfter,
  isBefore,
  isSameYear,
} from "date-fns";

/** Every shape a date reaches us in: a Date, an ISO string, or epoch millis. */
export type DateInput = Date | string | number;

/**
 * Normalize any DateInput to a Date. Yields an invalid Date (rather than
 * throwing) for unparseable input, so callers choose how to degrade.
 */
function toDate(date: DateInput): Date {
  return typeof date === "string" ? parseISO(date) : new Date(date);
}

export function daysSince(date: Date | string): number {
  return differenceInDays(new Date(), toDate(date));
}

export function formatDate(
  date: Date | string,
  formatStr: string = "yyyy-MM-dd",
): string {
  return format(toDate(date), formatStr);
}

/**
 * Human-readable timestamp for activity feeds: relative while that still reads
 * naturally, then a calendar date once "N days ago" stops meaning anything.
 *
 *   Just now · 12m ago · 3h ago · Yesterday · Tuesday · Aug 2 · Aug 2, 2025
 *
 * Returns null for missing or unparseable input so callers can omit the row.
 * `now` is injectable for deterministic tests.
 */
export function formatTimelineTime(
  date: DateInput | null | undefined,
  now: Date = new Date(),
): string | null {
  // Not `!date` — epoch 0 is a valid instant, even if an implausible one.
  if (date === null || date === undefined) return null;

  const targetDate = toDate(date);
  if (Number.isNaN(targetDate.getTime())) return null;

  const calendarDate = () =>
    isSameYear(targetDate, now)
      ? format(targetDate, "MMM d")
      : format(targetDate, "MMM d, yyyy");

  // Calendar days, not elapsed hours, so 11pm -> 1am reads 'Yesterday'.
  const days = differenceInCalendarDays(now, targetDate);

  // A later calendar day means a genuinely future timestamp (bad import, bad
  // clock). Date it rather than claiming it just happened.
  if (days < 0) return calendarDate();

  // Small negatives — server/device clock skew within today — land here as
  // 'Just now', which is what we want.
  const minutes = differenceInMinutes(now, targetDate);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;

  if (days === 0) return `${Math.floor(minutes / 60)}h ago`;
  if (days === 1) return "Yesterday";
  if (days < 7) return format(targetDate, "EEEE");

  return calendarDate();
}

export function addMonthsToDate(date: Date | string, months: number): Date {
  return addMonths(toDate(date), months);
}

export function isDateAfter(
  date1: Date | string,
  date2: Date | string,
): boolean {
  return isAfter(toDate(date1), toDate(date2));
}

export function isDateBefore(
  date1: Date | string,
  date2: Date | string,
): boolean {
  return isBefore(toDate(date1), toDate(date2));
}
