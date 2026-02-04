# Section 4: Extraction Tools

**Complexity:** M (Medium)  
**Dependencies:** Section 1 (types/errors), Section 2 (client, files)  
**Estimated time:** 1 hour

## Objective

Implement a single extraction tool `nutrient_extract_text` that supports three modes: plain text, key-value pairs, and tables. This consolidates what the spec described as three separate tools into one (per ARCHITECTURE.md simplification).

## Context

### How extraction works in the DWS API

Extraction uses the same `/build` endpoint but with `output.type = "json-content"`. The API returns **JSON** (not a file), so the response is parsed and returned inline to the agent.

**DWS instructions for text extraction:**
```json
{
  "parts": [{ "file": "<key>" }],
  "output": { "type": "json-content", "plainText": true, "language": "english" }
}
```

**DWS instructions for key-value pair extraction:**
```json
{
  "parts": [{ "file": "<key>" }],
  "output": { "type": "json-content", "keyValuePairs": true, "language": "english" }
}
```

**DWS instructions for table extraction:**
```json
{
  "parts": [{ "file": "<key>" }],
  "output": { "type": "json-content", "tables": true, "language": "english" }
}
```

**Important:** The API response for `json-content` is JSON text, not a binary file. The tool should return the extracted content as `output` string (not write it to a file).

### Difference from file-output tools

Unlike convert/OCR/watermark tools that write files, extraction tools:
- Do NOT take `outputPath`
- Return the API response JSON as `ToolResponse.output`
- The response `data` will be a `string` (since content-type is `application/json`)

### Imports needed

```typescript
import type { ToolDefinition, ToolContext, ToolResponse } from '../types.js';
import { formatError } from '../errors.js';
import { readFileReference, buildFormData } from '../files.js';
```

**Project root:** `/Users/nuthome/GdPicture-Java/nutrient-openclaw-plugin/`

## Files to Create

### 1. `src/tools/extract-text.ts`

A single tool with a `mode` parameter to select extraction type.

**Parameters (JSON Schema):**
```json
{
  "type": "object",
  "required": ["filePath"],
  "properties": {
    "filePath": {
      "type": "string",
      "description": "Path to input document (PDF, image, DOCX, etc.)"
    },
    "mode": {
      "type": "string",
      "enum": ["text", "tables", "key-values"],
      "default": "text",
      "description": "Extraction mode: 'text' for plain text, 'tables' for tabular data, 'key-values' for detected key-value pairs (phone numbers, emails, dates, etc.)"
    },
    "language": {
      "type": ["string", "array"],
      "description": "OCR language(s) for text extraction (default: 'english'). Can be a single language string or an array of languages.",
      "default": "english"
    }
  }
}
```

**execute logic:**
```typescript
async execute(args, ctx) {
  try {
    const { filePath, mode = 'text', language = 'english' } = args;

    const fileRef = readFileReference(filePath, ctx.sandboxDir);
    const fileRefs = new Map([[fileRef.key, fileRef]]);

    // Build output config based on mode
    const output: Record<string, unknown> = { type: 'json-content' };
    if (mode === 'text') {
      output.plainText = true;
    } else if (mode === 'tables') {
      output.tables = true;
    } else if (mode === 'key-values') {
      output.keyValuePairs = true;
    }

    // Add language
    output.language = language;

    const instructions = {
      parts: [{ file: fileRef.key }],
      output,
    };

    const body = buildFormData(instructions, fileRefs);
    const response = await ctx.client.post('build', body);

    // Log credits
    if (response.creditsUsed != null) {
      ctx.credits.log({
        operation: `extract-${mode}`,
        requestCost: response.creditsUsed,
        remainingCredits: response.creditsRemaining,
      });
    }

    // Response data is JSON string for json-content output
    const resultText = typeof response.data === 'string'
      ? response.data
      : Buffer.from(response.data).toString('utf-8');

    return {
      success: true,
      output: resultText,
      credits_used: response.creditsUsed ?? undefined,
    };
  } catch (e) {
    return formatError(e);
  }
}
```

## Acceptance Criteria

- [ ] `src/tools/extract-text.ts` exports a `ToolDefinition` named `nutrient_extract_text`
- [ ] Mode `"text"` sends `{ output: { type: "json-content", plainText: true } }`
- [ ] Mode `"tables"` sends `{ output: { type: "json-content", tables: true } }`
- [ ] Mode `"key-values"` sends `{ output: { type: "json-content", keyValuePairs: true } }`
- [ ] Default mode is `"text"`, default language is `"english"`
- [ ] Language can be a string or array of strings
- [ ] Response data is returned as `ToolResponse.output` string (not written to file)
- [ ] No `outputPath` parameter exists
- [ ] Credits are logged via `ctx.credits.log()`
- [ ] Errors are caught and formatted via `formatError()`
- [ ] `npm run build` succeeds

## Code to Port

| Source File | What to Port |
|---|---|
| `/tmp/nutrient-dws-mcp-server/src/schemas.ts` | `JSONContentOutputSchema` — defines the `plainText`, `keyValuePairs`, `tables`, `language` fields. Convert from Zod to JSON Schema. |
| `/tmp/nutrient-dws-mcp-server/src/dws/build.ts` | `performBuildCall()` — the JSON content response handling branch (`if (instructions.output?.type === 'json-content')`) |
| `/tmp/nutrient-dws-mcp-server/src/dws/utils.ts` | `handleJsonContentResponse()` — reads stream to string. Simplified in our case since `client.post()` already returns `string` for JSON responses. |

## Tests Required

Covered in Section 9. Key test cases:
- Mode `"text"`: correct instructions built with `plainText: true`
- Mode `"tables"`: correct instructions built with `tables: true`
- Mode `"key-values"`: correct instructions built with `keyValuePairs: true`
- Default mode is `"text"` when not specified
- Language parameter forwarded correctly (string and array)
- API response string returned as `output`
- File not found → FileError
- API error → formatted error
