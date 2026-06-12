import { SignJWT, generateKeyPair, exportJWK, KeyLike } from "jose";

interface TestKeyPair {
  publicKey: KeyLike;
  privateKey: KeyLike;
  kid: string;
}

let testKeyPair: TestKeyPair | null = null;

/**
 * Generate RSA key pair for JWT signing (called once per test run)
 */
export async function generateTestKeyPair(): Promise<TestKeyPair> {
  if (testKeyPair) return testKeyPair;

  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const kid = "test-key-1";

  testKeyPair = { publicKey, privateKey, kid };
  return testKeyPair!;
}

/**
 * Get public JWK for JWKS endpoint
 */
export async function getPublicJWK() {
  const { publicKey, kid } = await generateTestKeyPair();
  const jwk = await exportJWK(publicKey);

  return {
    ...jwk,
    kid,
    alg: "RS256",
    use: "sig",
  };
}

// Test issuer and audience - must match values in server.ts defaults
export const TEST_ISSUER = "http://localhost:9999/";
export const TEST_AUDIENCE = "test-audience";

/**
 * Create a valid test JWT token
 */
export async function createTestToken(payload: {
  sub: string;
  email?: string;
  name?: string;
  [key: string]: unknown;
}): Promise<string> {
  const { privateKey, kid } = await generateTestKeyPair();

  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "RS256", kid })
    .setIssuer(TEST_ISSUER)
    .setAudience(TEST_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(privateKey);

  return token;
}

/**
 * Create an expired test token
 */
export async function createExpiredToken(payload: {
  sub: string;
  email?: string;
  name?: string;
}): Promise<string> {
  const { privateKey, kid } = await generateTestKeyPair();

  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "RS256", kid })
    .setIssuer(TEST_ISSUER)
    .setAudience(TEST_AUDIENCE)
    .setIssuedAt(Math.floor(Date.now() / 1000) - 3600) // 1 hour ago
    .setExpirationTime(Math.floor(Date.now() / 1000) - 1800) // 30 mins ago
    .sign(privateKey);

  return token;
}

/**
 * Create a token with wrong issuer
 */
export async function createInvalidIssuerToken(payload: {
  sub: string;
}): Promise<string> {
  const { privateKey, kid } = await generateTestKeyPair();

  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "RS256", kid })
    .setIssuer("http://wrong-issuer.example.com/")
    .setAudience(TEST_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(privateKey);

  return token;
}

/**
 * Create a token with wrong audience
 */
export async function createInvalidAudienceToken(payload: {
  sub: string;
}): Promise<string> {
  const { privateKey, kid } = await generateTestKeyPair();

  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "RS256", kid })
    .setIssuer(TEST_ISSUER)
    .setAudience("wrong-audience")
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(privateKey);

  return token;
}
