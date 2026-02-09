import { google } from "googleapis";
import { authProc } from "../middleware/auth";
import { settings } from "../config";
import { oauthSessions } from "../database/schema";

/**
 * Google OAuth scopes for contacts access
 */
export const GOOGLE_OAUTH_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/contacts.readonly",
  "https://www.googleapis.com/auth/directory.readonly",
];

/**
 * Derive the OAuth callback URL from request headers
 */
function getOAuthCallbackUri(
  headers: Record<string, string | string[]>,
): string {
  // Extract Host header
  const host = Array.isArray(headers.host) ? headers.host[0] : headers.host;
  if (!host) {
    throw new Error("Unable to determine callback URI: missing Host header");
  }

  // Extract protocol from x-forwarded-proto (set by Cloudflare, proxies) or default to https
  const protocol =
    (Array.isArray(headers["x-forwarded-proto"])
      ? headers["x-forwarded-proto"][0]
      : headers["x-forwarded-proto"]) || "http";

  return `${protocol}://${host}/auth/callback/google`;
}

/**
 * Create a configured Google OAuth2 client
 */
export function createGoogleOAuth2Client(redirectUri: string) {
  const oauth2Client = new google.auth.OAuth2(
    settings.GOOGLE_CLIENT_ID,
    settings.GOOGLE_CLIENT_SECRET,
    redirectUri,
  );

  // Use native fetch for MSW compatibility in tests
  oauth2Client.fetchImplementation = fetch as any;

  return oauth2Client;
}

/**
 * Google OAuth connect endpoint
 * Generates OAuth URL and creates a session to track the OAuth flow
 * Returns the session ID to be used as the state parameter
 *
 * Flow:
 * 1. Frontend calls this endpoint (authenticated)
 * 2. Server creates oauth_sessions row with userId and provider
 * 3. Server returns Google OAuth URL with session id as state parameter
 * 4. Frontend redirects user to Google
 * 5. Google redirects back to /auth/callback/google?code=...&state=...
 * 6. Callback handler retrieves userId from oauth_sessions and saves integration
 */
export const connectGoogle = authProc
  .route({
    method: "GET",
    path: "/integrations/google/connect",
  })
  .handler(async ({ context }) => {
    const { db, user, headers } = context;

    // Validate Google OAuth is configured
    if (!settings.GOOGLE_CLIENT_ID) {
      throw new Error("Google OAuth is not configured. Set GOOGLE_CLIENT_ID.");
    }

    const redirectUri = getOAuthCallbackUri(
      headers as Record<string, string | string[]>,
    );

    // Create OAuth session in database (5 minute expiration)
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    const [session] = await db
      .insert(oauthSessions)
      .values({
        userId: user.id,
        provider: "google",
        expiresAt,
        metadata: {
          scopes: GOOGLE_OAUTH_SCOPES,
          redirectUri,
        },
      })
      .returning();

    if (!session) {
      throw new Error("Failed to create OAuth session");
    }

    // Create OAuth2 client and generate authorization URL
    const oauth2Client = createGoogleOAuth2Client(redirectUri);
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: GOOGLE_OAUTH_SCOPES,
      prompt: "consent",
      state: session.id, // Session id is the OAuth state parameter
    });

    return {
      url: authUrl,
      state: session.id, // Return for frontend reference
    };
  });

export const router = {
  google: {
    connect: connectGoogle,
  },
};
