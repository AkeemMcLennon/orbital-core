import { AxGen } from "@ax-llm/ax";
import {
  createContact,
  getContactById,
  updateContact,
  initializeApiClient,
  listTags,
  createTag,
  updateTag,
  deleteTag,
} from "@orbital/client";
import { backend } from "@orbital/testing";
import { createTestToken } from "@orbital/testing/backend/auth";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  spyOn,
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
  let user1Token: string;
  let user2Token: string;

  beforeAll(async () => {
    db = await backend.createTestDatabase({
      schema,
      migrationsPath: "./src/database/migrations",
    });
    // Fake LLM config so getAI() initialises — actual calls are
    // intercepted per-test via spyOn(AxGen.prototype, "forward")
    server = await backend.startTestServer({
      startServer,
      loadSettings,
      envOverrides: {
        LLM_BASE_URL: "https://fake.llm.test/v1",
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
    resetLLMClient();
  });

  beforeEach(async () => {
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
      if (createRes.status !== 200) throw new Error("Expected 200 from createContact");

      const getRes = await getContactById(createRes.data.id);
      if (getRes.status !== 200) throw new Error("Expected 200 from getContactById");

      const contact = getRes.data;
      expect(contact.tags).toHaveLength(2);
      const names = (contact.tags ?? []).map(t => t.name).sort();
      expect(names).toEqual(["investor", "sf-bay-area"].sort());
      expect((contact.tags ?? []).every(t => t.isDynamic === false)).toBe(true);
    });

    it("should create entries in the tag pool for new names", async () => {
      await createContact({ name: "Alice", tags: ["investor"] });

      const listRes = await listTags();
      if (listRes.status !== 200) throw new Error("Expected 200 from listTags");
      expect(listRes.data.some(t => t.name === "investor")).toBe(true);
    });

    it("should return an empty tags array when no tags are given", async () => {
      const createRes = await createContact({ name: "Bob" });
      if (createRes.status !== 200) throw new Error("Expected 200 from createContact");

      const getRes = await getContactById(createRes.data.id);
      if (getRes.status !== 200) throw new Error("Expected 200 from getContactById");
      expect(getRes.data.tags).toEqual([]);
    });

    it("should reuse a single tag pool row when two contacts share the same name", async () => {
      await createContact({ name: "Alice", tags: ["investor"] });
      await createContact({ name: "Bob", tags: ["investor"] });

      const listRes = await listTags();
      if (listRes.status !== 200) throw new Error("Expected 200 from listTags");
      const investorRows = listRes.data.filter(t => t.name === "investor");
      expect(investorRows).toHaveLength(1);
    });
  });

  // ─── Static tags via updateContact ──────────────────────────────────────────

  describe("Static tags on updateContact", () => {
    it("should replace existing static tags with the new set", async () => {
      const createRes = await createContact({ name: "Alice", tags: ["a", "b"] });
      if (createRes.status !== 200) throw new Error("Expected 200 from createContact");

      await updateContact(createRes.data.id, { tags: ["c"] });

      const getRes = await getContactById(createRes.data.id);
      if (getRes.status !== 200) throw new Error("Expected 200 from getContactById");
      const staticNames = (getRes.data.tags ?? [])
        .filter(t => !t.isDynamic)
        .map(t => t.name);
      expect(staticNames).toEqual(["c"]);
    });

    it("should clear all static tags when updated with an empty array", async () => {
      const createRes = await createContact({ name: "Alice", tags: ["investor"] });
      if (createRes.status !== 200) throw new Error("Expected 200 from createContact");

      await updateContact(createRes.data.id, { tags: [] });

      const getRes = await getContactById(createRes.data.id);
      if (getRes.status !== 200) throw new Error("Expected 200 from getContactById");
      expect((getRes.data.tags ?? []).filter(t => !t.isDynamic)).toHaveLength(0);
    });

    it("should preserve dynamic tags when only updating the static set", async () => {
      const spy = spyOn(AxGen.prototype, "forward").mockResolvedValue({
        tags: ["startup"],
      });
      const createRes = await createContact({
        name: "Alice",
        notes: "Runs a startup.",
      });
      if (createRes.status !== 200) throw new Error("Expected 200 from createContact");
      const contactId = createRes.data.id;
      await new Promise((r) => setTimeout(r, 200));
      spy.mockRestore();

      await updateContact(contactId, { tags: ["investor"] });

      const getRes = await getContactById(contactId);
      if (getRes.status !== 200) throw new Error("Expected 200 from getContactById");
      const tags = getRes.data.tags ?? [];
      const dynamicNames = tags.filter(t => t.isDynamic).map(t => t.name);
      const staticNames = tags.filter(t => !t.isDynamic).map(t => t.name);
      expect(dynamicNames).toContain("startup");
      expect(staticNames).toEqual(["investor"]);
    });
  });

  // ─── Dynamic tags on createContact ──────────────────────────────────────────

  describe("Dynamic tags on createContact", () => {
    it("should generate dynamic tags from notes via mocked LLM", async () => {
      const spy = spyOn(AxGen.prototype, "forward").mockResolvedValue({
        tags: ["startup", "fintech"],
      });
      try {
        const createRes = await createContact({
          name: "Alice",
          notes: "Runs a startup in fintech.",
        });
        if (createRes.status !== 200) throw new Error("Expected 200 from createContact");

        // Wait for the background waitUntil to complete
        await new Promise((r) => setTimeout(r, 200));

        const getRes = await getContactById(createRes.data.id);
        if (getRes.status !== 200) throw new Error("Expected 200 from getContactById");
        const dynamicNames = (getRes.data.tags ?? [])
          .filter(t => t.isDynamic)
          .map(t => t.name);
        expect(dynamicNames).toContain("startup");
        expect(dynamicNames).toContain("fintech");
      } finally {
        spy.mockRestore();
      }
    });

    it("should not add a dynamic entry for a tag that is already static", async () => {
      const spy = spyOn(AxGen.prototype, "forward").mockResolvedValue({
        tags: ["investor", "startup"],
      });
      try {
        const createRes = await createContact({
          name: "Alice",
          notes: "Investor in startups.",
          tags: ["investor"],
        });
        if (createRes.status !== 200) throw new Error("Expected 200 from createContact");

        await new Promise((r) => setTimeout(r, 200));

        const getRes = await getContactById(createRes.data.id);
        if (getRes.status !== 200) throw new Error("Expected 200 from getContactById");
        const tags = getRes.data.tags ?? [];

        // "investor" must appear exactly once, as static
        const investorEntries = tags.filter(t => t.name === "investor");
        expect(investorEntries).toHaveLength(1);
        expect(investorEntries[0].isDynamic).toBe(false);
        // "startup" added as dynamic
        const dynamicNames = tags.filter(t => t.isDynamic).map(t => t.name);
        expect(dynamicNames).toContain("startup");
      } finally {
        spy.mockRestore();
      }
    });

    it("should not invoke the LLM when no notes are present", async () => {
      const spy = spyOn(AxGen.prototype, "forward").mockResolvedValue({
        tags: ["startup"],
      });
      try {
        const createRes = await createContact({ name: "Alice" });
        if (createRes.status !== 200) throw new Error("Expected 200 from createContact");

        await new Promise((r) => setTimeout(r, 200));

        const getRes = await getContactById(createRes.data.id);
        if (getRes.status !== 200) throw new Error("Expected 200 from getContactById");
        expect((getRes.data.tags ?? []).filter(t => t.isDynamic)).toHaveLength(0);
        // AxGen.forward must not have been called for dynamic-tag generation
        // (may still be called zero times for memory-reps since there are no notes)
        expect(spy).not.toHaveBeenCalled();
      } finally {
        spy.mockRestore();
      }
    });

    it("should leave static tags intact and not throw when LLM errors", async () => {
      const spy = spyOn(AxGen.prototype, "forward").mockRejectedValue(
        new Error("LLM unavailable"),
      );
      try {
        const createRes = await createContact({
          name: "Alice",
          notes: "Some notes.",
          tags: ["investor"],
        });
        if (createRes.status !== 200) throw new Error("Expected 200 from createContact");

        await new Promise((r) => setTimeout(r, 200));

        const getRes = await getContactById(createRes.data.id);
        if (getRes.status !== 200) throw new Error("Expected 200 from getContactById");
        const tags = getRes.data.tags ?? [];
        expect(tags.some(t => t.name === "investor")).toBe(true);
        expect(tags.filter(t => t.isDynamic)).toHaveLength(0);
      } finally {
        spy.mockRestore();
      }
    });
  });

  // ─── Dynamic tags on updateContact ──────────────────────────────────────────

  describe("Dynamic tags on updateContact", () => {
    it("should replace old dynamic tags when notes are updated", async () => {
      const spy1 = spyOn(AxGen.prototype, "forward").mockResolvedValue({
        tags: ["fintech"],
      });
      const createRes = await createContact({
        name: "Alice",
        notes: "Works in fintech.",
      });
      if (createRes.status !== 200) throw new Error("Expected 200 from createContact");
      const contactId = createRes.data.id;
      await new Promise((r) => setTimeout(r, 200));
      spy1.mockRestore();

      // Set new mock before the update so the background task uses it
      const spy2 = spyOn(AxGen.prototype, "forward").mockResolvedValue({
        tags: ["healthtech"],
      });
      try {
        await updateContact(contactId, { notes: "Switched to healthtech." });
        await new Promise((r) => setTimeout(r, 200));

        const getRes = await getContactById(contactId);
        if (getRes.status !== 200) throw new Error("Expected 200 from getContactById");
        const dynamicNames = (getRes.data.tags ?? [])
          .filter(t => t.isDynamic)
          .map(t => t.name);
        expect(dynamicNames).toContain("healthtech");
        expect(dynamicNames).not.toContain("fintech");
      } finally {
        spy2.mockRestore();
      }
    });

    it("should preserve static tags while replacing dynamic ones on notes update", async () => {
      const spy1 = spyOn(AxGen.prototype, "forward").mockResolvedValue({
        tags: ["startup"],
      });
      const createRes = await createContact({
        name: "Alice",
        notes: "Startup founder.",
        tags: ["vip"],
      });
      if (createRes.status !== 200) throw new Error("Expected 200 from createContact");
      const contactId = createRes.data.id;
      await new Promise((r) => setTimeout(r, 200));
      spy1.mockRestore();

      const spy2 = spyOn(AxGen.prototype, "forward").mockResolvedValue({
        tags: ["vc"],
      });
      try {
        await updateContact(contactId, { notes: "Now at a VC firm." });
        await new Promise((r) => setTimeout(r, 200));

        const getRes = await getContactById(contactId);
        if (getRes.status !== 200) throw new Error("Expected 200 from getContactById");
        const tags = getRes.data.tags ?? [];
        expect(tags.some(t => t.name === "vip" && !t.isDynamic)).toBe(true);
        expect(tags.some(t => t.name === "vc" && t.isDynamic)).toBe(true);
        expect(tags.some(t => t.name === "startup")).toBe(false);
      } finally {
        spy2.mockRestore();
      }
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
      const names = res.data.map(t => t.name).sort();
      expect(names).toContain("a");
      expect(names).toContain("b");
    });

    it("PUT /tags/{id} updates name and color", async () => {
      const createRes = await createTag({ name: "old-name" });
      if (createRes.status !== 200) throw new Error("Expected 200 from createTag");

      const updateRes = await updateTag(createRes.data.id, { name: "new-name", color: "#00ff00" });
      if (updateRes.status !== 200) throw new Error("Expected 200 from updateTag");
      expect(updateRes.data.name).toBe("new-name");
      expect(updateRes.data.color).toBe("#00ff00");
    });

    it("DELETE /tags/{id} removes the tag", async () => {
      const createRes = await createTag({ name: "to-delete" });
      if (createRes.status !== 200) throw new Error("Expected 200 from createTag");

      const delRes = await deleteTag(createRes.data.id);
      expect(delRes.status).toBe(200);

      const listRes = await listTags();
      if (listRes.status !== 200) throw new Error("Expected 200 from listTags");
      expect(listRes.data.some(t => t.id === createRes.data.id)).toBe(false);
    });

    it("DELETE /tags/{id} cascades to remove contact_tag rows", async () => {
      const contactRes = await createContact({ name: "Alice", tags: ["cascade-test"] });
      if (contactRes.status !== 200) throw new Error("Expected 200 from createContact");

      const listRes = await listTags();
      if (listRes.status !== 200) throw new Error("Expected 200 from listTags");
      const tag = listRes.data.find(t => t.name === "cascade-test");
      if (!tag) throw new Error("Expected cascade-test tag to exist");

      await deleteTag(tag.id);

      const getRes = await getContactById(contactRes.data.id);
      if (getRes.status !== 200) throw new Error("Expected 200 from getContactById");
      expect((getRes.data.tags ?? []).some(t => t.name === "cascade-test")).toBe(false);
    });

    it("enforces user isolation — user2 cannot see user1's tags", async () => {
      await createTag({ name: "private" });

      const res = await listTags({ headers: { Authorization: `Bearer ${user2Token}` } });
      if (res.status !== 200) throw new Error("Expected 200 from listTags");
      expect(res.data.some(t => t.name === "private")).toBe(false);
    });

    it("returns 404 when user2 tries to delete user1's tag", async () => {
      const createRes = await createTag({ name: "user1-tag" });
      if (createRes.status !== 200) throw new Error("Expected 200 from createTag");

      const delRes = await deleteTag(createRes.data.id, undefined, {
        headers: { Authorization: `Bearer ${user2Token}` },
      });
      expect(delRes.status).toBe(404);
    });

    it("returns 409 when creating a tag with a duplicate name", async () => {
      await createTag({ name: "dupe" });
      const res = await createTag({ name: "dupe" });
      expect(res.status).toBe(409);
    });

    it("returns 400 when updating a tag with neither name nor color", async () => {
      const createRes = await createTag({ name: "patch-me" });
      if (createRes.status !== 200) throw new Error("Expected 200 from createTag");

      const res = await updateTag(createRes.data.id, {});
      expect(res.status).toBe(400);
    });

    it("returns 401 when no auth token is provided", async () => {
      const res = await fetch(`${server.url}/rpc/tags`);
      expect(res.status).toBe(401);
    });
  });
});
