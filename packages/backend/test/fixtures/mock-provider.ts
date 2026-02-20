import type {
  DirectoryProvider,
  FetchContactsPage,
} from "../../src/services/integrations/provider";
import type { NewDirectoryEntry } from "../../src/database/schema";

/**
 * Mock directory provider for testing
 * Simulates fetching contacts from a simple HTTP endpoint
 */
export class MockDirectoryProvider implements DirectoryProvider {
  readonly sourceId = "mock";
  readonly name = "Mock Provider";

  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async refreshTokenIfNeeded(
    accessToken: string,
    refreshToken?: string,
    tokenExpiresAt?: Date,
  ): Promise<{ accessToken: string; refreshToken?: string; expiresAt?: Date }> {
    // Mock: always return current token without refresh
    return { accessToken, refreshToken, expiresAt: tokenExpiresAt };
  }

  async *fetchContacts(
    accessToken: string,
    syncToken?: string,
  ): AsyncGenerator<FetchContactsPage> {
    const url = new URL(`${this.baseUrl}/contacts`);
    if (syncToken) {
      url.searchParams.set("syncToken", syncToken);
    }

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Mock API error: ${response.status}`);
    }

    const data = (await response.json()) as {
      contacts: NewDirectoryEntry[];
      nextSyncToken?: string;
    };

    yield {
      contacts: data.contacts,
      nextSyncToken: data.nextSyncToken,
    };
  }
}

/**
 * Mock HTTP server for testing provider implementations
 * Validates authorization tokens against stored credentials
 */
export class MockContactServer {
  private server: any;
  private contacts: NewDirectoryEntry[] = [];
  private nextSyncToken = "sync-token-2";
  private expectedToken: string | null = null;

  async start(
    contacts: NewDirectoryEntry[],
    expectedToken?: string,
  ): Promise<number> {
    this.contacts = contacts;
    this.expectedToken = expectedToken || null;

    return new Promise((resolve, reject) => {
      const server = Bun.serve({
        hostname: "localhost",
        port: 0,
        fetch: (request: Request) => this.handleRequest(request),
        error: (error: Error) => {
          console.error("Mock server error:", error);
          reject(error);
        },
      });

      this.server = server;
      this.port = (server.port as unknown as number) || 0;
      resolve(this.port);
    });
  }

  /**
   * Set the expected authorization token for validation
   */
  setExpectedToken(token: string): void {
    this.expectedToken = token;
  }

  private handleRequest(request: Request): Response {
    const url = new URL(request.url);

    if (url.pathname === "/contacts") {
      return this.handleContactsRequest(request, url);
    }

    return new Response("Not found", { status: 404 });
  }

  private handleContactsRequest(request: Request, url: URL): Response {
    // Check authorization
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response("Unauthorized", { status: 401 });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Validate token matches expected token if configured
    if (this.expectedToken && token !== this.expectedToken) {
      return new Response("Invalid token", { status: 401 });
    }

    const syncToken = url.searchParams.get("syncToken");

    // Simulate delta sync
    let contactsToReturn = this.contacts;
    let returnSyncToken: string | undefined;

    if (syncToken === "sync-token-1") {
      // Return second batch of contacts
      contactsToReturn = this.contacts.slice(1);
      returnSyncToken = this.nextSyncToken;
    } else if (!syncToken) {
      // Initial sync - return all
      returnSyncToken = "sync-token-1";
    }

    return new Response(
      JSON.stringify({
        contacts: contactsToReturn,
        nextSyncToken: returnSyncToken,
      }),
      {
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }

  getUrl(): string {
    return `http://localhost:${this.port}`;
  }

  stop(): void {
    if (this.server) {
      this.server.stop();
    }
  }
}
