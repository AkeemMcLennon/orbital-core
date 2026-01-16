import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { startTestServer, type TestServer } from '../helpers/server';
import { startJWKSServer, stopJWKSServer } from '../helpers/jwks-server';
import {
  createTestToken,
  createExpiredToken,
  createInvalidIssuerToken,
  createInvalidAudienceToken,
  TEST_ISSUER,
  TEST_AUDIENCE,
} from '../helpers/jwt';

describe('Authentication', () => {
  let server: TestServer;
  let jwksPort: number;

  beforeAll(async () => {
    // Start JWKS server for JWT verification
    jwksPort = await startJWKSServer();

    // For auth tests, we want to test REAL JWT verification
    // JWT_ISSUER and JWT_AUDIENCE must match values used in jwt.ts helpers
    server = await startTestServer({
      DISABLE_JWT_VERIFICATION: 'false',
      JWKS_URL: `http://localhost:${jwksPort}/.well-known/jwks.json`,
      JWT_ISSUER: TEST_ISSUER,
      JWT_AUDIENCE: TEST_AUDIENCE,
    });
  });

  afterAll(async () => {
    server.stop();
    stopJWKSServer();
  });

  describe('GET /rpc/auth/me', () => {
    it('should return user info with valid JWT', async () => {
      const token = await createTestToken({
        sub: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
      });

      const response = await fetch(`${server.url}/rpc/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.externalId).toBe('user-123');
      expect(data.email).toBe('test@example.com');
      expect(data.name).toBe('Test User');
      expect(data.userId).toBeDefined(); // UUID
      expect(data.createdAt).toBeDefined();
    });

    it('should return 401 when Authorization header is missing', async () => {
      const response = await fetch(`${server.url}/rpc/auth/me`);

      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.message).toContain('Authorization');
    });

    it('should return 401 when token is expired', async () => {
      const token = await createExpiredToken({
        sub: 'user-123',
        email: 'test@example.com',
      });

      const response = await fetch(`${server.url}/rpc/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      expect(response.status).toBe(401);
    });

    it('should return 401 when issuer is invalid', async () => {
      const token = await createInvalidIssuerToken({
        sub: 'user-123',
      });

      const response = await fetch(`${server.url}/rpc/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      expect(response.status).toBe(401);
    });

    it('should return 401 when audience is invalid', async () => {
      const token = await createInvalidAudienceToken({
        sub: 'user-123',
      });

      const response = await fetch(`${server.url}/rpc/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      expect(response.status).toBe(401);
    });

    it('should return 401 with malformed token', async () => {
      const response = await fetch(`${server.url}/rpc/auth/me`, {
        headers: {
          Authorization: 'Bearer invalid-token-format',
        },
      });

      expect(response.status).toBe(401);
    });

    it('should return 401 without Bearer prefix', async () => {
      const token = await createTestToken({ sub: 'user-123' });

      const response = await fetch(`${server.url}/rpc/auth/me`, {
        headers: {
          Authorization: token, // Missing "Bearer " prefix
        },
      });

      expect(response.status).toBe(401);
    });
  });
});
