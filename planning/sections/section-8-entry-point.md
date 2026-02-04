# Section 8: Plugin Entry Point

**Complexity:** S (Small)  
**Dependencies:** Sections 1–7 (all tool modules, client, credits, types)  
**Estimated time:** 30 minutes

## Objective

Wire everything together in `index.ts` — the plugin entry point that receives the OpenClaw `api` object and registers all 10 tools.

## Context

### OpenClaw plugin convention

An OpenClaw plugin is a default-exported function that receives an `api` object:

```typescript
export default function myPlugin(api: OpenClawPluginAPI): void;

interface OpenClawPluginAPI {
  getConfig(): Record<string, any>;
  registerTool(tool: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;  // JSON Schema
    execute: (args: any) => Promise<any>;
  }): void;
}
```

### Design pattern

1. Read config from `api.getConfig()` (gets values from `openclaw.plugin.json` configSchema)
2. Resolve API key: config `apiKey` → env `NUTRIENT_API_KEY` → lazy error on first use
3. Create shared instances: `makeClient(apiKey)`, `new JsonlCreditTracker(sandboxDir)`
4. Create context: `{ client, credits, sandboxDir }`
5. Import all tool definitions
6. Loop and register each tool via `api.registerTool()`

### Lazy API key validation

The API key is NOT validated at plugin load time. If missing, the plugin still registers all tools. The first API call will fail with a clear error message from the client.

However, we should handle the case where no API key is available at all. The `makeClient` function needs a key, so we create a "lazy client" that resolves the key on first use.

### The 10 tools to register

1. `nutrient_convert_to_pdf` (from `src/tools/convert-to-pdf.ts`)
2. `nutrient_convert_to_image` (from `src/tools/convert-to-image.ts`)
3. `nutrient_convert_to_office` (from `src/tools/convert-to-office.ts`)
4. `nutrient_extract_text` (from `src/tools/extract-text.ts`)
5. `nutrient_ocr` (from `src/tools/ocr.ts`)
6. `nutrient_watermark` (from `src/tools/watermark.ts`)
7. `nutrient_redact` (from `src/tools/redact.ts`)
8. `nutrient_ai_redact` (from `src/tools/ai-redact.ts`)
9. `nutrient_sign` (from `src/tools/sign.ts`)
10. `nutrient_check_credits` (from `src/tools/check-credits.ts`)

**Project root:** `/Users/nuthome/GdPicture-Java/nutrient-openclaw-plugin/`

## Files to Create/Modify

### 1. `index.ts` (replace stub from Section 1)

```typescript
import { makeClient } from './src/client.js';
import { JsonlCreditTracker } from './src/credits.js';
import { ConfigError, formatError } from './src/errors.js';
import type { ToolContext, ToolDefinition, NutrientClient } from './src/types.js';

// Import all tool definitions
import { convertToPdf } from './src/tools/convert-to-pdf.js';
import { convertToImage } from './src/tools/convert-to-image.js';
import { convertToOffice } from './src/tools/convert-to-office.js';
import { extractText } from './src/tools/extract-text.js';
import { ocr } from './src/tools/ocr.js';
import { watermark } from './src/tools/watermark.js';
import { redact } from './src/tools/redact.js';
import { aiRedact } from './src/tools/ai-redact.js';
import { sign } from './src/tools/sign.js';
import { checkCredits } from './src/tools/check-credits.js';

/**
 * Nutrient Document Processing plugin for OpenClaw.
 *
 * Registers 10 document processing tools that call the Nutrient DWS API.
 * Configuration: apiKey (required), sandboxDir (optional).
 */
export default function nutrientPlugin(api: any) {
  const config = api.getConfig();

  // Resolve API key: config → env → lazy error
  const apiKey = config.apiKey || process.env.NUTRIENT_API_KEY;

  // Create a lazy client that errors on first use if no API key
  let client: NutrientClient;
  if (apiKey) {
    client = makeClient(apiKey);
  } else {
    // Proxy that throws ConfigError on any method call
    client = {
      post: async () => {
        throw new ConfigError(
          'NUTRIENT_API_KEY not configured. Set it in plugin settings or as an environment variable. ' +
          'Get an API key at https://dashboard.nutrient.io/sign_up'
        );
      },
    };
  }

  const sandboxDir = config.sandboxDir || undefined;
  const credits = new JsonlCreditTracker(sandboxDir);

  const ctx: ToolContext = { client, credits, sandboxDir };

  const tools: ToolDefinition[] = [
    convertToPdf,
    convertToImage,
    convertToOffice,
    extractText,
    ocr,
    watermark,
    redact,
    aiRedact,
    sign,
    checkCredits,
  ];

  for (const tool of tools) {
    api.registerTool({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
      execute: (args: any) => tool.execute(args, ctx),
    });
  }

  return {
    name: 'nutrient',
    version: '0.1.0',
  };
}
```

## Acceptance Criteria

- [ ] `index.ts` exports a default function that receives `api`
- [ ] All 10 tools are imported and registered via `api.registerTool()`
- [ ] API key resolved from config first, then env variable
- [ ] Missing API key does NOT prevent plugin from loading (lazy error)
- [ ] `sandboxDir` from config passed through to `ToolContext` and `JsonlCreditTracker`
- [ ] Each tool's `execute` is bound with the shared `ctx` object
- [ ] Plugin returns `{ name: 'nutrient', version: '0.1.0' }`
- [ ] `npm run build` succeeds
- [ ] All 10 tool names are registered: `nutrient_convert_to_pdf`, `nutrient_convert_to_image`, `nutrient_convert_to_office`, `nutrient_extract_text`, `nutrient_ocr`, `nutrient_watermark`, `nutrient_redact`, `nutrient_ai_redact`, `nutrient_sign`, `nutrient_check_credits`

## Code to Port

| Source File | What to Port |
|---|---|
| `/tmp/nutrient-dws-mcp-server/src/index.ts` | Overall plugin wiring pattern (tool registration loop). Replace `McpServer` / `server.tool()` with `api.registerTool()`. |
| `/tmp/nutrient-dws-mcp-server/src/dws/utils.ts` | `getApiKey()` — lazy key resolution. Adapted to check config first, then env. |

## Tests Required

Covered in Section 9. Key test cases:
- Plugin function calls `api.getConfig()` and `api.registerTool()` for each tool
- 10 tools registered with correct names
- Missing API key: plugin loads, tools registered, first API call throws ConfigError
- `sandboxDir` from config flows into context
