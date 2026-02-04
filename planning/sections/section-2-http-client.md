# Section 2: HTTP Client + File I/O

**Complexity:** M (Medium)  
**Dependencies:** Section 1 (types, errors, project structure)  
**Estimated time:** 1–2 hours

## Objective

Create the shared HTTP client (`src/client.ts`) and file resolution utilities (`src/files.ts`). These are the foundational modules that every tool depends on.

## Context

### What this replaces from the MCP server
- `/tmp/nutrient-dws-mcp-server/src/dws/api.ts` — axios-based HTTP client → **rewrite with native `fetch`**
- `/tmp/nutrient-dws-mcp-server/src/dws/utils.ts` — stream helpers, error handling → **simplify (no streams)**
- `/tmp/nutrient-dws-mcp-server/src/dws/build.ts` — file reference processing, FormData construction → **port the `processFileReference` and `makeApiBuildCall` logic**
- `/tmp/nutrient-dws-mcp-server/src/fs/sandbox.ts` — path resolution with sandbox → **port and simplify**

### Key differences from MCP server
1. **`fetch` instead of `axios`** — zero dependencies, built into Node 18+
2. **`ArrayBuffer` instead of streams** — DWS returns single documents, not unbounded streams
3. **No `responseType: 'stream'`** — we buffer the entire response
4. **Credit headers extracted inline** — returned in `NutrientResponse`, not logged via separate function
5. **Sandbox is simpler** — config-based (`sandboxDir` from context), not global singleton

### API Details
- **Base URL:** `https://api.nutrient.io/`
- **Auth header:** `Authorization: Bearer <apiKey>`
- **User-Agent:** `NutrientOpenClawPlugin/0.1.0`
- **Credit headers on every response:**
  - `x-pspdfkit-credit-usage` — credits consumed
  - `x-pspdfkit-remaining-credits` — balance remaining

**Project root:** `/Users/nuthome/GdPicture-Java/nutrient-openclaw-plugin/`

## Files to Create

### 1. `src/client.ts`

The shared HTTP client. Implements the `NutrientClient` interface from `src/types.ts`.

```typescript
// src/client.ts
import { NutrientApiError } from './errors.js';
import type { NutrientClient, NutrientResponse } from './types.js';

const API_BASE = 'https://api.nutrient.io';
const CREDIT_USAGE_HEADER = 'x-pspdfkit-credit-usage';
const REMAINING_CREDITS_HEADER = 'x-pspdfkit-remaining-credits';

/**
 * Create an HTTP client for the Nutrient DWS API.
 *
 * Ported from: /tmp/nutrient-dws-mcp-server/src/dws/api.ts
 * Changes: fetch instead of axios, ArrayBuffer instead of streams,
 * credit headers returned in response object instead of logged separately.
 */
export function makeClient(apiKey: string): NutrientClient {
  return {
    async post(endpoint: string, body: FormData | object, opts: { timeout?: number } = {}): Promise<NutrientResponse> {
      const url = `${API_BASE}/${endpoint}`;
      const headers: Record<string, string> = {
        Authorization: `Bearer ${apiKey}`,
        'User-Agent': 'NutrientOpenClawPlugin/0.1.0',
      };

      const isFormData = body instanceof FormData;
      const fetchBody = isFormData ? body : JSON.stringify(body);
      if (!isFormData) {
        headers['Content-Type'] = 'application/json';
      }

      const controller = new AbortController();
      const timeoutId = opts.timeout
        ? setTimeout(() => controller.abort(), opts.timeout)
        : undefined;

      try {
        const res = await fetch(url, {
          method: 'POST',
          headers,
          body: fetchBody as any,
          signal: controller.signal,
        });

        const creditsUsed = parseFloat(res.headers.get(CREDIT_USAGE_HEADER) ?? '') || null;
        const creditsRemaining = parseFloat(res.headers.get(REMAINING_CREDITS_HEADER) ?? '') || null;

        // Extract response headers into a plain object
        const responseHeaders: Record<string, string> = {};
        res.headers.forEach((value, key) => {
          responseHeaders[key] = value;
        });

        const contentType = res.headers.get('content-type') ?? '';
        let data: ArrayBuffer | string;

        if (contentType.includes('json')) {
          data = await res.text();
        } else {
          data = await res.arrayBuffer();
        }

        // If the response is not OK, throw a NutrientApiError with details
        if (!res.ok) {
          let errorMessage = `HTTP ${res.status}`;
          let details: unknown = undefined;

          if (typeof data === 'string') {
            try {
              const errorJson = JSON.parse(data);
              errorMessage = errorJson.details || errorJson.message || errorMessage;
              details = errorJson;
            } catch {
              errorMessage = data || errorMessage;
            }
          }

          throw new NutrientApiError(res.status, errorMessage, creditsUsed ?? undefined, details);
        }

        return {
          ok: true,
          status: res.status,
          data,
          headers: responseHeaders,
          creditsUsed,
          creditsRemaining,
        };
      } catch (e) {
        if (e instanceof NutrientApiError) throw e;
        if (e instanceof DOMException && e.name === 'AbortError') {
          throw new NutrientApiError(0, `Request timed out after ${opts.timeout}ms`);
        }
        throw e;
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }
    },
  };
}
```

### 2. `src/files.ts`

File I/O utilities: path resolution (with sandbox support), file reading, response writing.

```typescript
// src/files.ts
import fs from 'node:fs';
import path from 'node:path';
import { FileError } from './errors.js';
import type { FileReference } from './types.js';

/**
 * Resolve a file path for reading. If sandboxDir is set, paths are resolved
 * relative to it and traversal outside is blocked.
 *
 * Ported from: /tmp/nutrient-dws-mcp-server/src/fs/sandbox.ts (resolveReadFilePath)
 */
export function resolveReadPath(filePath: string, sandboxDir?: string): string {
  if (sandboxDir) {
    const resolved = path.resolve(sandboxDir, filePath);
    if (!resolved.startsWith(path.resolve(sandboxDir) + path.sep) && resolved !== path.resolve(sandboxDir)) {
      throw new FileError(`Path "${filePath}" escapes sandbox directory`);
    }
    return resolved;
  }
  return path.resolve(filePath);
}

/**
 * Resolve a file path for writing. Creates parent directories if needed.
 *
 * Ported from: /tmp/nutrient-dws-mcp-server/src/fs/sandbox.ts (resolveWriteFilePath)
 */
export function resolveWritePath(filePath: string, sandboxDir?: string): string {
  const resolved = resolveReadPath(filePath, sandboxDir);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  return resolved;
}

/**
 * Read a file from disk and return a FileReference suitable for FormData construction.
 * If the reference is a URL (http:// or https://), return a URL reference instead.
 *
 * Ported from: /tmp/nutrient-dws-mcp-server/src/dws/build.ts (processFileReference)
 */
export function readFileReference(filePath: string, sandboxDir?: string): FileReference {
  // URL inputs are passed directly to the API (server-side fetch)
  if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
    return { key: filePath, url: filePath, name: filePath };
  }

  const resolvedPath = resolveReadPath(filePath, sandboxDir);

  if (!fs.existsSync(resolvedPath)) {
    throw new FileError(`File not found: ${filePath}`);
  }

  const stat = fs.statSync(resolvedPath);
  if (!stat.isFile()) {
    throw new FileError(`Not a file: ${filePath}`);
  }

  const fileBuffer = fs.readFileSync(resolvedPath);
  const fileName = path.basename(resolvedPath);
  const fileKey = fileName.replace(/[^a-zA-Z0-9]/g, '_');

  return {
    key: fileKey,
    name: fileName,
    file: { buffer: fileBuffer, path: resolvedPath },
  };
}

/**
 * Write API response data (ArrayBuffer) to disk.
 */
export function writeResponseToFile(data: ArrayBuffer, outputPath: string, sandboxDir?: string): string {
  const resolved = resolveWritePath(outputPath, sandboxDir);
  fs.writeFileSync(resolved, Buffer.from(data));
  return resolved;
}

/**
 * Build a FormData object from instructions and file references.
 * If all inputs are URLs, return the instructions as a plain object (JSON body).
 *
 * Ported from: /tmp/nutrient-dws-mcp-server/src/dws/build.ts (makeApiBuildCall)
 */
export function buildFormData(
  instructions: Record<string, unknown>,
  fileRefs: Map<string, FileReference>,
): FormData | Record<string, unknown> {
  const allUrls = Array.from(fileRefs.values()).every((ref) => ref.url);

  if (allUrls) {
    return instructions;
  }

  const formData = new FormData();
  formData.append('instructions', JSON.stringify(instructions));

  for (const [key, ref] of fileRefs.entries()) {
    if (ref.file) {
      const blob = new Blob([ref.file.buffer]);
      formData.append(key, blob, ref.name);
    }
  }

  return formData;
}

/**
 * Guard: ensure output path differs from input path.
 *
 * Ported from: /tmp/nutrient-dws-mcp-server/src/dws/ai-redact.ts (path comparison check)
 */
export function assertOutputDiffersFromInput(inputPath: string, outputPath: string, sandboxDir?: string): void {
  const resolvedInput = resolveReadPath(inputPath, sandboxDir);
  const resolvedOutput = resolveReadPath(outputPath, sandboxDir);
  if (path.resolve(resolvedInput) === path.resolve(resolvedOutput)) {
    throw new FileError('Output path must be different from input path to prevent data corruption');
  }
}
```

## Acceptance Criteria

- [ ] `src/client.ts` exports `makeClient(apiKey: string): NutrientClient`
- [ ] Client sends `Authorization: Bearer <key>` and `User-Agent` headers on every request
- [ ] Client extracts `x-pspdfkit-credit-usage` and `x-pspdfkit-remaining-credits` from response headers
- [ ] Client throws `NutrientApiError` for non-2xx responses with parsed error details
- [ ] Client supports timeout via `AbortController` and throws `NutrientApiError` on timeout
- [ ] Client returns `ArrayBuffer` for binary responses and `string` for JSON responses
- [ ] `src/files.ts` exports `resolveReadPath`, `resolveWritePath`, `readFileReference`, `writeResponseToFile`, `buildFormData`, `assertOutputDiffersFromInput`
- [ ] Path resolution with `sandboxDir` blocks traversal (`../` escaping sandbox)
- [ ] Path resolution without `sandboxDir` resolves against CWD
- [ ] `readFileReference` handles both local files and URLs
- [ ] `buildFormData` returns `FormData` for local files, plain object for all-URL inputs
- [ ] `npm run build` succeeds

## Code to Port (specific files)

| Source File | What to Port | Adaptation |
|---|---|---|
| `/tmp/nutrient-dws-mcp-server/src/dws/api.ts` | `callNutrientApi()`, `extractCreditHeaders()` | Replace axios with fetch, return structured `NutrientResponse` |
| `/tmp/nutrient-dws-mcp-server/src/dws/utils.ts` | `handleApiError()`, `handleFileResponse()` | Remove stream handling, use ArrayBuffer |
| `/tmp/nutrient-dws-mcp-server/src/dws/build.ts` | `processFileReference()`, `makeApiBuildCall()` | Move to `files.ts`, use native `FormData`/`Blob` |
| `/tmp/nutrient-dws-mcp-server/src/fs/sandbox.ts` | `resolvePath()`, `resolveReadFilePath()`, `resolveWriteFilePath()` | Simplify: no async, pass sandboxDir as param instead of global |

## Tests Required

Covered in Section 9, but the key test cases for these modules:

**client.ts:**
- Sends correct headers (auth, user-agent)
- Parses credit headers from response
- Throws NutrientApiError on 401, 402, 429, 500
- Throws on timeout
- Returns ArrayBuffer for binary, string for JSON

**files.ts:**
- `resolveReadPath` with sandbox blocks `../` traversal
- `resolveReadPath` without sandbox resolves against CWD
- `readFileReference` returns URL reference for http:// paths
- `readFileReference` throws FileError for missing files
- `buildFormData` returns FormData with file blobs
- `buildFormData` returns plain object when all inputs are URLs
- `assertOutputDiffersFromInput` throws when paths match
