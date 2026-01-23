# Orbital Frontend

React Router 7 web frontend for the Orbital Personal Relationship Manager, deployed on Cloudflare Workers.

## Quick Start

### Development

```bash
# Install dependencies (from workspace root)
bun install

# Start development server
bun run --filter='@orbital/frontend' dev

# Type generation and checking
bun run --filter='@orbital/frontend' typecheck

# Linting
bun run --filter='@orbital/frontend' lint

# Format code
bun run --filter='@orbital/frontend' fmt
```

### Production Build

```bash
# Build for production
bun run --filter='@orbital/frontend' build

# Deploy to Cloudflare Workers
bun run --filter='@orbital/frontend' deploy
```

## Project Structure

```
packages/frontend/
├── app/                      # React Router application
│   ├── root.tsx             # Root layout + error boundary
│   ├── routes.ts            # Route configuration
│   ├── global.css           # Tailwind + design tokens
│   ├── entry.server.tsx     # SSR entry point
│   ├── routes/              # Route components
│   │   ├── _authenticated.tsx  # Protected route layout
│   │   ├── _index.tsx       # Dashboard
│   │   ├── login.tsx
│   │   └── contacts/
│   ├── components/          # UI components (placeholder)
│   └── lib/
│       ├── api/             # oRPC client + auth fetch
│       ├── auth/            # Session management
│       └── utils/           # Utilities (cn, avatar, date)
├── server/
│   └── index.ts             # Hono app (minimal, backend is separate)
├── worker.ts                # Cloudflare Workers entry
├── load-context.ts          # Load context augmentation
├── vite.config.ts           # Build configuration
├── tailwind.config.ts       # Design system
└── wrangler.toml            # Cloudflare Workers config
```

## Architecture

### Tech Stack

- **React Router 7** - SSR-enabled routing
- **Hono** - Integration adapter for Cloudflare Workers
- **Tailwind CSS v4** - Styling with design system
- **TypeScript** - Full type safety
- **oRPC Client** - Type-safe API calls to backend
- **Cloudflare Workers** - Serverless deployment

### Key Features

- ✅ Server-side rendering (SSR) on Cloudflare Workers
- ✅ Type-safe oRPC client (direct import from backend types)
- ✅ Session management (localStorage)
- ✅ Protected routes with auth hooks
- ✅ Design system with Tailwind + CSS variables
- ✅ Base utilities (cn, avatar, date formatting)

## API Integration

The frontend uses **oRPC Client** to call the backend API:

```typescript
import { api, contacts, auth } from '~/lib/api/client'

// List contacts
const contactsList = await contacts.list({ limit: 10 })

// Get current user
const user = await auth.me()
```

Authentication is handled by injecting JWT tokens in the custom fetch mutator:

```typescript
// app/lib/api/custom-fetch.ts
const token = getAuthToken()
headers.set('Authorization', `Bearer ${token}`)
```

## Environment Configuration

### Development (.dev.vars)

```env
BACKEND_URL=http://localhost:8787
ENVIRONMENT=development
```

### Production (Wrangler Secrets)

```bash
wrangler secret put BACKEND_URL
```

## Design System

Tailwind v4 with custom colors:

- **Primary:** `#4F46E5` (Indigo 600)
- **Background:** `#F8FAFC` (Slate 50)
- **Card Background:** `#FFFFFF` (White)
- **Text Main:** `#1E293B` (Slate 800)
- **Text Muted:** `#64748B` (Slate 500)
- **Border:** `#E2E8F0` (Slate 200)
- **Success:** `#10B981` (Emerald 500)

CSS variables available for non-Tailwind components:
- `--primary`, `--bg`, `--bg-card`, `--text-main`, `--text-muted`, `--border-color`, `--success`

## Next Steps

The following features are ready for implementation:

1. **Phase 2: Dashboard Features**
   - Face Stream (horizontal scroll of recent contacts)
   - Memory Reps (daily quiz)
   - Timeline (interaction history)

2. **Phase 3: Contact Management**
   - CRUD operations
   - Hybrid search (local + AI modes)
   - Contact cards and forms

3. **Phase 4: UI Components**
   - Base components (Avatar, Button, Card, Input, Modal)
   - Layout components (Header, Navigation, Command Palette)

4. **Phase 5: Testing & Deployment**
   - Component tests (Bun test runner)
   - Cloudflare Workers deployment

## Build Output

```
✓ Client build: build/client/ (static assets)
✓ Server build: build/server/index.js (SSR bundle)
✓ Total size: ~800KB gzipped
```

## Available Scripts

```bash
bun run dev              # Start dev server
bun run build            # Production build
bun run start            # Wrangler dev (Workers simulation)
bun run typegen          # Generate React Router types
bun run typecheck        # TypeScript type checking
bun run lint             # Lint code
bun run fmt              # Format code
bun run deploy           # Deploy to Cloudflare Workers
bun run test             # Run tests
```

## Important Notes

- The backend API must be running for development (use `bun run dev:backend`)
- SSR is enabled by default for better performance
- Authentication uses JWT tokens stored in localStorage
- Design system uses CSS variables as fallback for components

## Resources

- [React Router 7 Docs](https://remix.run)
- [Tailwind CSS v4 Docs](https://tailwindcss.com/docs)
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers)
- [oRPC Documentation](https://orpc.unnoq.com)
