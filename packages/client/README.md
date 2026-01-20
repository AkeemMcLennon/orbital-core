# @orbital/client

Type-safe OpenAPI TypeScript client generated from the Orbital backend API using [Orval](https://orval.dev/).

## Overview

This package provides an automatically-generated TypeScript client for the Orbital backend API. The client is generated from the OpenAPI specification produced by the backend's oRPC endpoints, ensuring type safety and consistency between frontend and backend.

### Key Features

- **Type-safe API calls**: Full TypeScript support with autocomplete
- **Generated from OpenAPI**: Contract-driven generation ensures consistency
- **Automatic token injection**: Helper utilities for JWT authentication
- **Error handling utilities**: Type guards and error handling helpers
- **Fetch-based**: Uses native Fetch API for universal compatibility

## Installation

The client is already included as a workspace package. Import directly:

```typescript
import { getAuthMe, createContact } from '@orbital/client';
```

## Setup

### 1. Initialize the Client

The client needs to be initialized before use. In your application startup:

#### Frontend (React)

```typescript
import { initializeDefaultClient } from '@orbital/client';

// In your app's root component or layout
initializeDefaultClient({
  getToken: () => localStorage.getItem('authToken'),
  onUnauthorized: () => {
    // Handle 401 - token expired
    localStorage.removeItem('authToken');
    window.location.href = '/login';
  },
});
```

#### Backend Tests

```typescript
import { createTestApiClient } from '../helpers/api-client';

const client = await createTestApiClient('user-id', 'user@example.com');
const headers = client.getAuthHeaders();

// Use headers in your fetch calls
const response = await fetch(`${server.url}/rpc/auth/me`, {
  headers,
});
```

## Usage

### Authentication

Get current authenticated user:

```typescript
import { getAuthMe } from '@orbital/client';

try {
  const response = await getAuthMe();
  console.log(response.data); // User info
} catch (error) {
  if (isUnauthorizedError(error)) {
    // Handle 401
  }
}
```

### Contacts

List contacts:

```typescript
import type { Contact } from '@orbital/client';

// Make HTTP request with proper headers
const response = await fetch('/rpc/contacts?limit=50', {
  headers: {
    Authorization: `Bearer ${token}`,
  },
});

const contacts: Contact[] = await response.json();
```

**Note:** The generated client functions are basic HTTP wrappers. For more convenient usage in tests or frontend, wrap them with your own logic or use the test helpers provided.

## Type Safety

The client includes full TypeScript support:

```typescript
import type { Contact, GetAuthMe200 } from '@orbital/client';

// Request/response types are fully typed
const response = await fetch('/rpc/auth/me', { headers });
const user: GetAuthMe200 = await response.json();

// Full autocomplete on user properties
console.log(user.email, user.userId, user.externalId);
```

## Error Handling

Custom error classes for semantic error handling:

```typescript
import {
  isAPIError,
  isUnauthorizedError,
  getErrorMessage,
  APIError
} from '@orbital/client';

try {
  const response = await fetch('/rpc/contacts', { headers });
  // Handle errors
} catch (error) {
  if (isUnauthorizedError(error)) {
    // Handle 401 specifically
  } else if (isAPIError(error)) {
    console.error(`API Error ${error.statusCode}: ${error.message}`);
  } else {
    console.error(getErrorMessage(error));
  }
}
```

Optional error-as-value pattern:

```typescript
import { tryCatch } from '@orbital/client';

const [contacts, error] = await tryCatch(() =>
  fetch('/rpc/contacts', { headers }).then(r => r.json())
);

if (error) {
  console.error('Failed to fetch contacts:', error.message);
} else {
  console.log('Contacts:', contacts);
}
```

## Generation

The client is generated from the OpenAPI specification at `packages/backend/openapi.json`.

### Regenerating the Client

When the backend API changes, regenerate the client:

```bash
# From workspace root
bun run gen

# Or separately
bun run gen:openapi  # Generate OpenAPI spec from backend
bun run gen:client   # Generate TypeScript client from OpenAPI spec
```

### How Generation Works

1. **Backend** generates OpenAPI spec from oRPC routes using Zod schema converters
2. **Orval** reads the OpenAPI spec and generates TypeScript client code
3. **Generated code** is formatted with Prettier and saved to `src/generated/`

### Configuration

Generation is configured in `orval.config.ts`:

```typescript
export default defineConfig({
  orbital: {
    input: {
      target: '../backend/openapi.json', // Source OpenAPI spec
    },
    output: {
      target: 'src/generated/client.ts', // Generated client
      client: 'fetch',                   // Use Fetch API
      mode: 'tags-split',                // Organize by API tag
      baseUrl: 'http://localhost:8787/rpc', // API endpoint
    },
  },
});
```

## Integration with Tests

Backend tests use a helper for automatic token injection:

```typescript
import { createTestApiClient } from '../helpers/api-client';

const client = await createTestApiClient(userId, userEmail);
const headers = client.getAuthHeaders();

// Use headers in any fetch call
const response = await fetch(`${server.url}/rpc/contacts`, {
  method: 'POST',
  headers,
  body: JSON.stringify({ name: 'New Contact' }),
});
```

See `packages/backend/test/helpers/api-client.ts` for implementation details.

## Architecture

```
packages/client/
├── src/
│   ├── index.ts                 # Main exports
│   ├── client.ts                # Client initialization
│   ├── custom/
│   │   ├── fetch-wrapper.ts     # JWT token injection
│   │   ├── error-handler.ts     # Error utilities
│   │   └── index.ts
│   └── generated/               # Orval output (gitignored)
│       ├── auth/
│       ├── contacts/
│       └── client.schemas.ts
├── orval.config.ts              # Generation config
└── package.json
```

### Generated Files

Orval generates files organized by API tag:

- `src/generated/auth/auth.ts` - Auth endpoints
- `src/generated/contacts/contacts.ts` - Contact endpoints
- `src/generated/client.schemas.ts` - TypeScript types

Generated files use raw Fetch API and are imported through the main `index.ts`.

## Workflow

### During Development

1. **Modify backend routes** in `packages/backend/src/routes/`
2. **Run generation** to update OpenAPI spec and client:
   ```bash
   bun run gen
   ```
3. **TypeScript catches breaking changes** in consuming code
4. **Update consuming code** to match new API contract
5. **Run tests** to validate changes

### CI/CD Pipeline

The test script automatically runs generation before tests:

```bash
bun run test
# Runs:
#   → bun run gen:openapi
#   → bun run gen:client
#   → bun run --filter='@orbital/backend' test
```

Generated client is validated through backend integration tests.

## Troubleshooting

### "Cannot find module '@orbital/client'"

Ensure the client package is properly set up:

```bash
# Check package is in workspace
ls packages/client/package.json

# Reinstall dependencies
bun install
```

### Generated code compilation errors

Regenerate the client:

```bash
bun run gen
```

If errors persist, check the OpenAPI spec:

```bash
# View the OpenAPI spec
cat packages/backend/openapi.json | jq .
```

### Token not being injected

Ensure client initialization includes the `getToken` function:

```typescript
initializeDefaultClient({
  getToken: () => localStorage.getItem('authToken'), // Must return token
});
```

## API Endpoints

### Auth

- `GET /rpc/auth/me` - Get current user

### Contacts

- `GET /rpc/contacts` - List contacts
- `POST /rpc/contacts` - Create contact
- `GET /rpc/contacts/{id}` - Get contact
- `PUT /rpc/contacts/{id}` - Update contact (future)
- `DELETE /rpc/contacts/{id}` - Delete contact (future)

See the OpenAPI specification for complete endpoint documentation.

## Best Practices

1. **Always initialize** the client before making API calls
2. **Handle 401 errors** by clearing auth state and redirecting to login
3. **Use TypeScript types** for type safety (types exported from main index)
4. **Regenerate after** any backend API changes
5. **Review generated code** changes before committing

## Future Enhancements

- Custom Fetch mutator for automatic token injection in generated code
- React Query/TanStack Query integration
- React hooks for common operations (useContacts, useAuth, etc.)
- Mock generation for E2E testing
- Offline support with sync queue
- Request/response interceptors

## Resources

- [Orval Documentation](https://orval.dev/)
- [OpenAPI Specification](https://spec.openapis.org/)
- [Orbital Backend Docs](../../DESIGN.md)
- [oRPC Framework](https://orpc.unnoq.com)
