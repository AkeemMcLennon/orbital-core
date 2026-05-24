import { AxGen } from "@ax-llm/ax";
import { backend } from "@orbital/testing";
import { createTestToken } from "@orbital/testing/backend/auth";
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
  spyOn,
} from "bun:test";
import { readFileSync } from "fs";
import { loadSettings } from "../../src/config";
import type { DatabaseClient } from "../../src/database/client";
import * as schema from "../../src/database/schema";
import { startServer } from "../../src/server";
import { resetLLMClient } from "../../src/services/llm";

type TestServer = backend.TestServer;

const VISION_MODEL =
  process.env.LLM_VISION_MODEL ?? process.env.LLM_FAST_MODEL;

const HAS_VISION_LLM = !!(
  process.env.LLM_BASE_URL &&
  process.env.LLM_API_KEY &&
  VISION_MODEL
);

// ─── E2E Tests (real LLM) ───────────────────────────────────────────────────

describe.skipIf(!HAS_VISION_LLM)("Contact Extract E2E (real LLM)", () => {
  let server: TestServer;
  let db: DatabaseClient;
  let token: string;

  beforeAll(async () => {
    db = await backend.createTestDatabase({
      schema,
      migrationsPath: "./src/database/migrations",
    });
    server = await backend.startTestServer({
      startServer,
      loadSettings,
      envOverrides: {
        LLM_BASE_URL: process.env.LLM_BASE_URL!,
        LLM_API_KEY: process.env.LLM_API_KEY!,
        LLM_FAST_MODEL: process.env.LLM_FAST_MODEL ?? VISION_MODEL!,
        LLM_VISION_MODEL: VISION_MODEL!,
      },
    });

    token = await createTestToken({
      sub: "extract-user",
      email: "extract@example.com",
    });

    initializeApiClient({ baseURL: `${server.url}/rpc`, getToken: async () => token });
  });

  afterAll(() => {
    server.stop();
    resetLLMClient();
  });

  beforeEach(async () => {
    await backend.clearDatabase(db, { schema });
    await backend.seedTestUser(db, "extract-user", { schema });
  });

  it("should extract contact fields from a LinkedIn profile screenshot", async () => {
    const imageBuffer = readFileSync("/tmp/linkin-profile.png");
    const base64Image = imageBuffer.toString("base64");

    const res = await contactsExtractFromImage({
      image: base64Image,
      mimeType: "image/png",
    });

    expect(res.status).toBe(200);

    const data = res.data as Record<string, unknown>;
    console.log("Extracted contact data:", data);

    expect(typeof data.name).toBe("string");
    expect((data.name as string).length).toBeGreaterThan(0);

    const knownFields = [
      "name",
      "email",
      "phone",
      "jobTitle",
      "company",
      "linkedinUrl",
      "instagramHandle",
      "twitterHandle",
      "notes",
    ] as const;

    for (const field of knownFields) {
      if (field in data) {
        expect(typeof data[field]).toBe("string");
        expect((data[field] as string).length).toBeGreaterThan(0);
      }
    }

    for (const key of Object.keys(data)) {
      expect(knownFields).toContain(key as (typeof knownFields)[number]);
    }
  }, 30000);
});

// ─── Unit Tests (mocked LLM) ────────────────────────────────────────────────

describe("Contact Extract API (unit)", () => {
  let server: TestServer;
  let db: DatabaseClient;
  let token: string;

  beforeAll(async () => {
    db = await backend.createTestDatabase({
      schema,
      migrationsPath: "./src/database/migrations",
    });
    // Fake LLM config so getVisionAI() initialises — actual calls are
    // intercepted per-test by spyOn(AxGen.prototype, "forward")
    server = await backend.startTestServer({
      startServer,
      loadSettings,
      envOverrides: {
        LLM_BASE_URL: "https://fake.llm.test/v1",
        LLM_API_KEY: "fake-key",
        LLM_VISION_MODEL: "fake-vision-model",
      },
    });

    token = await createTestToken({
      sub: "extract-user",
      email: "extract@example.com",
    });

    initializeApiClient({ baseURL: `${server.url}/rpc`, getToken: async () => token });
  });

  afterAll(() => {
    server.stop();
    resetLLMClient();
  });

  beforeEach(async () => {
    await backend.clearDatabase(db, { schema });
    await backend.seedTestUser(db, "extract-user", { schema });
  });

  const FAKE_IMAGE = Buffer.from("fake-image-data").toString("base64");

  describe("extraction results", () => {
    it("should return all fields the LLM provides", async () => {
      const spy = spyOn(AxGen.prototype, "forward").mockResolvedValue({
        name: "Jane Doe",
        email: "jane@acme.com",
        phone: "+1 555 123 4567",
        jobTitle: "Software Engineer",
        company: "Acme Corp",
        linkedinUrl: "/in/janedoe",
        notes: "Jane is a software engineer at Acme Corp.",
      });

      try {
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
      } finally {
        spy.mockRestore();
      }
    });

    it("should return a sparse object when only some fields are found", async () => {
      const spy = spyOn(AxGen.prototype, "forward").mockResolvedValue({
        name: "John Smith",
        company: "Startup Inc",
      });

      try {
        const res = await contactsExtractFromImage({
          image: FAKE_IMAGE,
          mimeType: "image/jpeg",
        });
        expect(res.status).toBe(200);
        const data = res.data as Record<string, unknown>;
        expect(data).toEqual({ name: "John Smith", company: "Startup Inc" });
        expect(Object.keys(data)).toHaveLength(2);
      } finally {
        spy.mockRestore();
      }
    });

    it("should strip empty strings returned by the LLM", async () => {
      const spy = spyOn(AxGen.prototype, "forward").mockResolvedValue({
        name: "Alice",
        email: "",
        jobTitle: "CEO",
        company: "",
      });

      try {
        const res = await contactsExtractFromImage({
          image: FAKE_IMAGE,
          mimeType: "image/png",
        });
        expect(res.status).toBe(200);
        const data = res.data as Record<string, unknown>;
        expect(data).toEqual({ name: "Alice", jobTitle: "CEO" });
        expect("email" in data).toBe(false);
        expect("company" in data).toBe(false);
      } finally {
        spy.mockRestore();
      }
    });

    it("should return an empty object when the LLM finds nothing", async () => {
      const spy = spyOn(AxGen.prototype, "forward").mockResolvedValue({});

      try {
        const res = await contactsExtractFromImage({
          image: FAKE_IMAGE,
          mimeType: "image/png",
        });
        expect(res.status).toBe(200);
        expect(res.data).toEqual({});
      } finally {
        spy.mockRestore();
      }
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
      initializeApiClient({ baseURL: `${server.url}/rpc`, getToken: async () => token }); // restore
    });

    it("should return 400 for an unsupported mime type", async () => {
      const res = await contactsExtractFromImage({
        image: FAKE_IMAGE,
        mimeType: "image/bmp" as any,
      });
      expect(res.status).toBe(400);
    });

    it("should return 400 when image field is missing", async () => {
      const res = await contactsExtractFromImage({ mimeType: "image/png" } as any);
      expect(res.status).toBe(400);
    });

    it("should return 400 when mimeType field is missing", async () => {
      const res = await contactsExtractFromImage({ image: FAKE_IMAGE } as any);
      expect(res.status).toBe(400);
    });
  });
});
