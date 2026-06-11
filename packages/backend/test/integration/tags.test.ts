import {
  createContact,
  getContactById,
  updateContact,
  initializeApiClient,
  listTags,
  createTag,
  updateTag,
  deleteTag,
  getContacts,
} from "@orbital/client";
import { backend } from "@orbital/testing";
import { createTestToken } from "@orbital/testing/backend/auth";
import {
  axFieldContent,
  startMockLLMServer,
  type MockLLMServer,
} from "@orbital/testing/backend/llm";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "bun:test";
import { loadSettings } from "../../src/config";
import type { DatabaseClient } from "../../src/database/client";
import * as schema from "../../src/database/schema";
import { startServer } from "../../src/server";
import { resetLLMClient } from "../../src/services/llm";

type TestServer = backend.TestServer;

describe("Contact Tags", () => {
  let server: TestServer;
  let db: DatabaseClient;
  let mockLLM: MockLLMServer;
  let user1Token: string;
  let user2Token: string;

  beforeAll(async () => {
    db = await backend.createTestDatabase({
      schema,
      migrationsPath: "./src/database/migrations",
    });
    // LLM calls run through the real AxGen pipeline against a local
    // mock OpenAI-compat server — only the network hop is faked.
    mockLLM = await startMockLLMServer();
    server = await backend.startTestServer({
      startServer,
      loadSettings,
      envOverrides: {
        LLM_BASE_URL: mockLLM.url,
        LLM_API_KEY: "fake-key",
        LLM_FAST_MODEL: "fake-model",
      },
    });

    user1Token = await createTestToken({
      sub: "user-1",
      email: "user1@example.com",
    });
    user2Token = await createTestToken({
      sub: "user-2",
      email: "user2@example.com",
    });

    initializeApiClient({
      baseURL: `${server.url}/rpc`,
      getToken: () => user1Token,
    });
  });

  afterAll(() => {
    server.stop();
    mockLLM.stop();
    resetLLMClient();
  });

  beforeEach(async () => {
    mockLLM.reset();
    await backend.clearDatabase(db, { schema });
    await backend.seedTestUser(db, "user-1", { schema });
    await backend.seedTestUser(db, "user-2", { schema });
  });

  // ─── Static tags via createContact ──────────────────────────────────────────

  describe("Static tags on createContact", () => {
    it("should assign static tags returned by getContact", async () => {
      const createRes = await createContact({
        name: "Alice",
        tags: ["investor", "sf-bay-area"],
      });
      if (createRes.status !== 200)
        throw new Error("Expected 200 from createContact");

      const getRes = await getContactById(createRes.data.id);
      if (getRes.status !== 200)
        throw new Error("Expected 200 from getContactById");

      const contact = getRes.data;
      expect(contact.tags).toHaveLength(2);
      const names = (contact.tags ?? []).map((t) => t.name).sort();
      expect(names).toEqual(["investor", "sf-bay-area"].sort());
      expect((contact.tags ?? []).every((t) => t.isDynamic === false)).toBe(
        true,
      );
    });

    it("should create entries in the tag pool for new names", async () => {
      await createContact({ name: "Alice", tags: ["investor"] });

      const listRes = await listTags();
      if (listRes.status !== 200) throw new Error("Expected 200 from listTags");
      expect(listRes.data.some((t) => t.name === "investor")).toBe(true);
    });

    it("should return an empty tags array when no tags are given", async () => {
      const createRes = await createContact({ name: "Bob" });
      if (createRes.status !== 200)
        throw new Error("Expected 200 from createContact");

      const getRes = await getContactById(createRes.data.id);
      if (getRes.status !== 200)
        throw new Error("Expected 200 from getContactById");
      expect(getRes.data.tags).toEqual([]);
    });

    it("should reuse a single tag pool row when two contacts share the same name", async () => {
      await createContact({ name: "Alice", tags: ["investor"] });
      await createContact({ name: "Bob", tags: ["investor"] });

      const listRes = await listTags();
      if (listRes.status !== 200) throw new Error("Expected 200 from listTags");
      const investorRows = listRes.data.filter((t) => t.name === "investor");
      expect(investorRows).toHaveLength(1);
    });
  });

  // ─── Static tags via updateContact ──────────────────────────────────────────

  describe("Static tags on updateContact", () => {
    it("should replace existing static tags with the new set", async () => {
      const createRes = await createContact({
        name: "Alice",
        tags: ["a", "b"],
      });
      if (createRes.status !== 200)
        throw new Error("Expected 200 from createContact");

      await updateContact(createRes.data.id, { tags: ["c"] });

      const getRes = await getContactById(createRes.data.id);
      if (getRes.status !== 200)
        throw new Error("Expected 200 from getContactById");
      const staticNames = (getRes.data.tags ?? [])
        .filter((t) => !t.isDynamic)
        .map((t) => t.name);
      expect(staticNames).toEqual(["c"]);
    });

    it("should clear all static tags when updated with an empty array", async () => {
      const createRes = await createContact({
        name: "Alice",
        tags: ["investor"],
      });
      if (createRes.status !== 200)
        throw new Error("Expected 200 from createContact");

      await updateContact(createRes.data.id, { tags: [] });

      const getRes = await getContactById(createRes.data.id);
      if (getRes.status !== 200)
        throw new Error("Expected 200 from getContactById");
      expect((getRes.data.tags ?? []).filter((t) => !t.isDynamic)).toHaveLength(
        0,
      );
    });

    it("should preserve dynamic tags when only updating the static set", async () => {
      mockLLM.setContent(axFieldContent({ tags: ["startup"] }));
      const createRes = await createContact({
        name: "Alice",
        notes: "Runs a startup.",
      });
      if (createRes.status !== 200)
        throw new Error("Expected 200 from createContact");
      const contactId = createRes.data.id;
      await new Promise((r) => setTimeout(r, 200));
      mockLLM.reset();

      await updateContact(contactId, { tags: ["investor"] });

      const getRes = await getContactById(contactId);
      if (getRes.status !== 200)
        throw new Error("Expected 200 from getContactById");
      const tags = getRes.data.tags ?? [];
      const dynamicNames = tags.filter((t) => t.isDynamic).map((t) => t.name);
      const staticNames = tags.filter((t) => !t.isDynamic).map((t) => t.name);
      expect(dynamicNames).toContain("startup");
      expect(staticNames).toEqual(["investor"]);
    });
  });

  // ─── Dynamic tags on createContact ──────────────────────────────────────────

  describe("Dynamic tags on createContact", () => {
    it("should generate dynamic tags from notes via mocked LLM", async () => {
      mockLLM.setContent(axFieldContent({ tags: ["startup", "fintech"] }));
      const createRes = await createContact({
        name: "Alice",
        notes: "Runs a startup in fintech.",
      });
      if (createRes.status !== 200)
        throw new Error("Expected 200 from createContact");

      // Wait for the background waitUntil to complete
      await new Promise((r) => setTimeout(r, 200));

      const getRes = await getContactById(createRes.data.id);
      if (getRes.status !== 200)
        throw new Error("Expected 200 from getContactById");
      const dynamicNames = (getRes.data.tags ?? [])
        .filter((t) => t.isDynamic)
        .map((t) => t.name);
      expect(dynamicNames).toContain("startup");
      expect(dynamicNames).toContain("fintech");
      // The tag request went over the wire through the real AxGen pipeline
      expect(mockLLM.requests.length).toBeGreaterThan(0);
    });

    it("should not add a dynamic entry for a tag that is already static", async () => {
      mockLLM.setContent(axFieldContent({ tags: ["investor", "startup"] }));
      const createRes = await createContact({
        name: "Alice",
        notes: "Investor in startups.",
        tags: ["investor"],
      });
      if (createRes.status !== 200)
        throw new Error("Expected 200 from createContact");

      await new Promise((r) => setTimeout(r, 200));

      const getRes = await getContactById(createRes.data.id);
      if (getRes.status !== 200)
        throw new Error("Expected 200 from getContactById");
      const tags = getRes.data.tags ?? [];

      // "investor" must appear exactly once, as static
      const investorEntries = tags.filter((t) => t.name === "investor");
      expect(investorEntries).toHaveLength(1);
      expect(investorEntries[0].isDynamic).toBe(false);
      // "startup" added as dynamic
      const dynamicNames = tags.filter((t) => t.isDynamic).map((t) => t.name);
      expect(dynamicNames).toContain("startup");
    });

    it("should not invoke the LLM when no notes are present", async () => {
      mockLLM.setContent(axFieldContent({ tags: ["startup"] }));
      const createRes = await createContact({ name: "Alice" });
      if (createRes.status !== 200)
        throw new Error("Expected 200 from createContact");

      await new Promise((r) => setTimeout(r, 200));

      const getRes = await getContactById(createRes.data.id);
      if (getRes.status !== 200)
        throw new Error("Expected 200 from getContactById");
      expect((getRes.data.tags ?? []).filter((t) => t.isDynamic)).toHaveLength(
        0,
      );
      // No LLM request may hit the wire — no notes, no email
      expect(mockLLM.requests).toHaveLength(0);
    });

    it("should leave static tags intact and not throw when LLM errors", async () => {
      mockLLM.setError();
      const createRes = await createContact({
        name: "Alice",
        notes: "Some notes.",
        tags: ["investor"],
      });
      if (createRes.status !== 200)
        throw new Error("Expected 200 from createContact");

      await new Promise((r) => setTimeout(r, 200));

      const getRes = await getContactById(createRes.data.id);
      if (getRes.status !== 200)
        throw new Error("Expected 200 from getContactById");
      const tags = getRes.data.tags ?? [];
      expect(tags.some((t) => t.name === "investor")).toBe(true);
      expect(tags.filter((t) => t.isDynamic)).toHaveLength(0);
    });

    it("should split comma-separated tags within a single array element", async () => {
      // Raw wire content: a JSON array whose single element holds two
      // comma-joined names — the service must split it
      mockLLM.setContent('Tags: ["Cloudflare, Professional"]');
      const createRes = await createContact({
        name: "Alice",
        notes: "Works at Cloudflare.",
      });
      if (createRes.status !== 200)
        throw new Error("Expected 200 from createContact");

      await new Promise((r) => setTimeout(r, 200));

      const getRes = await getContactById(createRes.data.id);
      if (getRes.status !== 200)
        throw new Error("Expected 200 from getContactById");
      const dynamicNames = (getRes.data.tags ?? [])
        .filter((t) => t.isDynamic)
        .map((t) => t.name);
      expect(dynamicNames).toContain("Cloudflare");
      expect(dynamicNames).toContain("Professional");
      expect(dynamicNames).not.toContain("Cloudflare, Professional");
    });

    it("should handle a bare string (non-array) LLM response", async () => {
      // Raw wire content: no JSON array at all, just comma-joined names
      mockLLM.setContent("Tags: Cloudflare, Professional");
      const createRes = await createContact({
        name: "Bob",
        notes: "Works at Cloudflare.",
      });
      if (createRes.status !== 200)
        throw new Error("Expected 200 from createContact");

      await new Promise((r) => setTimeout(r, 200));

      const getRes = await getContactById(createRes.data.id);
      if (getRes.status !== 200)
        throw new Error("Expected 200 from getContactById");
      const dynamicNames = (getRes.data.tags ?? [])
        .filter((t) => t.isDynamic)
        .map((t) => t.name);
      expect(dynamicNames).toContain("Cloudflare");
      expect(dynamicNames).toContain("Professional");
      expect(dynamicNames).not.toContain("Cloudflare, Professional");
    });
  });

  // ─── Dynamic tags on updateContact ──────────────────────────────────────────

  describe("Dynamic tags on updateContact", () => {
    it("should replace old dynamic tags when notes are updated", async () => {
      mockLLM.setContent(axFieldContent({ tags: ["fintech"] }));
      const createRes = await createContact({
        name: "Alice",
        notes: "Works in fintech.",
      });
      if (createRes.status !== 200)
        throw new Error("Expected 200 from createContact");
      const contactId = createRes.data.id;
      await new Promise((r) => setTimeout(r, 200));

      // Swap the mocked response before the update so it returns new tags
      mockLLM.setContent(axFieldContent({ tags: ["healthtech"] }));
      await updateContact(contactId, { notes: "Switched to healthtech." });
      await new Promise((r) => setTimeout(r, 200));

      const getRes = await getContactById(contactId);
      if (getRes.status !== 200)
        throw new Error("Expected 200 from getContactById");
      const dynamicNames = (getRes.data.tags ?? [])
        .filter((t) => t.isDynamic)
        .map((t) => t.name);
      expect(dynamicNames).toContain("healthtech");
      expect(dynamicNames).not.toContain("fintech");
    });

    it("should preserve static tags while replacing dynamic ones on notes update", async () => {
      mockLLM.setContent(axFieldContent({ tags: ["startup"] }));
      const createRes = await createContact({
        name: "Alice",
        notes: "Startup founder.",
        tags: ["vip"],
      });
      if (createRes.status !== 200)
        throw new Error("Expected 200 from createContact");
      const contactId = createRes.data.id;
      await new Promise((r) => setTimeout(r, 200));

      mockLLM.setContent(axFieldContent({ tags: ["vc"] }));
      await updateContact(contactId, { notes: "Now at a VC firm." });
      await new Promise((r) => setTimeout(r, 200));

      const getRes = await getContactById(contactId);
      if (getRes.status !== 200)
        throw new Error("Expected 200 from getContactById");
      const tags = getRes.data.tags ?? [];
      expect(tags.some((t) => t.name === "vip" && !t.isDynamic)).toBe(true);
      expect(tags.some((t) => t.name === "vc" && t.isDynamic)).toBe(true);
      expect(tags.some((t) => t.name === "startup")).toBe(false);
    });
  });

  // ─── Tags CRUD (/tags endpoints) ────────────────────────────────────────────

  describe("Tags CRUD", () => {
    it("GET /tags returns an empty list when the user has no tags", async () => {
      const res = await listTags();
      if (res.status !== 200) throw new Error("Expected 200 from listTags");
      expect(res.data).toEqual([]);
    });

    it("POST /tags creates a tag with an optional color", async () => {
      const res = await createTag({ name: "vip", color: "#ff0000" });
      if (res.status !== 200) throw new Error("Expected 200 from createTag");
      expect(res.data.name).toBe("vip");
      expect(res.data.color).toBe("#ff0000");
      expect(typeof res.data.id).toBe("string");
    });

    it("GET /tags returns all tags created for the user", async () => {
      await createTag({ name: "a" });
      await createTag({ name: "b" });

      const res = await listTags();
      if (res.status !== 200) throw new Error("Expected 200 from listTags");
      const names = res.data.map((t) => t.name).sort();
      expect(names).toContain("a");
      expect(names).toContain("b");
    });

    it("PUT /tags/{id} updates name and color", async () => {
      const createRes = await createTag({ name: "old-name" });
      if (createRes.status !== 200)
        throw new Error("Expected 200 from createTag");

      const updateRes = await updateTag(createRes.data.id, {
        name: "new-name",
        color: "#00ff00",
      });
      if (updateRes.status !== 200)
        throw new Error("Expected 200 from updateTag");
      expect(updateRes.data.name).toBe("new-name");
      expect(updateRes.data.color).toBe("#00ff00");
    });

    it("DELETE /tags/{id} removes the tag", async () => {
      const createRes = await createTag({ name: "to-delete" });
      if (createRes.status !== 200)
        throw new Error("Expected 200 from createTag");

      const delRes = await deleteTag(createRes.data.id);
      expect(delRes.status).toBe(200);

      const listRes = await listTags();
      if (listRes.status !== 200) throw new Error("Expected 200 from listTags");
      expect(listRes.data.some((t) => t.id === createRes.data.id)).toBe(false);
    });

    it("DELETE /tags/{id} cascades to remove contact_tag rows", async () => {
      const contactRes = await createContact({
        name: "Alice",
        tags: ["cascade-test"],
      });
      if (contactRes.status !== 200)
        throw new Error("Expected 200 from createContact");

      const listRes = await listTags();
      if (listRes.status !== 200) throw new Error("Expected 200 from listTags");
      const tag = listRes.data.find((t) => t.name === "cascade-test");
      if (!tag) throw new Error("Expected cascade-test tag to exist");

      await deleteTag(tag.id);

      const getRes = await getContactById(contactRes.data.id);
      if (getRes.status !== 200)
        throw new Error("Expected 200 from getContactById");
      expect(
        (getRes.data.tags ?? []).some((t) => t.name === "cascade-test"),
      ).toBe(false);
    });

    it("enforces user isolation — user2 cannot see user1's tags", async () => {
      await createTag({ name: "private" });

      const res = await listTags({
        headers: { Authorization: `Bearer ${user2Token}` },
      });
      if (res.status !== 200) throw new Error("Expected 200 from listTags");
      expect(res.data.some((t) => t.name === "private")).toBe(false);
    });

    it("returns 404 when user2 tries to delete user1's tag", async () => {
      const createRes = await createTag({ name: "user1-tag" });
      if (createRes.status !== 200)
        throw new Error("Expected 200 from createTag");

      const delRes = await deleteTag(createRes.data.id, undefined, {
        headers: { Authorization: `Bearer ${user2Token}` },
      });
      expect(delRes.status).toBe(404);
    });

    it("returns 409 when creating a tag with a duplicate name", async () => {
      await createTag({ name: "dupe" });
      const res = await createTag({ name: "dupe" });
      expect(res.status as number).toBe(409);
    });

    it("returns 400 when updating a tag with neither name nor color", async () => {
      const createRes = await createTag({ name: "patch-me" });
      if (createRes.status !== 200)
        throw new Error("Expected 200 from createTag");

      const res = await updateTag(createRes.data.id, {});
      expect(res.status).toBe(400);
    });

    it("returns 401 when no auth token is provided", async () => {
      const res = await fetch(`${server.url}/rpc/tags`);
      expect(res.status).toBe(401);
    });
  });

  // ─── GET /contacts?tagId filtering ──────────────────────────────────────────

  describe("GET /contacts?tagId filtering", () => {
    it("returns only contacts that have the given tag", async () => {
      const alice = await createContact({ name: "Alice", tags: ["vip"] });
      const bob = await createContact({ name: "Bob", tags: ["regular"] });
      if (alice.status !== 200 || bob.status !== 200)
        throw new Error("createContact failed");

      const tagsRes = await listTags();
      if (tagsRes.status !== 200) throw new Error("Expected 200 from listTags");
      const vipTag = tagsRes.data.find((t) => t.name === "vip");
      if (!vipTag) throw new Error("Expected vip tag to exist");

      const res = await getContacts({
        tagId: vipTag.id,
        limit: 100,
        offset: 0,
      });
      if (res.status !== 200)
        throw new Error(`Expected 200, got ${res.status}`);
      const names = res.data.items.map((c) => c.name);
      expect(names).toContain("Alice");
      expect(names).not.toContain("Bob");
    });

    it("returns multiple contacts that share the same tag", async () => {
      await createContact({ name: "Alice", tags: ["shared"] });
      await createContact({ name: "Bob", tags: ["shared"] });
      await createContact({ name: "Carol", tags: ["other"] });

      const tagsRes = await listTags();
      if (tagsRes.status !== 200) throw new Error("Expected 200 from listTags");
      const sharedTag = tagsRes.data.find((t) => t.name === "shared");
      if (!sharedTag) throw new Error("Expected shared tag to exist");

      const res = await getContacts({
        tagId: sharedTag.id,
        limit: 100,
        offset: 0,
      });
      if (res.status !== 200)
        throw new Error(`Expected 200, got ${res.status}`);
      const names = res.data.items.map((c) => c.name);
      expect(names).toContain("Alice");
      expect(names).toContain("Bob");
      expect(names).not.toContain("Carol");
      expect(res.data.pagination.total).toBe(2);
    });

    it("returns an empty list when no contacts have the given tag", async () => {
      await createContact({ name: "Alice", tags: ["other"] });
      const orphanTag = await createTag({ name: "empty-tag" });
      if (orphanTag.status !== 200)
        throw new Error("Expected 200 from createTag");

      const res = await getContacts({
        tagId: orphanTag.data.id,
        limit: 100,
        offset: 0,
      });
      if (res.status !== 200)
        throw new Error(`Expected 200, got ${res.status}`);
      expect(res.data.items).toHaveLength(0);
      expect(res.data.pagination.total).toBe(0);
    });

    it("does not return contacts from another user when filtering by tag", async () => {
      // user1 creates a contact with tag "cross"
      await createContact({ name: "User1Contact", tags: ["cross"] });

      const tagsRes = await listTags();
      if (tagsRes.status !== 200) throw new Error("Expected 200 from listTags");
      const crossTag = tagsRes.data.find((t) => t.name === "cross");
      if (!crossTag) throw new Error("Expected cross tag");

      // user2 queries with user1's tag ID — should return nothing
      const res = await getContacts(
        { tagId: crossTag.id, limit: 100, offset: 0 },
        { headers: { Authorization: `Bearer ${user2Token}` } },
      );
      if (res.status !== 200)
        throw new Error(`Expected 200, got ${res.status}`);
      expect(res.data.items).toHaveLength(0);
    });
  });
});
