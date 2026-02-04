# Section 1: Project Scaffolding

**Complexity:** S (Small)  
**Dependencies:** None  
**Estimated time:** 30 minutes

## Objective

Create the project skeleton with all config files, type definitions, and error classes. After this section, `npm install && npm run build` should succeed with zero errors (producing an empty but valid dist/).

## Context

This is an OpenClaw plugin — a npm package that exports a default function receiving an `api` object. The plugin uses:
- Pure TypeScript compiled to ESM
- Node.js 18+ (for built-in `fetch` and `FormData`)
- Zero runtime dependencies
- `vitest` for testing

**Project root:** `/Users/nuthome/GdPicture-Java/nutrient-openclaw-plugin/`

## Files to Create

### 1. `package.json`

```json
{
  "name": "@nutrient-sdk/nutrient-openclaw",
  "version": "0.1.0",
  "description": "OpenClaw plugin for document processing via Nutrient DWS API",
  "license": "MIT",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": ["dist/", "openclaw.plugin.json", "README.md", "LICENSE"],
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "tsc --noEmit",
    "prepublishOnly": "npm run build && npm run test"
  },
  "openclaw": {
    "extensions": ["./dist/index.js"]
  },
  "peerDependencies": {
    "openclaw": "*"
  },
  "peerDependenciesMeta": {
    "openclaw": { "optional": true }
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "typescript": "^5.7.0",
    "vitest": "^2.0.0"
  },
  "engines": {
    "node": ">=18"
  },
  "publishConfig": {
    "access": "public"
  }
}
```

### 2. `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": ".",
    "declaration": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "sourceMap": true
  },
  "include": ["index.ts", "src/**/*.ts"],
  "exclude": ["test", "node_modules", "dist"]
}
```

### 3. `vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
  },
});
```

### 4. `openclaw.plugin.json`

```json
{
  "id": "nutrient-openclaw",
  "name": "Nutrient Document Processing",
  "description": "Process, convert, sign, redact, OCR, and extract data from documents via the Nutrient DWS API.",
  "version": "0.1.0",
  "repository": "github:nicofisch5/nutrient-openclaw-plugin",
  "configSchema": {
    "type": "object",
    "required": ["apiKey"],
    "additionalProperties": false,
    "properties": {
      "apiKey": {
        "type": "string",
        "description": "Nutrient DWS API key (from https://www.nutrient.io/)"
      },
      "sandboxDir": {
        "type": "string",
        "description": "Optional directory to restrict file reads/writes. When set, all file paths are resolved relative to this directory."
      }
    }
  },
  "uiHints": {
    "apiKey": {
      "label": "API Key",
      "help": "Your Nutrient DWS API key",
      "sensitive": true,
      "placeholder": "pdf_live_..."
    },
    "sandboxDir": {
      "label": "Sandbox Directory",
      "help": "Restrict file operations to this directory (optional)",
      "placeholder": "~/documents"
    }
  }
}
```

### 5. `src/types.ts`

Shared TypeScript types used across all modules.

```typescript
/**
 * Standard response returned by every tool's execute() function.
 */
export interface ToolResponse {
  success: boolean;
  output?: string;
  error?: string;
  credits_used?: number;
}

/**
 * Context object passed to every tool's execute() function.
 * Created once in the plugin entry point and shared across all tools.
 */
export interface ToolContext {
  client: NutrientClient;
  credits: CreditTracker;
  sandboxDir?: string;
}

/**
 * HTTP client interface for the Nutrient DWS API.
 */
export interface NutrientClient {
  post(endpoint: string, body: FormData | object, opts?: { timeout?: number }): Promise<NutrientResponse>;
}

/**
 * Response from the Nutrient DWS API, parsed by the HTTP client.
 */
export interface NutrientResponse {
  ok: boolean;
  status: number;
  data: ArrayBuffer | string;
  headers: Record<string, string>;
  creditsUsed: number | null;
  creditsRemaining: number | null;
}

/**
 * Credit tracking interface. Implementations may use in-memory or JSONL storage.
 */
export interface CreditTracker {
  log(entry: CreditLogEntry): void;
  getBalance(): CreditBalance | null;
  getUsage(period: 'day' | 'week' | 'month' | 'all'): CreditUsageSummary;
}

export interface CreditLogEntry {
  operation: string;
  requestCost: number;
  remainingCredits: number | null;
  timestamp?: string;
}

export interface CreditBalance {
  remaining: number;
  asOf: string;
}

export interface CreditUsageSummary {
  period: { start: string; end: string };
  totalCredits: number;
  totalOperations: number;
  breakdown: Array<{
    operation: string;
    count: number;
    credits: number;
    avgCost: number;
  }>;
}

/**
 * Tool definition shape. Every tool module exports an object matching this interface.
 */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;  // JSON Schema
  execute: (args: any, ctx: ToolContext) => Promise<ToolResponse>;
}

/**
 * Represents a file reference used when building FormData for the DWS API.
 * Ported from MCP server's src/dws/types.ts.
 */
export interface FileReference {
  key: string;
  file?: {
    buffer: Buffer;
    path: string;
  };
  url?: string;
  name: string;
}
```

### 6. `src/errors.ts`

Error classes and formatting utility.

```typescript
import type { ToolResponse } from './types.js';

export class NutrientApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public creditsUsed?: number,
    public details?: unknown
  ) {
    super(message);
    this.name = 'NutrientApiError';
  }
}

export class FileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FileError';
  }
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

/**
 * Convert any error into a standardized ToolResponse.
 * Every tool's execute() wraps its body in try/catch → formatError().
 */
export function formatError(e: unknown): ToolResponse {
  if (e instanceof NutrientApiError) {
    return {
      success: false,
      error: `API error (${e.status}): ${e.message}`,
      credits_used: e.creditsUsed ?? undefined,
    };
  }
  if (e instanceof FileError) {
    return { success: false, error: `File error: ${e.message}` };
  }
  if (e instanceof ConfigError) {
    return { success: false, error: `Configuration error: ${e.message}` };
  }
  return {
    success: false,
    error: `Unexpected error: ${e instanceof Error ? e.message : String(e)}`,
  };
}
```

### 7. `index.ts` (stub)

A minimal placeholder so the project compiles. Section 8 will fill this in.

```typescript
export default function nutrientPlugin(_api: any) {
  // Tool registrations will be added in Section 8
  return { name: 'nutrient', version: '0.1.0' };
}
```

### 8. `LICENSE`

Standard MIT license file.

### 9. `README.md` (stub)

```markdown
# @nutrient-sdk/nutrient-openclaw

OpenClaw plugin for document processing via the Nutrient DWS API.

> Under construction. See planning/ for architecture docs.
```

## Acceptance Criteria

- [ ] `npm install` succeeds with no errors
- [ ] `npm run build` produces `dist/index.js`, `dist/index.d.ts`, `dist/src/types.js`, `dist/src/types.d.ts`, `dist/src/errors.js`, `dist/src/errors.d.ts`
- [ ] `npx tsc --noEmit` reports zero errors
- [ ] `ToolResponse`, `ToolContext`, `NutrientClient`, `NutrientResponse`, `ToolDefinition`, `FileReference` types are exported from `src/types.ts`
- [ ] `NutrientApiError`, `FileError`, `ConfigError`, `formatError` are exported from `src/errors.ts`
- [ ] `openclaw.plugin.json` is valid JSON with `configSchema` containing `apiKey` and `sandboxDir`
- [ ] `package.json` has `"type": "module"`, correct `main`/`types` fields, and `openclaw.extensions` pointing to `./dist/index.js`

## Code to Port

No direct code to port. Types are informed by:
- `/tmp/nutrient-dws-mcp-server/src/dws/types.ts` — `FileReference` type
- `/tmp/nutrient-dws-mcp-server/src/responses.ts` — response shape inspiration
- `/tmp/nutrient-dws-mcp-server/src/credits/storage.ts` — credit types (`OperationType`, `BalanceInfo`, `UsageSummaryRow`)

## Tests Required

None for this section (just build verification). Tests come in Section 9.
