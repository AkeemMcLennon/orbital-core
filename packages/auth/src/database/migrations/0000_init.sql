-- Initial schema for orbital-auth
-- BetterAuth core + JWT/JWKS + OAuth 2.1 Provider tables

-- ── BetterAuth core tables ──────────────────────────────────────────────

CREATE TABLE `user` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `email` text NOT NULL,
  `emailVerified` integer NOT NULL,
  `image` text,
  `createdAt` integer NOT NULL,
  `updatedAt` integer NOT NULL
);
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);

CREATE TABLE `session` (
  `id` text PRIMARY KEY NOT NULL,
  `expiresAt` integer NOT NULL,
  `token` text NOT NULL,
  `createdAt` integer NOT NULL,
  `updatedAt` integer NOT NULL,
  `ipAddress` text,
  `userAgent` text,
  `userId` text NOT NULL REFERENCES `user`(`id`)
);
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);

CREATE TABLE `account` (
  `id` text PRIMARY KEY NOT NULL,
  `accountId` text NOT NULL,
  `providerId` text NOT NULL,
  `userId` text NOT NULL REFERENCES `user`(`id`),
  `accessToken` text,
  `refreshToken` text,
  `idToken` text,
  `accessTokenExpiresAt` integer,
  `refreshTokenExpiresAt` integer,
  `scope` text,
  `password` text,
  `createdAt` integer NOT NULL,
  `updatedAt` integer NOT NULL
);

CREATE TABLE `verification` (
  `id` text PRIMARY KEY NOT NULL,
  `identifier` text NOT NULL,
  `value` text NOT NULL,
  `expiresAt` integer NOT NULL,
  `createdAt` integer,
  `updatedAt` integer
);

-- ── JWT / JWKS tables ───────────────────────────────────────────────────

CREATE TABLE `jwks` (
  `id` text PRIMARY KEY NOT NULL,
  `publicKey` text NOT NULL,
  `privateKey` text NOT NULL,
  `createdAt` integer NOT NULL
);

-- ── OAuth Provider tables ───────────────────────────────────────────────

CREATE TABLE `oauthClient` (
  `id` text PRIMARY KEY NOT NULL,
  `clientId` text NOT NULL,
  `clientSecret` text,
  `redirectUris` text NOT NULL,
  `name` text NOT NULL,
  `icon` text,
  `type` text NOT NULL,
  `disabled` integer,
  `skipConsent` integer,
  `enableEndSession` integer,
  `metadata` text,
  `userId` text REFERENCES `user`(`id`),
  `createdAt` integer NOT NULL,
  `updatedAt` integer NOT NULL,
  `public` integer,
  `scopes` text,
  `requirePKCE` integer,
  `grantTypes` text,
  `responseTypes` text,
  `tokenEndpointAuthMethod` text,
  `uri` text,
  `contacts` text,
  `tos` text,
  `policy` text,
  `softwareId` text,
  `softwareVersion` text,
  `softwareStatement` text,
  `postLogoutRedirectUris` text,
  `referenceId` text,
  `expiresAt` integer
);
CREATE UNIQUE INDEX `oauthClient_clientId_unique` ON `oauthClient` (`clientId`);

CREATE TABLE `oauthAccessToken` (
  `id` text PRIMARY KEY NOT NULL,
  `token` text NOT NULL,
  `clientId` text NOT NULL,
  `sessionId` text,
  `userId` text,
  `referenceId` text,
  `refreshId` text,
  `expiresAt` integer NOT NULL,
  `createdAt` integer NOT NULL,
  `scopes` text NOT NULL
);
CREATE UNIQUE INDEX `oauthAccessToken_token_unique` ON `oauthAccessToken` (`token`);

CREATE TABLE `oauthRefreshToken` (
  `id` text PRIMARY KEY NOT NULL,
  `token` text NOT NULL,
  `clientId` text NOT NULL,
  `sessionId` text,
  `userId` text NOT NULL,
  `referenceId` text,
  `expiresAt` integer NOT NULL,
  `createdAt` integer NOT NULL,
  `revoked` integer,
  `scopes` text NOT NULL
);

CREATE TABLE `oauthConsent` (
  `id` text PRIMARY KEY NOT NULL,
  `clientId` text NOT NULL,
  `userId` text,
  `referenceId` text,
  `scopes` text NOT NULL,
  `createdAt` integer NOT NULL,
  `updatedAt` integer NOT NULL
);

-- ── Seed orbital-mobile public client ───────────────────────────────────

INSERT INTO `oauthClient` (
  `id`, `clientId`, `clientSecret`, `name`, `redirectUris`, `type`,
  `disabled`, `skipConsent`, `public`, `requirePKCE`,
  `grantTypes`, `responseTypes`, `tokenEndpointAuthMethod`,
  `scopes`, `createdAt`, `updatedAt`
) VALUES (
  'orbital-mobile',
  'orbital-mobile',
  NULL,
  'Orbital Mobile',
  '["mobile://auth-callback","diy.orbital.mobile://auth-callback"]',
  'mobile',
  0,
  1,
  1,
  1,
  '["authorization_code","refresh_token"]',
  '["code"]',
  'none',
  '["openid","profile","email","offline_access"]',
  unixepoch(),
  unixepoch()
);
