import { Alert } from "react-native";
import { fireEvent, screen, waitFor } from "expo-router/testing-library";

import { renderAppRoute } from "../helpers/render";
import { withMockApi } from "../helpers/mock-api";

/**
 * Integration coverage for API error handling, driven end to end: a real HTTP
 * response from the mock API travels through customFetch → unwrapAsync →
 * react-query → the screen, and assertions are on what the user actually sees.
 *
 * The client is pointed at the mock API (rather than the real backend the other
 * screen tests use) purely so failures can be injected deterministically.
 *
 * Not covered here, by design: the retry policy. It lives on the QueryClient in
 * `app/_layout.tsx`, which `test/setup.ts` replaces with a minimal provider, so
 * it is unreachable from route-level tests — `isRetryableError` is unit-tested
 * in `test/utils/errors.test.ts` instead.
 */
const WAIT = { timeout: 10000 };

describe("API error handling (screen level)", () => {
  const api = withMockApi();
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    // No ToastHost is mounted (the root layout is mocked), so notifyError
    // falls back to Alert.alert — which is what we assert against.
    alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("Memory Rep Frequency screen", () => {
    it("shows the saved preset when the preference loads", async () => {
      api().when("GET", "/preferences", {
        status: 200,
        body: { memRepInitialDelayHours: 168 },
      });

      renderAppRoute({ initialUrl: "/memory-rep-frequency" });

      await waitFor(() => {
        expect(screen.getByText("1 week")).toBeTruthy();
      }, WAIT);
      expect(screen.queryByTestId("error-state")).toBeNull();
    });

    it("shows an error with a retry when the preference fails to load", async () => {
      api().when("GET", "/preferences", {
        status: 500,
        body: { message: "boom" },
      });

      renderAppRoute({ initialUrl: "/memory-rep-frequency" });

      await waitFor(() => {
        expect(screen.getByTestId("error-state")).toBeTruthy();
      }, WAIT);
      expect(screen.getByText("Couldn't load your setting")).toBeTruthy();
      // A 5xx is transient, so a retry is offered.
      expect(screen.getByTestId("error-state-retry")).toBeTruthy();
      // The preset list must NOT render alongside the failure.
      expect(screen.queryByText("3 days")).toBeNull();
    });

    it("recovers when retry is pressed after a transient failure", async () => {
      let failNext = true;
      api().when("GET", "/preferences", () =>
        failNext
          ? { status: 500, body: { message: "boom" } }
          : { status: 200, body: { memRepInitialDelayHours: 72 } },
      );

      renderAppRoute({ initialUrl: "/memory-rep-frequency" });

      await waitFor(() => {
        expect(screen.getByTestId("error-state-retry")).toBeTruthy();
      }, WAIT);

      failNext = false;
      fireEvent.press(screen.getByTestId("error-state-retry"));

      await waitFor(() => {
        expect(screen.getByText("3 days")).toBeTruthy();
      }, WAIT);
      expect(screen.queryByTestId("error-state")).toBeNull();
    });

    it("keeps the current selection when saving fails", async () => {
      // Regression guard: a failed save used to write the error envelope into
      // cache, which blanked the user's selected row.
      api().when("GET", "/preferences", {
        status: 200,
        body: { memRepInitialDelayHours: 72 },
      });
      api().when("PUT", "/preferences", {
        status: 500,
        body: { message: "boom" },
      });

      renderAppRoute({ initialUrl: "/memory-rep-frequency" });

      await waitFor(() => {
        expect(screen.getByText("3 days")).toBeTruthy();
      }, WAIT);

      fireEvent.press(screen.getByText("1 week"));

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalled();
      }, WAIT);

      // Still showing every preset, with the original value intact.
      expect(screen.getByText("3 days")).toBeTruthy();
      expect(screen.queryByTestId("error-state")).toBeNull();
    });

    it("saves the chosen preset on the happy path", async () => {
      let stored = 72;
      api().when("GET", "/preferences", () => ({
        status: 200,
        body: { memRepInitialDelayHours: stored },
      }));
      api().when("PUT", "/preferences", (call) => {
        stored = (call.body as { memRepInitialDelayHours: number })
          .memRepInitialDelayHours;
        return { status: 200, body: { memRepInitialDelayHours: stored } };
      });

      renderAppRoute({ initialUrl: "/memory-rep-frequency" });

      await waitFor(() => {
        expect(screen.getByText("1 week")).toBeTruthy();
      }, WAIT);

      fireEvent.press(screen.getByText("1 week"));

      await waitFor(() => {
        expect(
          api()
            .calls("/preferences")
            .filter((c) => c.method === "PUT"),
        ).toHaveLength(1);
      }, WAIT);
      expect(
        api()
          .calls("/preferences")
          .find((c) => c.method === "PUT")?.body,
      ).toEqual({ memRepInitialDelayHours: 168 });
      expect(alertSpy).not.toHaveBeenCalled();
    });
  });

  describe("Tags screen", () => {
    it("lists tags on the happy path", async () => {
      api().when("GET", "/tags", {
        status: 200,
        body: [{ id: "t1", name: "Work", color: "#4F46E5" }],
      });

      renderAppRoute({ initialUrl: "/tags" });

      await waitFor(() => {
        expect(screen.getByText("Work")).toBeTruthy();
      }, WAIT);
    });

    it("shows an error rather than an empty state when loading fails", async () => {
      // Regression guard: this used to fall through to "No tags yet", which
      // reads as "you have no tags" when the request had actually failed.
      api().when("GET", "/tags", { status: 500, body: { message: "boom" } });

      renderAppRoute({ initialUrl: "/tags" });

      await waitFor(() => {
        expect(screen.getByTestId("error-state")).toBeTruthy();
      }, WAIT);
      expect(screen.getByText("Couldn't load tags")).toBeTruthy();
      expect(screen.queryByText(/No tags yet/)).toBeNull();
    });

    it("still shows the empty state when there genuinely are no tags", async () => {
      api().when("GET", "/tags", { status: 200, body: [] });

      renderAppRoute({ initialUrl: "/tags" });

      await waitFor(() => {
        expect(screen.getByText(/No tags yet/)).toBeTruthy();
      }, WAIT);
      expect(screen.queryByTestId("error-state")).toBeNull();
    });
  });

  describe("Dashboard", () => {
    it("shows an inline error when contacts fail to load", async () => {
      api().when("GET", "/contacts", {
        status: 500,
        body: { message: "boom" },
      });
      api().when("GET", "/memory-reps", {
        status: 200,
        body: { items: [], pagination: { total: 0, limit: 50, offset: 0 } },
      });

      renderAppRoute({ initialUrl: "/" });

      await waitFor(() => {
        expect(screen.getByText("Couldn't load contacts")).toBeTruthy();
      }, WAIT);
    });

    it("shows an inline error when memory reps fail to load", async () => {
      api().when("GET", "/contacts", {
        status: 200,
        body: { items: [], pagination: { total: 0, limit: 50, offset: 0 } },
      });
      api().when("GET", "/memory-reps", {
        status: 500,
        body: { message: "boom" },
      });

      renderAppRoute({ initialUrl: "/" });

      await waitFor(() => {
        expect(screen.getByText("Couldn't load memory reps")).toBeTruthy();
      }, WAIT);
    });

    it("surfaces a non-JSON gateway error as a server error, not a connection error", async () => {
      // readBody() keeps an HTML 502 from being misreported as "no connection".
      api().when("GET", "/contacts", {
        status: 502,
        raw: "<html><body>Bad Gateway</body></html>",
      });
      api().when("GET", "/memory-reps", {
        status: 200,
        body: { items: [], pagination: { total: 0, limit: 50, offset: 0 } },
      });

      renderAppRoute({ initialUrl: "/" });

      await waitFor(() => {
        expect(screen.getByText("Couldn't load contacts")).toBeTruthy();
      }, WAIT);
      expect(
        screen.getByText("Our server had a problem. Try again in a moment."),
      ).toBeTruthy();
    });
  });
});
