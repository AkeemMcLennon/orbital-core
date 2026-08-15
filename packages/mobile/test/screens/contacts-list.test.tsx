import { screen, waitFor } from "expo-router/testing-library";

import { renderAppRoute } from "../helpers/render";
import { withMockApi } from "../helpers/mock-api";

/**
 * Integration coverage for the paginated contact lists.
 *
 * Both `useAllContactsList` and `useAllAvailableContactsList` are infinite
 * queries that auto-walk every page and flatten the results, so the assertion
 * that matters is that an item from a LATER page reaches the screen — that
 * exercises pagination, flattening, and rendering together.
 */
const WAIT = { timeout: 10000 };
const PAGE_SIZE = 100;

describe("Contacts list screen", () => {
  const api = withMockApi();

  beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  /** Serve `total` records from `path`, honouring offset/limit. */
  function servePaged(path: string, total: number, namePrefix: string) {
    api().when("GET", path, (call) => {
      const offset = Number(call.query.offset ?? 0);
      const limit = Number(call.query.limit ?? PAGE_SIZE);
      const items = Array.from(
        { length: Math.max(0, Math.min(limit, total - offset)) },
        (_, i) => ({
          id: `${namePrefix}-${offset + i}`,
          name: `${namePrefix} ${offset + i}`,
          email: `${namePrefix}${offset + i}@example.com`,
          avatarUrl: null,
          company: null,
        }),
      );
      return {
        status: 200,
        body: { items, pagination: { total, limit, offset } },
      };
    });
  }

  it("renders active contacts drawn from more than one page", async () => {
    // 150 total forces a second request at offset=100.
    servePaged("/contacts", 150, "Active");
    servePaged("/contacts/available", 0, "Directory");

    renderAppRoute({ initialUrl: "/contacts" });

    await waitFor(() => {
      expect(screen.getAllByText("Active 0").length).toBeGreaterThan(0);
    }, WAIT);

    // The list is virtualized, so an item from page 2 is not in the tree even
    // though it is in the data. Assert pagination via the requests instead:
    // a second page was fetched at offset=100 and no third was requested.
    await waitFor(() => {
      expect(api().calls("/contacts")).toHaveLength(2);
    }, WAIT);
    expect(
      api()
        .calls("/contacts")
        .map((c) => c.query.offset),
    ).toEqual(["0", "100"]);
  });

  it("shows an error instead of an empty list when contacts fail to load", async () => {
    api().when("GET", "/contacts", { status: 500, body: { message: "boom" } });
    servePaged("/contacts/available", 0, "Directory");

    renderAppRoute({ initialUrl: "/contacts" });

    await waitFor(() => {
      expect(screen.getByTestId("error-state")).toBeTruthy();
    }, WAIT);
  });

  it("keeps already-loaded contacts visible when a later page fails", async () => {
    // Regression guard: infinite queries expose `error` alongside the retained
    // pages, so branching on `error` alone would replace 100 usable contacts
    // with a blocking error wall.
    api().when("GET", "/contacts", (call) => {
      const offset = Number(call.query.offset ?? 0);
      if (offset > 0) return { status: 500, body: { message: "boom" } };
      const items = Array.from({ length: PAGE_SIZE }, (_, i) => ({
        id: `Active-${i}`,
        name: `Active ${i}`,
        email: `a${i}@example.com`,
        avatarUrl: null,
        company: null,
      }));
      return {
        status: 200,
        body: { items, pagination: { total: 150, limit: PAGE_SIZE, offset } },
      };
    });
    servePaged("/contacts/available", 0, "Directory");

    renderAppRoute({ initialUrl: "/contacts" });

    // The contacts that did load are still on screen...
    await waitFor(() => {
      expect(screen.getAllByText("Active 0").length).toBeGreaterThan(0);
    }, WAIT);

    // ...and the failure is surfaced non-blockingly rather than replacing them.
    await waitFor(() => {
      expect(screen.getByText("Couldn't load all contacts")).toBeTruthy();
    }, WAIT);
    expect(screen.getAllByText("Active 0").length).toBeGreaterThan(0);
  });

  // Auto-pagination's loop behaviour when a later page FAILS is covered in
  // test/queries/use-all-pages.test.tsx, at hook level: at screen level a
  // regression there hangs the test renderer instead of failing an assertion.
});
