import { formatTimelineTime } from "@orbital/utils/date";

// Thursday, 6 August 2026, 14:30 local time. Local (not UTC) so the calendar-day
// comparisons in the formatter don't shift with the runner's timezone.
const NOW = new Date(2026, 7, 6, 14, 30);

const at = (year: number, month: number, day: number, hours = 0, minutes = 0) =>
  new Date(year, month, day, hours, minutes);

describe("formatTimelineTime", () => {
  describe("relative", () => {
    it.each([
      [
        "30 seconds ago -> Just now",
        new Date(NOW.getTime() - 30_000),
        "Just now",
      ],
      ["12 minutes ago -> 12m ago", at(2026, 7, 6, 14, 18), "12m ago"],
      ["59 minutes ago -> 59m ago", at(2026, 7, 6, 13, 31), "59m ago"],
      ["3 hours ago -> 3h ago", at(2026, 7, 6, 11, 30), "3h ago"],
      ["earlier the same day -> 14h ago", at(2026, 7, 6, 0, 15), "14h ago"],
    ])("%s", (_label, date, expected) => {
      expect(formatTimelineTime(date, NOW)).toBe(expected);
    });
  });

  describe("calendar", () => {
    it.each([
      ["the previous day -> Yesterday", at(2026, 7, 5, 9, 0), "Yesterday"],
      ["four days ago -> Sunday", at(2026, 7, 2, 9, 0), "Sunday"],
      ["six days ago -> Friday", at(2026, 6, 31, 9, 0), "Friday"],
      ["eight days ago -> Jul 29", at(2026, 6, 29, 9, 0), "Jul 29"],
      ["a prior year -> Aug 2, 2025", at(2025, 7, 2, 9, 0), "Aug 2, 2025"],
    ])("%s", (_label, date, expected) => {
      expect(formatTimelineTime(date, NOW)).toBe(expected);
    });

    it("prefers the calendar day over elapsed hours across midnight", () => {
      const justAfterMidnight = new Date(2026, 7, 6, 1, 0);
      expect(formatTimelineTime(at(2026, 7, 5, 23, 0), justAfterMidnight)).toBe(
        "Yesterday",
      );
    });
  });

  // The timeline feeds this whatever the API returned, and Orval types
  // `lastInteractionAt` as `unknown` — so every shape has to be survivable.
  describe("input shapes", () => {
    it("parses an ISO string", () => {
      expect(formatTimelineTime(at(2026, 7, 2, 9, 0).toISOString(), NOW)).toBe(
        "Sunday",
      );
    });

    it("parses epoch milliseconds", () => {
      expect(formatTimelineTime(at(2026, 7, 2, 9, 0).getTime(), NOW)).toBe(
        "Sunday",
      );
    });

    it("treats epoch 0 as a real instant, not as missing", () => {
      expect(formatTimelineTime(new Date(0), NOW)).toBe("Jan 1, 1970");
    });
  });

  describe("future timestamps", () => {
    it("forgives clock skew within today", () => {
      expect(formatTimelineTime(at(2026, 7, 6, 14, 35), NOW)).toBe("Just now");
    });

    it.each([
      ["tomorrow -> Aug 7", at(2026, 7, 7, 9, 0), "Aug 7"],
      ["two years out -> Aug 6, 2028", at(2028, 7, 6, 9, 0), "Aug 6, 2028"],
    ])("dates a genuinely future timestamp: %s", (_label, date, expected) => {
      expect(formatTimelineTime(date, NOW)).toBe(expected);
    });
  });

  describe("missing or unparseable input", () => {
    it.each([
      [null],
      [undefined],
      [""],
      ["not-a-date"],
      ["2026-13-45"],
      [{} as never],
      [NaN],
    ])("renders %p as null", (value) => {
      expect(formatTimelineTime(value, NOW)).toBeNull();
    });
  });
});
