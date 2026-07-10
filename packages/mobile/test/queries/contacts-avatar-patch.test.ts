import { QueryClient } from "@tanstack/react-query";
import {
  contactKeys,
  keepContactAvatarPatched,
} from "../../src/queries/contacts";

// Queries cache the RAW client response; `select` unwraps per-hook.
const envelope = <T>(data: T) => ({
  status: 200 as const,
  data,
  headers: {} as Headers,
});

const pagination = { total: 2, limit: 100, offset: 0 };
const LOCAL_URI = "file:///cache/photo.jpg";

type TestContact = { id: string; name: string; avatarUrl: string | null };

const alice = (): TestContact => ({ id: "c1", name: "Alice", avatarUrl: null });
const bob = (): TestContact => ({
  id: "c2",
  name: "Bob",
  avatarUrl: "https://r2.example/bob.jpg",
});

function seedCaches(qc: QueryClient) {
  qc.setQueryData(
    contactKeys.all,
    envelope({ items: [alice(), bob()], pagination }),
  );
  qc.setQueryData(contactKeys.allPages, {
    pages: [
      envelope({ items: [alice()], pagination }),
      envelope({ items: [bob()], pagination }),
    ],
    pageParams: [0, 100],
  });
  qc.setQueryData(contactKeys.detail("c1"), envelope(alice()));
  qc.setQueryData(
    ["contacts", "by-tag", "t1"],
    envelope({ items: [alice()], pagination }),
  );
}

const listItems = (qc: QueryClient) =>
  (qc.getQueryData(contactKeys.all) as any).data.items as TestContact[];
const pageItems = (qc: QueryClient, page: number) =>
  (qc.getQueryData(contactKeys.allPages) as any).pages[page].data
    .items as TestContact[];
const detailContact = (qc: QueryClient) =>
  (qc.getQueryData(contactKeys.detail("c1")) as any).data as TestContact;
const byTagItems = (qc: QueryClient) =>
  (qc.getQueryData(["contacts", "by-tag", "t1"]) as any).data
    .items as TestContact[];

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("keepContactAvatarPatched", () => {
  let qc: QueryClient;
  let stop: (() => void) | undefined;

  beforeEach(() => {
    qc = new QueryClient();
    seedCaches(qc);
    stop = undefined;
  });

  afterEach(() => {
    stop?.();
    qc.clear();
  });

  it("patches the target contact's empty avatar across all cached shapes", () => {
    stop = keepContactAvatarPatched(qc, "c1", LOCAL_URI);

    expect(listItems(qc).find((c) => c.id === "c1")?.avatarUrl).toBe(LOCAL_URI);
    expect(pageItems(qc, 0).find((c) => c.id === "c1")?.avatarUrl).toBe(
      LOCAL_URI,
    );
    expect(detailContact(qc).avatarUrl).toBe(LOCAL_URI);
    expect(byTagItems(qc).find((c) => c.id === "c1")?.avatarUrl).toBe(
      LOCAL_URI,
    );
    // Other contacts untouched.
    expect(listItems(qc).find((c) => c.id === "c2")?.avatarUrl).toBe(
      bob().avatarUrl,
    );
  });

  it("never overwrites a real remote avatar that is already cached", () => {
    const before = qc.getQueryState(contactKeys.all)!.dataUpdateCount;

    stop = keepContactAvatarPatched(qc, "c2", LOCAL_URI);

    expect(listItems(qc).find((c) => c.id === "c2")?.avatarUrl).toBe(
      bob().avatarUrl,
    );
    // Updater bailed out — no cache write happened at all for c2's queries.
    expect(qc.getQueryState(contactKeys.all)!.dataUpdateCount).toBe(before);
  });

  it("re-applies the patch when a refetch lands with a still-null avatar", async () => {
    stop = keepContactAvatarPatched(qc, "c1", LOCAL_URI);

    // Simulate a server refetch landing (non-manual success event): the server
    // still has no avatar until the upload's updateContact completes.
    qc.getQueryCache()
      .find({ queryKey: contactKeys.all })!
      .setData(envelope({ items: [alice(), bob()], pagination }));
    await flush();

    expect(listItems(qc).find((c) => c.id === "c1")?.avatarUrl).toBe(LOCAL_URI);
  });

  it("stops re-applying after unsubscribe", async () => {
    stop = keepContactAvatarPatched(qc, "c1", LOCAL_URI);
    stop();
    stop = undefined;

    qc.getQueryCache()
      .find({ queryKey: contactKeys.all })!
      .setData(envelope({ items: [alice(), bob()], pagination }));
    await flush();

    expect(listItems(qc).find((c) => c.id === "c1")?.avatarUrl).toBeNull();
  });

  it("does not loop on its own cache writes", async () => {
    stop = keepContactAvatarPatched(qc, "c1", LOCAL_URI);
    const after = qc.getQueryState(contactKeys.all)!.dataUpdateCount;

    await flush();
    await flush();

    // Our own (manual) writes are filtered and the updater bails when nothing
    // changes, so the count must not keep growing.
    expect(qc.getQueryState(contactKeys.all)!.dataUpdateCount).toBe(after);
  });

  it("lets the remote URL through once the refetch carries it", async () => {
    stop = keepContactAvatarPatched(qc, "c1", LOCAL_URI);

    // Upload finished: a refetch now carries the real remote URL. The patch
    // guard (`!avatarUrl`) must leave it alone.
    const uploaded = { ...alice(), avatarUrl: "https://r2.example/alice.jpg" };
    qc.getQueryCache()
      .find({ queryKey: contactKeys.all })!
      .setData(envelope({ items: [uploaded, bob()], pagination }));
    await flush();

    expect(listItems(qc).find((c) => c.id === "c1")?.avatarUrl).toBe(
      "https://r2.example/alice.jpg",
    );
  });
});
