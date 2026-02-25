# TypeScript Configuration Migration Plan

## Status: `DRAFT` | `IN_PROGRESS` | `COMPLETED`

**Created:** 2025-02-25
**Last Updated:** 2025-02-25
**Target Version:** TypeScript 5.8+

---

## Table of Contents

1. [Motivation](#motivation)
2. [Package Strategy](#package-strategy)
3. [Current State Analysis](#current-state-analysis)
4. [Target State (TanStack Query Pattern)](#target-state-tanstack-query-pattern)
5. [Migration Steps](#migration-steps)
6. [Testing Checklist](#testing-checklist)
7. [Rollback Plan](#rollback-plan)

---

## Motivation

### Problem Statement

Our current TypeScript configuration has several issues that impact developer experience, build performance, and maintainability:

1. **Fragmented Configuration**: Two configs (`tsconfig.json` + `tsconfig.base.json`) create confusion about what goes where
2. **Slow Builds**: Pure `tsc` compilation is significantly slower than modern bundlers
3. **Required `.js` Extensions**: `verbatimModuleSyntax` forces `.js` extensions in all imports, reducing code clarity
4. **No Incremental Builds**: Missing `incremental: true` means every build is a full rebuild
5. **Missing `isolatedModules`**: Limits tooling compatibility and parallel processing potential
6. **Published Internal Packages**: Currently publishing `@synnel/types` and `@synnel/lib` separately creates unnecessary npm packages

### Goals

| Goal | Benefit | Priority |
|------|---------|----------|
| Single source of truth for TS config | Easier maintenance | HIGH |
| 10-100x faster builds with tsup | Better DX | CRITICAL |
| Remove `.js` extensions from source | Cleaner imports | HIGH |
| Bundle private packages into published ones | Self-contained npm packages | HIGH |
| Enable incremental compilation | Faster rebuilds | CRITICAL |
| Adopt industry-standard patterns | Better onboarding | MEDIUM |

### Reference Implementation

We're adopting the **TanStack Query** configuration pattern because:
- Industry-leading TypeScript library with excellent DX
- Proven at scale (thousands of dependents)
- Active maintenance by TypeScript experts
- Similar monorepo structure with private internal packages

---

## Package Strategy

### Private vs Published Packages

| Package | Status | Purpose | Bundled Into |
|---------|--------|---------|--------------|
| `@synnel/types` | **Private** | Shared TypeScript types | `@synnel/server`, `@synnel/react` |
| `@synnel/lib` | **Private** | Internal utility functions | `@synnel/server`, `@synnel/react` |
| `@synnel/client` | **Private** | Framework-agnostic client | `@synnel/react` |
| `@synnel/server` | **Published** | Node.js server implementation | Self-contained |
| `@synnel/react` | **Published** | React hooks and components | Self-contained |

### Key Changes from Current Strategy

**Before (Current):**
```
@synnel/server (published)
  ├─ depends on: @synnel/types (published)
  └─ depends on: @synnel/lib (published)

@synnel/react (published)
  ├─ depends on: @synnel/client (published)
  ├─ depends on: @synnel/types (published)
  └─ depends on: @synnel/lib (published)
```

**After (New):**
```
@synnel/server (published, self-contained)
  ├─ bundles: @synnel/types source
  └─ bundles: @synnel/lib source

@synnel/react (published, self-contained)
  ├─ bundles: @synnel/client source
  ├─ bundles: @synnel/types source
  └─ bundles: @synnel/lib source
```

### Benefits of Bundling Private Packages

| Benefit | Description |
|---------|-------------|
| **Simplified Consumer Experience** | Users only install what they need |
| **No Version Conflicts** | No need to worry about `@synnel/types` version mismatches |
| **Smaller Bundle Size** | Tree-shaking works across all internal code |
| **Faster Installs** | Fewer packages to download |
| **Better TypeScript Support** | Single source of types for consumers |
| **Easier Maintenance** | Internal changes don't require coordinated releases |

### Import Paths During Development

Internal packages use workspace path mappings:

```ts
// During development (in packages/server/src/index.ts)
import { foo } from '@synnel/lib/utils'      // Resolves via workspace
import type { Bar } from '@synnel/types'     // Resolves via workspace
```

### What Gets Published

Only `@synnel/server` and `@synnel/react` are published to npm. Their `dist/` contains:

```
@synnel/server/
├── dist/
│   ├── index.js           # Bundled (includes types + lib)
│   ├── index.d.ts         # All types re-exported
│   └── index.js.map       # Source maps
├── package.json           # NO internal dependencies
└── README.md
```

---

## Current State Analysis

### File Structure

```
E:/practice/Synnel/
├── tsconfig.json           # Path mappings only, noEmit for dev
├── tsconfig.base.json      # All compiler options
└── packages/
    ├── types/              # Currently published as private: true
    │   └── tsconfig.json   # Extends base, duplicate options
    ├── lib/                # Currently published as private: true
    │   └── tsconfig.json   # Extends base, duplicate options
    ├── client/             # Currently published as private: true
    │   └── tsconfig.json   # Extends base, duplicate options
    ├── server/             # Published to npm
    │   └── tsconfig.json   # Extends base, duplicate options
    └── react/              # Published to npm
        └── tsconfig.json   # Extends base + tsup config
```

### Key Settings (tsconfig.base.json)

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "verbatimModuleSyntax": true,  // ← Requires .js extensions
    "incremental": false,           // ← Not enabled
    "isolatedModules": false,       // ← Not enabled
    "emitDeclarationOnly": false    // ← tsc generates JS
  }
}
```

### Build Process

| Package | Build Tool | Output | Published |
|---------|------------|--------|-----------|
| types | tsc | `dist/` (JS + .d.ts) | ❌ No (private: true) |
| lib | tsc | `dist/` (JS + .d.ts) | ❌ No (private: true) |
| client | tsc | `dist/` (JS + .d.ts) | ❌ No (private: true) |
| server | tsc | `dist/` (JS + .d.ts) | ✅ Yes |
| react | tsup | `dist/` (JS only), .d.ts separate | ✅ Yes |

### Issues Identified

1. **Published Internal Packages**: `types`, `lib`, `client` have dist/ but are marked private
2. **Duplicate Options**: Every package config repeats `composite: true`, `declaration: true`, etc.
3. **Slow Full Rebuilds**: No incremental compilation means editing a file recompiles everything
4. **Inconsistent Builds**: react uses tsup, others use tsc - no unified approach
5. **Workspace Dependencies**: Published packages reference `workspace:*` which won't resolve for consumers

---

## Target State (TanStack Query Pattern)

### File Structure

```
E:/practice/Synnel/
├── tsconfig.json           # ALL compiler options (single source of truth)
└── packages/
    ├── types/              # Private - no dist/, bundled into consumers
    │   └── tsconfig.json   # Extends root, types only (no build output)
    ├── lib/                # Private - no dist/, bundled into consumers
    │   └── tsconfig.json   # Extends root, types only (no build output)
    ├── client/             # Private - no dist/, bundled into consumers
    │   └── tsconfig.json   # Extends root, types only (no build output)
    ├── server/             # Published - self-contained bundle
    │   ├── tsconfig.json   # Extends root, minimal override
    │   └── tsup.config.ts  # Bundles types + lib source
    └── react/              # Published - self-contained bundle
        ├── tsconfig.json   # Extends root, minimal override
        └── tsup.config.ts  # Bundles client + types + lib source
```

### Root tsconfig.json (New)

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    // Environment
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "target": "ES2020",
    "module": "ESNext",
    "moduleDetection": "force",
    "jsx": "react-jsx",
    "allowJs": true,

    // Module resolution
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,

    // Strict type checking
    "strict": true,
    "strictFunctionTypes": true,
    "skipLibCheck": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noImplicitReturns": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,

    // Declaration-only build (key change)
    "declaration": true,
    "declarationMap": true,
    "emitDeclarationOnly": true,  // ← tsc only generates .d.ts
    "incremental": true,           // ← Faster rebuilds
    "isolatedModules": true,       // ← Better tooling support
    "composite": true,
    "noEmit": false,

    // Path mappings for workspace development
    "baseUrl": ".",
    "paths": {
      "@synnel/types": ["./packages/types/src"],
      "@synnel/lib": ["./packages/lib/src"],
      "@synnel/client": ["./packages/client/src"],
      "@synnel/server": ["./packages/server/src"],
      "@synnel/react": ["./packages/react/src"]
    }
  },
  "include": ["*.config.*"],
  "exclude": ["node_modules", "dist", "dist-ts"]
}
```

### Package tsconfig.json (Minimal)

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist-ts",
    "rootDir": "."
  },
  "include": ["src", "*.config.*"]
}
```

### Build Process (New)

| Package | Step 1 (tsup) | Step 2 (tsc) | Published |
|---------|---------------|--------------|-----------|
| types | Skip | Generate `.d.ts` to `dist-ts/` | ❌ No |
| lib | Skip | Generate `.d.ts` to `dist-ts/` | ❌ No |
| client | Skip | Generate `.d.ts` to `dist-ts/` | ❌ No |
| server | Bundle to `dist/` (includes types+lib) | Generate `.d.ts` to `dist-ts/` | ✅ Yes |
| react | Bundle to `dist/` (includes client+types+lib) | Generate `.d.ts` to `dist-ts/` | ✅ Yes |

### tsup Configuration Examples

#### `packages/server/tsup.config.ts`

```ts
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  outDir: 'dist',
  dts: false,              // tsc handles declarations
  clean: true,
  sourcemap: true,
  target: 'es2020',
  external: ['ws'],         // Only externalize peer deps
  // Note: @synnel/types and @synnel/lib are BUNDLED, not external
})
```

#### `packages/react/tsup.config.ts`

```ts
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  outDir: 'dist',
  dts: false,              // tsc handles declarations
  clean: true,
  sourcemap: true,
  target: 'es2020',
  external: ['react', 'react-dom'],  // Only externalize peer deps
  // Note: @synnel/client, @synnel/types, @synnel/lib are BUNDLED
})
```

### package.json Dependencies (After Migration)

#### Private Packages (no change needed)

```json
// packages/types/package.json, packages/lib/package.json, packages/client/package.json
{
  "name": "@synnel/types",
  "private": true,
  "version": "1.0.0-alpha.1",
  "type": "module",
  "main": "./src/index.ts",     // Source, not dist
  "exports": {
    ".": {
      "bun": "./src/index.ts",
      "development": "./src/index.ts"
    }
  },
  "files": []  // Don't publish anything
}
```

#### Published Packages (no workspace dependencies)

```json
// packages/server/package.json
{
  "name": "@synnel/server",
  "version": "1.0.0-alpha.1",
  "type": "module",
  "main": "./dist/index.js",
  "module": "./dist/index.js",
  "types": "./dist-ts/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist-ts/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "files": [
    "dist",
    "dist-ts",
    "README.md"
  ],
  "dependencies": {},  // NO internal dependencies!
  "peerDependencies": {
    "ws": "^8.0.0"
  },
  "publishConfig": {
    "access": "public"
  }
}
```

---

## Migration Steps

### Phase 1: Preparation (No Breaking Changes)

- [ ] **Step 1.1**: Install tsup as dev dependency
  ```bash
  bun add -D tsup
  ```

- [ ] **Step 1.2**: Create backup of current configs
  ```bash
  cp tsconfig.base.json tsconfig.base.json.backup
  cp tsconfig.json tsconfig.json.backup
  ```

- [ ] **Step 1.3**: Run full test suite to establish baseline
  ```bash
  bun run test
  ```

### Phase 2: Consolidate Configuration

- [ ] **Step 2.1**: Merge `tsconfig.base.json` into root `tsconfig.json`
  - Copy all compiler options from base to root
  - Keep path mappings
  - Remove `verbatimModuleSyntax: true` (no more .js extensions)

- [ ] **Step 2.2**: Update all package tsconfig files to extend root
  ```json
  {
    "extends": "../../tsconfig.json",
    "compilerOptions": {
      "outDir": "./dist-ts",
      "rootDir": "."
    },
    "include": ["src", "*.config.*"]
  }
  ```

- [ ] **Step 2.3**: Delete `tsconfig.base.json`
  ```bash
  rm tsconfig.base.json
  ```

### Phase 3: Update Private Packages (types, lib, client)

- [ ] **Step 3.1**: Update `packages/types/package.json`
  - Remove `files` array or set to empty
  - Ensure `private: true` is set
  - Update `exports` to only point to source for development

- [ ] **Step 3.2**: Update `packages/lib/package.json` (same as above)
- [ ] **Step 3.3**: Update `packages/client/package.json` (same as above)

- [ ] **Step 3.4**: Remove dist/ directories from private packages
  ```bash
  rm -rf packages/types/dist packages/lib/dist packages/client/dist
  ```

### Phase 4: Add tsup Configuration

- [ ] **Step 4.1**: Create `packages/server/tsup.config.ts`
  ```ts
  import { defineConfig } from 'tsup'

  export default defineConfig({
    entry: ['src/index.ts'],
    format: ['esm'],
    outDir: 'dist',
    dts: false,
    clean: true,
    sourcemap: true,
    target: 'es2020',
    external: ['ws'],  // Only peer deps, NOT @synnel/types or @synnel/lib
  })
  ```

- [ ] **Step 4.2**: Create `packages/react/tsup.config.ts`
  ```ts
  import { defineConfig } from 'tsup'

  export default defineConfig({
    entry: ['src/index.ts'],
    format: ['esm'],
    outDir: 'dist',
    dts: false,
    clean: true,
    sourcemap: true,
    target: 'es2020',
    external: ['react', 'react-dom'],  // Only peer deps, NOT @synnel/client
  })
  ```

### Phase 5: Update Published Packages

- [ ] **Step 5.1**: Update `packages/server/package.json`
  - Remove `@synnel/types` and `@synnel/lib` from dependencies
  - Update `files` to include `dist` and `dist-ts`
  - Update `exports.types` to point to `./dist-ts/index.d.ts`
  - Add `publishConfig.access: "public"`

  ```json
  {
    "name": "@synnel/server",
    "dependencies": {},  // Empty - no internal deps
    "peerDependencies": {
      "ws": "^8.0.0"
    },
    "files": ["dist", "dist-ts", "README.md"],
    "exports": {
      ".": {
        "types": "./dist-ts/index.d.ts",
        "import": "./dist/index.js"
      }
    },
    "publishConfig": {
      "access": "public"
    }
  }
  ```

- [ ] **Step 5.2**: Update `packages/react/package.json`
  - Remove `@synnel/client` from dependencies
  - Update `files` to include `dist` and `dist-ts`
  - Update `exports.types` to point to `./dist-ts/index.d.ts`
  - Add `publishConfig.access: "public"`

### Phase 6: Update Build Scripts

- [ ] **Step 6.1**: Update root `package.json`
  ```json
  {
    "scripts": {
      "build": "bun run build:packages",
      "build:packages": "bun run build:server && bun run build:react",
      "build:server": "cd packages/server && bun run build",
      "build:react": "cd packages/react && bun run build",
      "build:types": "cd packages/types && tsc",  // Types only for dev
      "build:lib": "cd packages/lib && tsc",      // Types only for dev
      "build:client": "cd packages/client && tsc" // Types only for dev
    }
  }
  ```

- [ ] **Step 6.2**: Update `packages/server/package.json` scripts
  ```json
  {
    "scripts": {
      "build": "tsc && tsup",
      "dev": "tsc --watch & tsup --watch",
      "prepublishOnly": "bun run build"
    }
  }
  ```

- [ ] **Step 6.3**: Update `packages/react/package.json` scripts (same as above)

- [ ] **Step 6.4**: Update private packages (types, lib, client) - tsc only
  ```json
  {
    "scripts": {
      "build": "tsc",  // Only types, no bundling
      "dev": "tsc --watch"
    }
  }
  ```

### Phase 7: Remove .js Extensions

- [ ] **Step 7.1**: Update imports throughout codebase
  ```bash
  # Find all imports with .js extension
  rg "from ['\"](\./|\.\.\/).*\.js['\"]" packages/

  # Remove .js extensions from imports
  ```

  **Before:**
  ```ts
  import { foo } from './bar.js'
  import type { Baz } from '../types/qux.js'
  ```

  **After:**
  ```ts
  import { foo } from './bar'
  import type { Baz } from '../types/qux'
  ```

- [ ] **Step 7.2**: Run type-check to verify
  ```bash
  bun run tsc --noEmit
  ```

### Phase 8: Verification

- [ ] **Step 8.1**: Clean build
  ```bash
  rm -rf packages/*/dist packages/*/dist-ts
  bun run build
  ```

- [ ] **Step 8.2**: Verify bundle contents
  ```bash
  # Check that server dist includes bundled types and lib
  grep -r "export.*from.*@synnel/types" packages/server/dist/  # Should NOT exist (bundled)
  grep -r "DeepPartial\|MergeTypes" packages/server/dist/      # Should exist (from types)
  ```

- [ ] **Step 8.3**: Verify output structure
  ```bash
  ls -la packages/server/dist/      # Should have .js files
  ls -la packages/server/dist-ts/   # Should have .d.ts files
  ```

- [ ] **Step 8.4**: Run full test suite
  ```bash
  bun run test
  ```

- [ ] **Step 8.5**: Test published package locally
  ```bash
  cd packages/server
  npm pack --dry-run
  # Check tar contents - should NOT contain workspace: dependencies
  ```

---

## Testing Checklist

### Pre-Migration

- [ ] All tests pass
- [ ] Build completes successfully
- [ ] No TypeScript errors
- [ ] Linting passes

### Post-Migration

- [ ] All tests pass
- [ ] Build completes successfully
- [ ] No TypeScript errors
- [ ] Linting passes
- [ ] Server package has NO internal dependencies
- [ ] React package has NO internal dependencies
- [ ] Bundle contains internal code (types, lib, client)
- [ ] Type definitions are generated and correct
- [ ] Source maps are present
- [ ] Build time improved (measure before/after)

### Integration Testing

- [ ] Example app builds and runs
- [ ] Package can be consumed from workspace
- [ ] npm pack --dry-run shows correct contents
- [ ] `bun run dev` watch mode works
- [ ] TypeScript autocomplete works in consuming projects

### Publish Verification

- [ ] `npm publish --dry-run` succeeds
- [ ] Packaged tarball has correct structure
- [ ] No `workspace:*` references in packaged files
- [ ] Private packages NOT included in tarball

---

## Rollback Plan

If migration fails at any point:

```bash
# Restore from backup
cp tsconfig.base.json.backup tsconfig.base.json
cp tsconfig.json.backup tsconfig.json

# Remove tsup configs
rm packages/server/tsup.config.ts
rm packages/react/tsup.config.ts

# Restore package.json files
git checkout package.json packages/*/package.json

# Clean and rebuild
rm -rf packages/*/dist packages/*/dist-ts node_modules
bun install
bun run build
```

---

## Success Criteria

Migration is successful when:

1. ✅ Single `tsconfig.json` at root (no `tsconfig.base.json`)
2. ✅ No `.js` extensions in source code
3. ✅ Published packages have NO internal dependencies
4. ✅ Private packages (types, lib, client) have no dist/ output
5. ✅ Published packages bundle internal code
6. ✅ Build time reduced by >50%
7. ✅ All tests pass
8. ✅ TypeScript errors resolved
9. ✅ npm publish --dry-run succeeds

---

## References

- [TanStack Query Repository](https://github.com/TanStack/query)
- [tsup Documentation](https://tsup.egoist.dev/)
- [TypeScript emitDeclarationOnly](https://www.typescriptlang.org/tsconfig#emitDeclarationOnly)
- [Module Resolution: Bundler](https://www.typescriptlang.org/docs/handbook/modules/reference.html#module-resolution-bundler)
- [Bundling Peer Dependencies](https://tsup.egoist.dev/#mark-dependencies-as-external)
