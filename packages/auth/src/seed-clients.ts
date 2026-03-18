/**
 * Ensures the orbital-mobile OAuth client exists in the database as a public client.
 * Public clients use PKCE instead of client_secret for token exchange.
 */

let seeded = false;

export async function ensureMobileClient(db: D1Database): Promise<void> {
  if (seeded) return;

  try {
    const existing = await db
      .prepare("SELECT id, `public` FROM oauthClient WHERE clientId = ?")
      .bind("orbital-mobile")
      .first();

    if (existing && existing.public) {
      seeded = true;
      return;
    }

    if (existing && !existing.public) {
      // Client exists but isn't marked as public — fix it
      await db
        .prepare(
          "UPDATE oauthClient SET `public` = 1, requirePKCE = 1, tokenEndpointAuthMethod = 'none', clientSecret = NULL WHERE clientId = ?",
        )
        .bind("orbital-mobile")
        .run();
      seeded = true;
      return;
    }

    // Client doesn't exist — create it
    const now = Math.floor(Date.now() / 1000);
    await db
      .prepare(
        `INSERT INTO oauthClient (
          id, clientId, clientSecret, name, redirectUris, type,
          disabled, skipConsent, \`public\`, requirePKCE,
          grantTypes, responseTypes, tokenEndpointAuthMethod,
          scopes, createdAt, updatedAt
        ) VALUES (?, ?, NULL, ?, ?, ?, 0, 1, 1, 1, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        "orbital-mobile",
        "orbital-mobile",
        "Orbital Mobile",
        JSON.stringify(["mobile://auth-callback", "diy.orbital.mobile://auth-callback", "exp://192.168.5.100:8081/--/auth-callback"]),
        "mobile",
        JSON.stringify(["authorization_code", "refresh_token"]),
        JSON.stringify(["code"]),
        "none",
        JSON.stringify(["openid", "profile", "email", "offline_access"]),
        now,
        now,
      )
      .run();

    seeded = true;
  } catch (e) {
    // Log but don't crash — the client may already exist from migration
    console.error("Failed to seed mobile client:", e);
    seeded = true;
  }
}
