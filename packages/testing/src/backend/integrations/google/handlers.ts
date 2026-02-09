/**
 * MSW Request Handlers for Google People API and OAuth
 * Mocks Google People API endpoints and OAuth token exchange for testing
 */

import { http, HttpResponse } from "msw";
import {
  generatePersonalContactsResponse,
  generateDirectoryContactsResponse,
  shouldDenyDirectoryAccess,
  type GooglePeopleApiResponse,
  type GoogleDirectoryResponse,
} from "./fixtures";

/**
 * Mock OAuth configuration
 */
let mockOAuthEmail = "testuser@gmail.com";

export function setMockOAuthEmail(email: string) {
  mockOAuthEmail = email;
}

/**
 * Create a mock id_token with the given email
 * This is a simple base64-encoded JWT payload (not cryptographically signed)
 */
function createMockIdToken(email: string): string {
  const header = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = btoa(
    JSON.stringify({
      iss: "https://accounts.google.com",
      sub: "123456789",
      email,
      email_verified: true,
      aud: "test-client-id",
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    })
  );
  const signature = btoa("mock-signature");
  return `${header}.${payload}.${signature}`;
}

/**
 * Handler for Google OAuth token exchange
 * POST https://oauth2.googleapis.com/token
 */
export const oauthTokenHandler = http.post(
  "*/token",
  async ({ request }) => {
    const url = new URL(request.url);
    console.log("[MSW] Request intercepted:", request.method, url.href);

    // Only handle OAuth token requests
    if (!url.href.includes("oauth") && !url.href.includes("token")) {
      return;
    }

    console.log("[MSW] OAuth token exchange intercepted");

    // Parse form data
    const body = await request.text();
    const params = new URLSearchParams(body);

    const code = params.get("code");
    const grantType = params.get("grant_type");
    const clientId = params.get("client_id");
    const clientSecret = params.get("client_secret");

    console.log("[MSW] Token request params:", { code, grantType, clientId, clientSecret });

    // Validate required parameters
    if (!code || grantType !== "authorization_code") {
      console.log("[MSW] Invalid token request - missing code or grant_type");
      return HttpResponse.json(
        {
          error: "invalid_request",
          error_description: "Missing required parameters",
        },
        { status: 400 }
      );
    }

    console.log("[MSW] Returning mock tokens");
    // Return mock tokens
    return HttpResponse.json({
      access_token: "mock-google-access-token",
      refresh_token: "mock-google-refresh-token",
      expires_in: 3600,
      token_type: "Bearer",
      scope: "openid email https://www.googleapis.com/auth/contacts.readonly https://www.googleapis.com/auth/directory.readonly",
      id_token: createMockIdToken(mockOAuthEmail),
    });
  }
);

/**
 * Handler for personal contacts endpoint
 * GET https://people.googleapis.com/v1/people/me/connections
 */
export const personalContactsHandler = http.get(
  "https://people.googleapis.com/v1/people/me/connections",
  async ({ request }) => {
    // 1. Validate Authorization header
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return HttpResponse.json(
        { error: { code: 401, message: "Unauthorized" } },
        { status: 401 }
      );
    }

    // 2. Parse query parameters
    const url = new URL(request.url);
    const pageToken = url.searchParams.get("pageToken");
    const syncToken = url.searchParams.get("syncToken");
    const pageSizeParam = url.searchParams.get("pageSize");
    const pageSize = pageSizeParam ? parseInt(pageSizeParam, 10) : 100;

    // 3. Generate response based on pagination/sync state
    const response: GooglePeopleApiResponse = generatePersonalContactsResponse({
      pageToken,
      syncToken,
      pageSize,
    });

    // 4. Return JSON response
    return HttpResponse.json(response);
  }
);

/**
 * Handler for directory contacts endpoint
 * GET https://people.googleapis.com/v1/people:listDirectoryPeople
 */
export const directoryContactsHandler = http.get(
  "https://people.googleapis.com/v1/people:listDirectoryPeople",
  async ({ request }) => {
    // 1. Validate Authorization header
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return HttpResponse.json(
        { error: { code: 401, message: "Unauthorized" } },
        { status: 401 }
      );
    }

    // 2. Simulate directory access denial (403)
    if (shouldDenyDirectoryAccess()) {
      return HttpResponse.json(
        {
          error: {
            code: 403,
            message: "The caller does not have permission",
            status: "PERMISSION_DENIED",
          },
        },
        { status: 403 }
      );
    }

    // 3. Parse query parameters
    const url = new URL(request.url);
    const pageToken = url.searchParams.get("pageToken");
    const pageSizeParam = url.searchParams.get("pageSize");
    const pageSize = pageSizeParam ? parseInt(pageSizeParam, 10) : 100;

    // 4. Generate directory response
    const response: GoogleDirectoryResponse = generateDirectoryContactsResponse({
      pageToken,
      pageSize,
    });

    // 5. Return JSON response
    return HttpResponse.json(response);
  }
);

/**
 * Export all Google API handlers
 */
export const googleHandlers = [
  oauthTokenHandler,
  personalContactsHandler,
  directoryContactsHandler,
];
