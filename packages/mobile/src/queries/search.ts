import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getSettings, searchContacts, unwrapAsync } from "@orbital/client";

export type SearchConfig = {
  url: string;
  token: string;
  indexName: string;
};

export type SearchHit = {
  id: string;
  name: string;
  email?: string | null;
  avatarUrl?: string | null;
  jobTitle?: string | null;
  company?: string | null;
  // Tag names the query matched on (Meilisearch path only); shown as chips in the row.
  matchedTags?: string[];
};

// A raw Meilisearch hit: the indexed doc plus, when attributesToHighlight is set,
// a `_formatted` copy with <em>…</em> around matched text.
type MeiliHit = SearchHit & {
  tags?: string[];
  _formatted?: { tags?: string[] };
};

// Tag names whose highlighted form contains a match marker.
function matchedTagsFromHit(hit: MeiliHit): string[] {
  const raw = hit.tags;
  const formatted = hit._formatted?.tags;
  if (!Array.isArray(raw) || !Array.isArray(formatted)) return [];
  return raw.filter(
    (_, i) => typeof formatted[i] === "string" && formatted[i].includes("<em>"),
  );
}

export const searchKeys = {
  config: ["search", "config"] as const,
  results: (q: string) => ["search", "results", q] as const,
  fallback: (q: string) => ["search", "fallback", q] as const,
};

// How long to wait on the direct Meilisearch request before giving up and using
// the server-side fallback. Some release builds can't reach the Meili cloud host
// directly; without this the request would hang and the UI would spin forever.
const MEILI_TIMEOUT_MS = 4000;

// Server-side contact search via the backend (SQL LIKE). Only needs the app's
// own API host, so it works wherever the rest of the app does.
async function serverSearch(q: string): Promise<SearchHit[]> {
  const res = await unwrapAsync(
    searchContacts({ query: q, limit: 20, offset: 0 }),
  );
  return (res?.items ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    email: c.email,
    avatarUrl: c.avatarUrl,
    jobTitle: c.jobTitle,
    company: c.company,
  }));
}

/**
 * Fetches the Meilisearch tenant config from the backend `/settings` endpoint.
 * Returns null when search is not configured on the server.
 */
export function useSearchConfig() {
  return useQuery({
    queryKey: searchKeys.config,
    queryFn: () => unwrapAsync(getSettings()),
    select: (res): SearchConfig | null => res?.search ?? null,
    // Tenant token is valid for 1h — refetch well before expiry.
    staleTime: 50 * 60 * 1000,
  });
}

/**
 * Runs a fuzzy search against Meilisearch using the scoped tenant token.
 * Results are already restricted to the current user + instance by the token's
 * searchRules, so no extra filtering is needed here.
 */
export function useContactSearch(query: string, config: SearchConfig | null) {
  const q = query.trim();

  return useQuery({
    queryKey: searchKeys.results(q),
    // `config != null` gates this hook; the no-config case is served by
    // useContactSearchFallback instead.
    enabled: q.length > 0 && config != null,
    staleTime: 30 * 1000,
    // Keep the previous results visible while the next query loads (no flicker).
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<SearchHit[]> => {
      // Non-null by the `enabled` guard above; narrowing only.
      if (!config) return serverSearch(q);
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), MEILI_TIMEOUT_MS);
        const res = await fetch(
          `${config.url}/indexes/${config.indexName}/search`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${config.token}`,
            },
            body: JSON.stringify({
              q,
              limit: 20,
              // Ask Meili to mark matched text so we can tell which tag matched.
              attributesToHighlight: ["tags"],
            }),
            signal: controller.signal,
          },
        ).finally(() => clearTimeout(timer));
        if (!res.ok) {
          throw new Error(`Meilisearch search failed: ${res.status}`);
        }
        const data = (await res.json()) as { hits?: MeiliHit[] };
        return (data.hits ?? []).map((h) => ({
          id: h.id,
          name: h.name,
          email: h.email,
          avatarUrl: h.avatarUrl,
          jobTitle: h.jobTitle,
          company: h.company,
          matchedTags: matchedTagsFromHit(h),
        }));
      } catch {
        // Meilisearch unreachable/slow (or the request timed out) — fall back to
        // the server-side search so the user still gets results.
        return serverSearch(q);
      }
    },
  });
}

/**
 * Fallback search used when Meilisearch isn't configured: the server-side
 * contact search endpoint (SQL LIKE over name/email/company). Server-side rather
 * than filtering already-loaded contacts on the client.
 */
export function useContactSearchFallback(query: string, enabled: boolean) {
  const q = query.trim();

  return useQuery({
    queryKey: searchKeys.fallback(q),
    enabled: enabled && q.length > 0,
    staleTime: 30 * 1000,
    // Keep the previous results visible while the next query loads (no flicker).
    placeholderData: keepPreviousData,
    queryFn: () => serverSearch(q),
  });
}
