import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { users } from "../database/schema";
import type { DatabaseClient } from "../database/client";
import type { User } from "../database/schema/users";

export interface JWTUserPayload {
  sub: string;
  email: string;
  name?: string;
}

/**
 * Get or create user by external ID from JWT
 *
 * Looks up a user by their external ID (from auth provider's JWT sub claim).
 * If the user doesn't exist, creates a new user with an auto-generated internal ID.
 *
 * @param db - Database client
 * @param payload - JWT payload with sub, email, and optional name (validated by Zod in middleware)
 * @returns Database user record
 */
export async function getOrCreateUserByExternalId(
  db: DatabaseClient,
  payload: JWTUserPayload,
): Promise<User> {
  // Note: payload is already validated by Zod schema in middleware

  // Look up user by external_id
  const [existingUser] = await db
    .select()
    .from(users)
    .where(eq(users.externalId, payload.sub))
    .limit(1);

  if (existingUser) {
    return existingUser;
  }

  // Create new user on first authentication, handling concurrent inserts atomically
  await db
    .insert(users)
    .values({
      id: randomUUID(),
      externalId: payload.sub,
      email: payload.email,
      name: payload.name ?? null,
    })
    .onConflictDoNothing();

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.externalId, payload.sub))
    .limit(1);

  if (!user) {
    throw new Error(
      `Failed to create or retrieve user for sub: ${payload.sub}`,
    );
  }

  return user;
}
