# Orbital - Personal Relationship Manager

A minimalist relationship management tool for professionals who need to manage a growing network without the transactional feel of sales software.

## Architecture

- **Backend:** Cloudflare Workers with Hono (REST API)
- **Database:** SQLite (local dev with bun:sqlite) + Cloudflare D1 (Workers/production)
- **ORM:** Drizzle ORM
- **Auth:** JWKS-based JWT verification
- **Monorepo:** Bun workspaces

## Project Structure

```
orbital/
├── packages/
│   ├── backend/     # Cloudflare Workers API
│   ├── database/    # Drizzle schemas & migrations
│   ├── types/       # Shared TypeScript types
│   └── utils/       # Shared utilities
```

## Getting Started

### Prerequisites

1. [Bun](https://bun.sh) installed
2. Cloudflare account (for D1 and Workers)
3. External auth provider with JWKS URL (Auth0, Clerk, or custom)

### Installation

```bash
# Install dependencies
bun install

# Generate database migrations (if schema changes)
bun run db:generate

# Apply migrations to local SQLite
bun run db:migrate:local

# Start development server (uses local SQLite by default)
bun run dev:backend
```

### Current Status

**Phase 1: Complete ✅**
- ✅ Bun monorepo structure with workspaces
- ✅ Database with Drizzle ORM and split schema (two-tier contact model)
  - Dynamic imports for bun:sqlite (local dev)
  - D1 support for Cloudflare Workers
  - Switchable provider via DB_PROVIDER env var
  - UUIDv7 + Base58 encoding for shorter, URL-safe IDs
- ✅ Schema: Users, Contacts (managed), Directory (available), Tags + ContactTags (junction)
- ✅ Backend package with Hono + oRPC API
  - JWKS authentication middleware (JWT validation)
  - Contact CRUD routes (list, find, create, update, delete)
  - Auth route (get current user)
  - Type-safe auto-generated OpenAPI docs
- ✅ Development server running on Cloudflare Workers local environment

**API Endpoints (oRPC - Type-Safe):**
```
GET    /rpc/auth/me            Get current authenticated user info
GET    /rpc/contacts           List managed contacts (group filtering, pagination)
GET    /rpc/contacts/{id}      Get single contact by ID (Base58 encoded)
POST   /rpc/contacts           Create new managed contact
PUT    /rpc/contacts/{id}      Update contact details
DELETE /rpc/contacts/{id}      Delete contact
```

**Note:** All `/rpc/*` routes require JWT authentication via `Authorization: Bearer <token>` header.

### Environment Variables

Create `.dev.vars` in `packages/backend/` (see `.dev.vars.example` for full list):

```
DB_PROVIDER=sqlite
JWKS_URL=https://your-auth.auth0.com/.well-known/jwks.json
```

## Development

```bash
# Run backend in development mode
bun run dev:backend

# Generate database migrations
bun run db:generate

# Apply migrations (local SQLite)
bun run db:migrate:local

# Apply migrations (Cloudflare D1)
bun run db:migrate:d1

# Open Drizzle Studio
bun run db:studio

# Run tests
bun test

# Type check all packages
bun run typecheck
```

## Database Provider Switching

Switch between SQLite and D1 by setting the `DB_PROVIDER` environment variable:

- **Local development:** `DB_PROVIDER=sqlite` (uses `./local.db` file)
- **Production:** `DB_PROVIDER=d1` (uses Cloudflare D1 binding)

## Deployment

```bash
# Build and deploy to Cloudflare Workers
bun run deploy:backend
```

## Core Features (Phase 1)

- **Two-Tier Contact Model:** Directory (available imports) vs Contacts (managed relationships)
- **Multi-Source Support:** Directory supports importing from multiple sources (Google, CSV, manual, etc.)
- **Promoted Pointer Pattern:** Seamlessly promote directory entries to managed contacts
- **Tags & Categorization:** User-defined tags for flexible contact organization
- **Type-Safe API:** oRPC with automatic OpenAPI generation and TypeScript inference
- **UUIDv7 + Base58:** Shorter, URL-safe IDs for both storage and API responses

## Planned Features (Phase 2+)

- **Action Items:** Unified task system with auto-generation based on cadence
- **Cadence Triggers:** Automated relationship maintenance reminders
- **Interaction Timeline:** Track touchpoints with sentiment and context
- **Google Contacts Sync:** Import contacts via OAuth
- **External Enrichment:** Apollo.io / Clearbit integration
- **Relationships Graph:** Visualize contact networks and relationships

## License

Elastic License 2.0 (ELv2) - See [LICENSE](LICENSE) for details.

