# Platform Abstraction Layer

This module provides a unified interface for platform-specific functionality, allowing the codebase to work seamlessly across both Web App and Chrome Extension environments.

## Overview

The platform abstraction layer consists of:

- **Detection utilities**: Identify the current execution environment
- **Authentication adapters**: Handle platform-specific auth flows
- **Type definitions**: Shared types for platform functionality

## Usage

### Importing from the Index

Always import from the index file for convenience:

```typescript
import { isChromeExtension, platformLogin } from '@/lib/platform'
```

### Platform Detection

```typescript
import { isChromeExtension, isWebApp, getPlatform } from '@/lib/platform'

// Check if running in Chrome Extension
if (isChromeExtension()) {
  console.log('Running in Chrome Extension')
}

// Check if running in Web App
if (isWebApp()) {
  console.log('Running in Web App')
}

// Get platform as string
const platform = getPlatform() // 'web' | 'extension'
```

### Platform-Specific Code Execution

```typescript
import { platformSwitch } from '@/lib/platform'

const result = platformSwitch({
  web: () => 'Web App logic',
  extension: () => 'Extension logic'
})
```

### Dynamic Platform Imports

```typescript
import { platformImport } from '@/lib/platform'

const module = await platformImport<MyModule>(
  './web-module',
  './extension-module'
)
```

### Authentication

```typescript
import { platformLogin, platformLogout, platformRefreshToken } from '@/lib/platform'

// Login (routes to appropriate auth method)
const result = await platformLogin()
if (result.success && result.user) {
  console.log('Logged in:', result.user)
}

// Logout
await platformLogout(userId)

// Refresh token
const refreshResult = await platformRefreshToken(userId)
if (refreshResult.success) {
  console.log('Token refreshed:', refreshResult.token)
}
```

## Module Structure

```
src/lib/platform/
├── index.ts           # Barrel export (use this for imports)
├── detection.ts       # Platform detection utilities
├── auth.ts           # Authentication adapters
├── types.ts          # Type definitions
├── detection.test.ts # Detection tests
├── auth.test.ts      # Auth tests
└── index.test.ts     # Index export tests
```

## Design Principles

1. **Single Source of Truth**: All platform-specific logic goes through these adapters
2. **Dynamic Imports**: Platform-specific code is loaded only when needed
3. **Type Safety**: Full TypeScript support with proper type definitions
4. **Zero Runtime Overhead**: Detection happens once, results are cached
5. **Testability**: All functions are easily mockable for testing

## Adding New Platform Functionality

1. Add the function to the appropriate module (`detection.ts`, `auth.ts`, etc.)
2. Export it from that module
3. Re-export it from `index.ts`
4. Add tests in the corresponding test file
5. Update this README with usage examples

## Testing

Run tests for the platform module:

```bash
npm test src/lib/platform
```

## Related Documentation

- [Codebase Unification Requirements](.kiro/specs/codebase-unification/requirements.md)
- [Codebase Unification Design](.kiro/specs/codebase-unification/design.md)
- [Implementation Tasks](.kiro/specs/codebase-unification/tasks.md)
