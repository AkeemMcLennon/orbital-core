import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react-native";

import { getContacts } from "@orbital/client";
import { useAllPages } from "../../src/queries/use-all-pages";
import { withMockApi } from "../helpers/mock-api";

/**
 * Hook-level rather than screen-level, deliberately.
 *
 * The behaviour under test — auto-advancing through pages, and NOT doing so
 * after a page fails — is a react-query state machine plus an effect. At screen
 * level a regression manifests as the test renderer hanging rather than as a
 * failed assertion, which makes for a useless (and misleading) test. Driving
 * the hook directly keeps the failure observable.
 */
describe("useAllPages", () => {
  const api = withMockApi();

  function wrapper({ children }: { children: React.ReactNode }) {
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false, staleTime: 0, gcTime: 0 },
      },
    });
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  }

  const page = (offset: number, count: number, total: number) => ({
    status: 200,
    body: {
      items: Array.from({ length: count }, (_, i) => ({
        id: `c${offset + i}`,
        name: `Contact ${offset + i}`,
      })),
      pagination: { total, limit: 100, offset },
    },
  });

  const renderAllPages = () =>
    renderHook(
      () =>
        useAllPages<{ id: string; name: string }>({
          queryKey: ["use-all-pages-test"],
          fetchPage: (p) => getContacts(p),
        }),
      { wrapper },
    );

  it("walks every page and flattens them", async () => {
    api().when("GET", "/contacts", (call) => {
      const offset = Number(call.query.offset ?? 0);
      return page(offset, offset === 0 ? 100 : 50, 150);
    });

    const { result } = renderAllPages();

    await waitFor(() => expect(result.current.data).toHaveLength(150));
    expect(
      api()
        .calls("/contacts")
        .map((c) => c.query.offset),
    ).toEqual(["0", "100"]);
  });

  it("stops auto-advancing when a later page fails, instead of looping", async () => {
    // Regression guard. A page failing AFTER the first does not put the query
    // into an error state — react-query still holds page 1, so `status` stays
    // "success" while `hasNextPage` stays true and `isFetchingNextPage` clears.
    // A flag-based guard therefore re-opens immediately and the effect spins.
    api().when("GET", "/contacts", (call) => {
      const offset = Number(call.query.offset ?? 0);
      return offset > 0
        ? { status: 500, body: { message: "boom" } }
        : page(0, 100, 150);
    });

    const { result } = renderAllPages();

    // Page 1 lands, then page 2 is attempted and fails.
    await waitFor(() => expect(api().calls("/contacts").length).toBe(2));
    await waitFor(() => expect(result.current.isFetchingNextPage).toBe(false));

    // Page 1's data is retained, and there is still a next page to fetch —
    // precisely the state that would re-trigger a naive auto-advance.
    expect(result.current.data).toHaveLength(100);
    expect(result.current.hasNextPage).toBe(true);

    // Give a runaway loop ample opportunity to fire.
    await new Promise((r) => setTimeout(r, 500));
    expect(api().calls("/contacts").length).toBe(2);
  });

  it("exposes the error ALONGSIDE the retained pages, not instead of them", async () => {
    // Pins the contract screens depend on. Unlike a plain useQuery — where a
    // failed refetch leaves `error` null while data is cached — an infinite
    // query surfaces both: `data` holds the loaded pages AND `error` is set
    // (`status` even becomes "error"). A screen that branches on `error` alone
    // would therefore hide contacts the user already has.
    api().when("GET", "/contacts", (call) => {
      const offset = Number(call.query.offset ?? 0);
      return offset > 0
        ? { status: 500, body: { message: "boom" } }
        : page(0, 100, 150);
    });

    const { result } = renderAllPages();

    await waitFor(() => expect(api().calls("/contacts").length).toBe(2));
    await waitFor(() => expect(result.current.error).not.toBeNull());

    expect(result.current.data).toHaveLength(100);
  });
});
