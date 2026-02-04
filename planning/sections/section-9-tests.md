# Section 9: Tests

**Complexity:** M (Medium)  
**Dependencies:** Sections 1–8 (all source code must be in place)  
**Estimated time:** 2–3 hours

## Objective

Write unit tests for all modules using Vitest. All HTTP is mocked (no real API calls). Tests verify correct request construction, error handling, file I/O, and credit tracking.

## Context

### Test framework: Vitest

Already configured in Section 1 (`vitest.config.ts`, `devDependencies`). Run with `npm test`.

### Mock strategy

Every tool depends on a `ToolContext` with `client`, `credits`, and `sandboxDir`. We mock the client and use a real `JsonlCreditTracker` pointed at a temp directory.

**Mock client helper:**
```typescript
import { vi } from 'vitest';
import type { NutrientClient, NutrientResponse } from '../src/types.js';

export function mockClient(overrides: Partial<NutrientResponse> = {}): NutrientClient {
  return {
    post: vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: new ArrayBuffer(100),  // fake PDF bytes
      headers: {},
      creditsUsed: 1,
      creditsRemaining: 999,
      ...overrides,
    }),
  };
}

export function mockClientError(status: number, message: string): NutrientClient {
  const { NutrientApiError } = await import('../src/errors.js');
  return {
    post: vi.fn().mockRejectedValue(new NutrientApiError(status, message)),
  };
}
```

**Mock context helper:**
```typescript
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { JsonlCreditTracker } from '../src/credits.js';
import type { ToolContext } from '../src/types.js';

export function mockContext(clientOverrides: Partial<NutrientResponse> = {}): ToolContext {
  const sandboxDir = mkdtempSync(path.join(tmpdir(), 'nutrient-test-'));
  return {
    client: mockClient(clientOverrides),
    credits: new JsonlCreditTracker(sandboxDir),
    sandboxDir,
  };
}
```

### Test file structure

```
test/
├── helpers.ts                    # Mock factories (mockClient, mockContext)
├── fixtures/
│   └── sample.pdf               # Minimal valid PDF for file-read tests (can be a few bytes)
├── client.test.ts                # HTTP client tests (mock fetch globally)
├── files.test.ts                 # File I/O + path resolution tests
├── credits.test.ts               # JsonlCreditTracker tests
├── entry-point.test.ts           # Plugin entry point tests
└── tools/
    ├── convert-to-pdf.test.ts
    ├── convert-to-image.test.ts
    ├── convert-to-office.test.ts
    ├── extract-text.test.ts
    ├── ocr.test.ts
    ├── watermark.test.ts
    ├── redact.test.ts
    ├── ai-redact.test.ts
    ├── sign.test.ts
    └── check-credits.test.ts
```

**Project root:** `/Users/nuthome/GdPicture-Java/nutrient-openclaw-plugin/`

## Files to Create

### 1. `test/helpers.ts`

Mock factories as described above.

### 2. `test/fixtures/sample.pdf`

Create a minimal valid PDF file (just enough bytes to be readable):
```
%PDF-1.0
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [] /Count 0 >>
endobj
xref
0 3
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
trailer
<< /Size 3 /Root 1 0 R >>
startxref
109
%%EOF
```

### 3. `test/files.test.ts`

```typescript
describe('resolveReadPath', () => {
  it('resolves relative path against CWD when no sandbox', () => {});
  it('resolves relative path against sandboxDir when set', () => {});
  it('blocks traversal outside sandbox with ../', () => {});
  it('allows absolute path inside sandbox', () => {});
  it('blocks absolute path outside sandbox', () => {});
});

describe('resolveWritePath', () => {
  it('creates parent directories', () => {});
  it('respects sandbox constraints', () => {});
});

describe('readFileReference', () => {
  it('returns URL reference for http:// paths', () => {});
  it('returns URL reference for https:// paths', () => {});
  it('reads local file and returns FileReference with buffer', () => {});
  it('throws FileError for missing file', () => {});
  it('sanitizes filename for FormData key', () => {});
});

describe('buildFormData', () => {
  it('returns plain object when all inputs are URLs', () => {});
  it('returns FormData when any input is a local file', () => {});
});

describe('assertOutputDiffersFromInput', () => {
  it('throws when input and output paths resolve to same file', () => {});
  it('allows different paths', () => {});
});
```

### 4. `test/client.test.ts`

Mock `global.fetch` to test the HTTP client:

```typescript
describe('makeClient', () => {
  it('sends Authorization header with Bearer token', () => {});
  it('sends User-Agent header', () => {});
  it('sends Content-Type: application/json for object bodies', () => {});
  it('does not set Content-Type for FormData bodies', () => {});
  it('extracts credit headers from response', () => {});
  it('returns ArrayBuffer for binary responses', () => {});
  it('returns string for JSON responses', () => {});
  it('throws NutrientApiError on 401 response', () => {});
  it('throws NutrientApiError on 402 response', () => {});
  it('throws NutrientApiError on 500 response', () => {});
  it('throws NutrientApiError on timeout', () => {});
  it('parses error JSON from response body', () => {});
});
```

### 5. `test/credits.test.ts`

```typescript
describe('JsonlCreditTracker', () => {
  it('creates JSONL file on first log()', () => {});
  it('appends entries to existing file', () => {});
  it('getBalance() returns most recent entry with remainingCredits', () => {});
  it('getBalance() returns null when no entries', () => {});
  it('getBalance() skips entries without remainingCredits', () => {});
  it('getUsage("day") filters to today', () => {});
  it('getUsage("week") filters to last 7 days', () => {});
  it('getUsage("all") returns everything', () => {});
  it('getUsage() groups by operation', () => {});
  it('handles corrupt JSONL lines gracefully', () => {});
  it('handles missing file gracefully', () => {});
});
```

### 6. `test/entry-point.test.ts`

```typescript
describe('nutrientPlugin', () => {
  it('calls api.getConfig()', () => {});
  it('registers 10 tools', () => {});
  it('registers tools with correct names', () => {});
  it('returns { name: "nutrient", version: "0.1.0" }', () => {});
  it('works with missing API key (lazy error)', () => {});
  it('passes sandboxDir from config to context', () => {});
  it('resolves API key from env when not in config', () => {});
});
```

### 7. `test/tools/*.test.ts` (one per tool)

Each tool test file follows the same pattern:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { toolDefinition } from '../../src/tools/xxx.js';
import { mockContext } from '../helpers.js';

describe('nutrient_xxx', () => {
  it('has correct name and description', () => {
    expect(toolDefinition.name).toBe('nutrient_xxx');
    expect(toolDefinition.description).toBeTruthy();
  });

  it('happy path: builds correct API request and returns success', async () => {
    const ctx = mockContext();
    // Write a test file to sandbox
    // Call execute with valid args
    // Assert client.post was called with correct endpoint and instructions
    // Assert output file was written
    // Assert credits were logged
  });

  it('returns error for missing required params', async () => {
    const ctx = mockContext();
    const result = await toolDefinition.execute({}, ctx);
    expect(result.success).toBe(false);
  });

  it('returns formatted error on API failure', async () => {
    const ctx = mockContext();
    ctx.client = mockClientError(500, 'Internal Server Error');
    const result = await toolDefinition.execute(validArgs, ctx);
    expect(result.success).toBe(false);
    expect(result.error).toContain('API error');
  });

  it('returns error when file not found', async () => {});
});
```

**Tool-specific test cases:**

| Tool | Special Cases |
|---|---|
| `convert-to-pdf` | HTML layout options forwarded, password forwarded, page ranges |
| `convert-to-image` | Format, DPI, width/height in output config |
| `convert-to-office` | Format in output type |
| `extract-text` | Three modes (text/tables/key-values), response is string not file |
| `ocr` | Language in actions array |
| `watermark` | Text vs image variants, image adds extra file to FormData |
| `redact` | Three strategies, strategy-specific validation, caseSensitive defaults |
| `ai-redact` | Different endpoint (`ai/redact`), FormData format (`file1` + `data`), 5min timeout |
| `sign` | Different endpoint (`sign`), FormData format (`file` + `data`), watermark/graphic images, visible vs invisible |
| `check-credits` | Balance vs usage actions, period filtering |

## Acceptance Criteria

- [ ] `npm test` runs all tests and passes
- [ ] All tool tests verify: correct API endpoint, correct request body/instructions, success response, error handling
- [ ] `test/helpers.ts` provides reusable `mockClient`, `mockContext` factories
- [ ] File I/O tests use real temp directories (not mocked fs)
- [ ] HTTP client tests mock `global.fetch`
- [ ] Credit tracker tests use real temp directories
- [ ] No real API calls are made during testing
- [ ] Test coverage exists for all error paths: missing params, file not found, API errors, sandbox escape

## Code to Port

No direct code to port. Tests are written fresh to verify the ported implementations.

Reference test patterns from MCP server (if they exist):
- `/tmp/nutrient-dws-mcp-server/` — check for a `test/` directory (may not exist)

## Tests Required

This IS the tests section. All tests listed above must pass.
