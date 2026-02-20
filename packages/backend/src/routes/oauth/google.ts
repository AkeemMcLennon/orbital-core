import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { loadSettings, settings } from "../../config";
import { getDbClient } from "../../database/client";
import { oauthSessions } from "../../database/schema";
import { createGoogleOAuth2Client } from "../integrations";
import {
  storeIntegrationCredentials,
  syncIntegration,
} from "../../services/integrations";

import { type Env } from "../../types/env";
import { waitUntil } from "../../utils/wait-until";
// Cloudflare Workers environment types

const app = new Hono<{ Bindings: Env }>();

/**
 * Decode a Google id_token to extract the email claim
 * We trust the token since it came directly from Google's OAuth server
 */
function extractEmailFromIdToken(idToken: string): string | null {
  try {
    const [, payloadB64] = idToken.split(".");
    if (!payloadB64) return null;
    const payload = JSON.parse(atob(payloadB64));
    return payload.email || null;
  } catch {
    return null;
  }
}

app.get("/callback/google", async (context) => {
  try {
    // Load settings in case they've been updated
    if (context.env && Object.keys(context.env).length > 0) {
      loadSettings(context.env as Record<string, unknown>);
    }

    // Get query parameters
    const code = context.req.query("code");
    const state = context.req.query("state");
    const error = context.req.query("error");

    // Check for OAuth errors
    if (error) {
      const errorDescription = context.req.query("error_description") || error;
      return context.redirect(
        `/settings/integrations?error=${encodeURIComponent(errorDescription)}`,
      );
    }

    // Verify authorization code and state
    if (!code || !state) {
      return context.redirect(
        "/settings/integrations?error=missing_parameters",
      );
    }

    // Initialize database
    // Auto-detect D1 when binding is available (Cloudflare Workers)
    const db = await getDbClient({
      provider: context.env?.DB ? "d1" : settings.DB_PROVIDER,
      d1: context.env?.DB,
      sqlitePath: settings.SQLITE_DB_PATH,
    });

    // Look up OAuth session by state token
    const [session] = await db
      .select()
      .from(oauthSessions)
      .where(eq(oauthSessions.id, state))
      .limit(1);

    if (!session) {
      return context.redirect("/settings/integrations?error=invalid_state");
    }

    // Check if session has expired
    if (new Date() > session.expiresAt) {
      // Clean up expired session
      await db.delete(oauthSessions).where(eq(oauthSessions.id, state));
      return context.redirect("/settings/integrations?error=state_expired");
    }

    // Validate OAuth is configured
    if (!settings.GOOGLE_CLIENT_ID || !settings.GOOGLE_CLIENT_SECRET) {
      return context.redirect(
        "/settings/integrations?error=google_oauth_not_configured",
      );
    }

    // Get redirect URI from session metadata (was derived and stored when session was created)
    const redirectUri = (session.metadata as any)?.redirectUri;
    if (!redirectUri) {
      return context.redirect("/settings/integrations?error=invalid_session");
    }

    // Create OAuth2 client and exchange authorization code for tokens
    const oauth2Client = createGoogleOAuth2Client(redirectUri);
    let tokens: {
      access_token?: string | null;
      refresh_token?: string | null;
      expiry_date?: number | null;
      id_token?: string | null;
    };

    try {
      const { tokens: googleTokens } = await oauth2Client.getToken(code);
      tokens = googleTokens;
    } catch (err) {
      console.error("Google token exchange failed:", err);
      return context.redirect(
        "/settings/integrations?error=token_exchange_failed",
      );
    }

    // Validate we received an access token
    if (!tokens.access_token) {
      console.error("Google token exchange returned no access token");
      return context.redirect(
        "/settings/integrations?error=token_exchange_failed",
      );
    }

    // Extract user's Google email from id_token to use as accountId
    const googleEmail = tokens.id_token
      ? extractEmailFromIdToken(tokens.id_token)
      : null;
    if (!googleEmail) {
      console.error("Google token exchange did not return user email");
      return context.redirect(
        "/settings/integrations?error=missing_email_claim",
      );
    }

    // Calculate token expiration (expiry_date is a timestamp in ms)
    const tokenExpiresAt = tokens.expiry_date
      ? new Date(tokens.expiry_date)
      : undefined;

    // Save integration directly with user context from session
    const integration = await storeIntegrationCredentials(
      db,
      session.userId,
      "google",
      googleEmail,
      {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? undefined,
        expiresAt: tokenExpiresAt,
      },
    );
    console.log(`accessToken: ${tokens.access_token}`);
    await syncIntegration(db, integration.id, session.userId);

    // Get client redirect URL from session metadata
    const clientRedirectUrl = (session.metadata as any)?.clientRedirectUrl;

    // Delete the OAuth session (cleanup)
    await db.delete(oauthSessions).where(eq(oauthSessions.id, state));

    // Handle custom client redirect (e.g., mobile deep link)
    if (clientRedirectUrl) {
      return context.redirect(clientRedirectUrl);
    }

    // Redirect back to settings with success and integration ID
    return context.redirect(
      `/settings/integrations?success=google&integrationId=${integration.id}`,
    );
  } catch (error) {
    console.error("Google OAuth callback error:", error);
    return context.redirect(
      `/settings/integrations?error=${encodeURIComponent("An error occurred during OAuth")}`,
    );
  }
});

export default app;
