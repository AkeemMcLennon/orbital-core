import { backend } from "@orbital/testing";
import { createTestToken } from "@orbital/testing/backend/auth";
import {
  axFieldContent,
  startMockLLMServer,
  type MockLLMServer,
} from "@orbital/testing/backend/llm";
import {
  contactsExtractFromImage,
  initializeApiClient,
  initializeDefaultClient,
} from "@orbital/client";
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

// Real-LLM E2E coverage lives in contact-extract.e2e.test.ts.
describe("Contact Extract API (unit)", () => {
  let server: TestServer;
  let db: DatabaseClient;
  let mockLLM: MockLLMServer;
  let token: string;

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
        LLM_VISION_MODEL: "fake-vision-model",
      },
    });

    token = await createTestToken({
      sub: "extract-user",
      email: "extract@example.com",
    });

    initializeApiClient({
      baseURL: `${server.url}/rpc`,
      getToken: async () => token,
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
    await backend.seedTestUser(db, "extract-user", { schema });
  });

  const FAKE_IMAGE = Buffer.from("fake-image-data").toString("base64");

  describe("extraction results", () => {
    it("should return all fields the LLM provides", async () => {
      mockLLM.setContent(
        axFieldContent({
          name: "Jane Doe",
          email: "jane@acme.com",
          phone: "+1 555 123 4567",
          jobTitle: "Software Engineer",
          company: "Acme Corp",
          linkedinUrl: "/in/janedoe",
          notes: "Jane is a software engineer at Acme Corp.",
        }),
      );

      const res = await contactsExtractFromImage({
        image: FAKE_IMAGE,
        mimeType: "image/png",
      });
      expect(res.status).toBe(200);
      expect(res.data).toMatchObject({
        name: "Jane Doe",
        email: "jane@acme.com",
        phone: "+1 555 123 4567",
        jobTitle: "Software Engineer",
        company: "Acme Corp",
        linkedinUrl: "/in/janedoe",
        notes: "Jane is a software engineer at Acme Corp.",
      });
    });

    it("should return a sparse object when only some fields are found", async () => {
      mockLLM.setContent(
        axFieldContent({ name: "John Smith", company: "Startup Inc" }),
      );

      const res = await contactsExtractFromImage({
        image: FAKE_IMAGE,
        mimeType: "image/jpeg",
      });
      expect(res.status).toBe(200);
      const data = res.data as Record<string, unknown>;
      expect(data).toEqual({ name: "John Smith", company: "Startup Inc" });
      expect(Object.keys(data)).toHaveLength(2);
    });

    it("should strip empty strings returned by the LLM", async () => {
      // Empty-valued sections on the wire — must not surface as ""
      mockLLM.setContent(
        axFieldContent({
          name: "Alice",
          email: "",
          jobTitle: "CEO",
          company: "",
        }),
      );

      const res = await contactsExtractFromImage({
        image: FAKE_IMAGE,
        mimeType: "image/png",
      });
      expect(res.status).toBe(200);
      const data = res.data as Record<string, unknown>;
      expect(data).toEqual({ name: "Alice", jobTitle: "CEO" });
      expect("email" in data).toBe(false);
      expect("company" in data).toBe(false);
    });

    it("should return an empty object when the LLM finds nothing", async () => {
      mockLLM.setContent("");

      const res = await contactsExtractFromImage({
        image: FAKE_IMAGE,
        mimeType: "image/png",
      });
      expect(res.status).toBe(200);
      expect(res.data).toEqual({});
    });
  });

  describe("input validation", () => {
    it("should return 401 when no auth token is provided", async () => {
      initializeDefaultClient({ baseURL: `${server.url}/rpc` }); // no getToken → no auth header
      const res = await contactsExtractFromImage({
        image: FAKE_IMAGE,
        mimeType: "image/png",
      });
      expect(res.status).toBe(401);
      initializeApiClient({
        baseURL: `${server.url}/rpc`,
        getToken: async () => token,
      }); // restore
    });

    it("should return 400 for an unsupported mime type", async () => {
      const res = await contactsExtractFromImage({
        image: FAKE_IMAGE,
        mimeType: "image/bmp" as any,
      });
      expect(res.status).toBe(400);
    });

    it("should return 400 when image field is missing", async () => {
      const res = await contactsExtractFromImage({
        mimeType: "image/png",
      } as any);
      expect(res.status).toBe(400);
    });

    it("should return 400 when mimeType field is missing", async () => {
      const res = await contactsExtractFromImage({ image: FAKE_IMAGE } as any);
      expect(res.status).toBe(400);
    });
  });
});
