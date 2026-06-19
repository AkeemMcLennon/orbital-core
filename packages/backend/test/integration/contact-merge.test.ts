import {
  createContact,
  getContactById,
  mergeContact,
  initializeApiClient,
  isSuccess,
  getSuccessData,
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
} from "bun:test";
import { loadSettings } from "../../src/config";
import * as schema from "../../src/database/schema";
import { startServer } from "../../src/server";

type TestServer = backend.TestServer;

describe("Contact Merge API", () => {
  let server: TestServer;
  let token: string;

  beforeAll(async () => {
    await backend.createTestDatabase({
      schema,
      migrationsPath: "./src/database/migrations",
    });
    server = await backend.startTestServer({ startServer, loadSettings });
    token = await createTestToken({
      sub: "merge-user-1",
      email: "merge@example.com",
    });
    initializeApiClient({
      baseURL: `${server.url}/rpc`,
      getToken: () => token,
    });
  });

  afterAll(() => server.stop());

  beforeEach(async () => {
    // Re-initialize so each test starts with user1 as the default
    initializeApiClient({
      baseURL: `${server.url}/rpc`,
      getToken: () => token,
    });
  });

  it("inherits empty fields from source into destination", async () => {
    const destRes = await createContact({
      name: "Destination Contact",
      email: "dest@example.com",
    });
    const srcRes = await createContact({
      name: "Source Contact",
      phone: "+15550001234",
      company: "Acme Corp",
      jobTitle: "Engineer",
    });

    expect(isSuccess(destRes)).toBe(true);
    expect(isSuccess(srcRes)).toBe(true);

    const dest = getSuccessData(destRes)!;
    const src = getSuccessData(srcRes)!;

    const mergeRes = await mergeContact(dest.id, { sourceId: src.id });
    expect(isSuccess(mergeRes)).toBe(true);

    const merged = getSuccessData(mergeRes)!;
    expect(merged.id).toBe(dest.id);
    expect(merged.name).toBe("Destination Contact");
    expect(merged.email).toBe("dest@example.com");
    expect(merged.phone).toBe("+15550001234");
    expect(merged.company).toBe("Acme Corp");
    expect(merged.jobTitle).toBe("Engineer");
  });

  it("keeps destination field when both contacts have a value", async () => {
    const destRes = await createContact({
      name: "Has Email",
      email: "original@example.com",
    });
    const srcRes = await createContact({
      name: "Also Has Email",
      email: "should-not-overwrite@example.com",
    });

    const dest = getSuccessData(destRes)!;
    const src = getSuccessData(srcRes)!;

    const mergeRes = await mergeContact(dest.id, { sourceId: src.id });
    const merged = getSuccessData(mergeRes)!;

    expect(merged.email).toBe("original@example.com");
  });

  it("deletes the source contact after merge", async () => {
    const destRes = await createContact({ name: "Keeps" });
    const srcRes = await createContact({ name: "Deleted After Merge" });

    const dest = getSuccessData(destRes)!;
    const src = getSuccessData(srcRes)!;

    await mergeContact(dest.id, { sourceId: src.id });

    const fetchSrc = await getContactById(src.id);
    expect(isSuccess(fetchSrc)).toBe(false);
  });

  it("returns 400 when sourceId equals destinationId", async () => {
    const contactRes = await createContact({ name: "Self Merge" });
    const contact = getSuccessData(contactRes)!;

    const res = await mergeContact(contact.id, { sourceId: contact.id });
    expect(res.status).toBe(400);
  });

  it("returns 404 for unknown destination", async () => {
    const srcRes = await createContact({ name: "Valid Source" });
    const src = getSuccessData(srcRes)!;

    const res = await mergeContact("nonexistentid12345678", {
      sourceId: src.id,
    });
    expect(res.status).toBe(404);
  });

  it("returns 404 for unknown source", async () => {
    const destRes = await createContact({ name: "Valid Dest" });
    const dest = getSuccessData(destRes)!;

    const res = await mergeContact(dest.id, {
      sourceId: "nonexistentid12345678",
    });
    expect(res.status).toBe(404);
  });
});
