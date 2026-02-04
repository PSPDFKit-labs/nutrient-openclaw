# Section 5: Redaction Tools

**Complexity:** M (Medium)  
**Dependencies:** Section 1 (types/errors), Section 2 (client, files)  
**Estimated time:** 1–2 hours

## Objective

Implement two redaction tools:
1. `nutrient_redact` — pattern-based redaction (preset, regex, or text) via `/build`
2. `nutrient_ai_redact` — AI-powered redaction via `/ai/redact`

## Context

### Pattern-based redaction (`/build` endpoint)

Pattern-based redaction uses the `/build` endpoint with two actions chained together:
1. `createRedactions` — finds matching content and creates redaction annotations
2. `applyRedactions` — permanently removes the content under redaction annotations

**DWS instructions for preset redaction:**
```json
{
  "parts": [{ "file": "<key>" }],
  "actions": [
    {
      "type": "createRedactions",
      "strategy": "preset",
      "strategyOptions": {
        "preset": "social-security-number",
        "includeAnnotations": true,
        "start": 0,
        "limit": null
      }
    },
    { "type": "applyRedactions" }
  ],
  "output": { "type": "pdf" }
}
```

**DWS instructions for regex redaction:**
```json
{
  "parts": [{ "file": "<key>" }],
  "actions": [
    {
      "type": "createRedactions",
      "strategy": "regex",
      "strategyOptions": {
        "regex": "\\b\\d{3}-\\d{2}-\\d{4}\\b",
        "caseSensitive": true,
        "includeAnnotations": true
      }
    },
    { "type": "applyRedactions" }
  ],
  "output": { "type": "pdf" }
}
```

**DWS instructions for text redaction:**
```json
{
  "parts": [{ "file": "<key>" }],
  "actions": [
    {
      "type": "createRedactions",
      "strategy": "text",
      "strategyOptions": {
        "text": "John Doe",
        "caseSensitive": false,
        "includeAnnotations": true
      }
    },
    { "type": "applyRedactions" }
  ],
  "output": { "type": "pdf" }
}
```

### AI redaction (`/ai/redact` endpoint)

AI redaction uses a **different endpoint** (`/ai/redact`) with a different request format:
- `file1` field: the document to redact (multipart file)
- `data` field: JSON string with `{ documents: [{ documentId: "file1" }], criteria: "..." }`

The response is a binary PDF file (the redacted document).

**Timeout: 5 minutes (300,000ms)** — AI analysis typically takes 60–120 seconds.

### Available redaction presets
From the MCP server's `SearchPresetSchema`:
- `credit-card-number`, `date`, `email-address`, `international-phone-number`
- `ipv4`, `ipv6`, `mac-address`, `north-american-phone-number`
- `social-security-number`, `time`, `url`, `us-zip-code`, `vin`

**Project root:** `/Users/nuthome/GdPicture-Java/nutrient-openclaw-plugin/`

## Files to Create

### 1. `src/tools/redact.ts`

Pattern-based redaction tool.

**Parameters (JSON Schema):**
```json
{
  "type": "object",
  "required": ["filePath", "outputPath", "strategy"],
  "properties": {
    "filePath": { "type": "string", "description": "Path to input PDF" },
    "outputPath": { "type": "string", "description": "Path for redacted output PDF" },
    "strategy": {
      "type": "string",
      "enum": ["preset", "regex", "text"],
      "description": "Redaction strategy"
    },
    "preset": {
      "type": "string",
      "enum": ["credit-card-number", "date", "email-address", "international-phone-number", "ipv4", "ipv6", "mac-address", "north-american-phone-number", "social-security-number", "time", "url", "us-zip-code", "vin"],
      "description": "Preset pattern (required when strategy='preset')"
    },
    "regex": { "type": "string", "description": "Regex pattern (required when strategy='regex')" },
    "text": { "type": "string", "description": "Text to find and redact (required when strategy='text')" },
    "caseSensitive": { "type": "boolean", "description": "Case sensitivity (default: true for regex, false for text)" },
    "includeAnnotations": { "type": "boolean", "default": true, "description": "Also redact matching annotation content" },
    "startPage": { "type": "integer", "description": "Start page index (0-based)" },
    "pageLimit": { "type": "integer", "description": "Number of pages to search from startPage" }
  }
}
```

**execute logic:**
```typescript
async execute(args, ctx) {
  try {
    const { filePath, outputPath, strategy, preset, regex, text, caseSensitive, includeAnnotations = true, startPage, pageLimit } = args;

    // Validate strategy-specific required fields
    if (strategy === 'preset' && !preset) throw new FileError('preset is required when strategy is "preset"');
    if (strategy === 'regex' && !regex) throw new FileError('regex is required when strategy is "regex"');
    if (strategy === 'text' && !text) throw new FileError('text is required when strategy is "text"');

    assertOutputDiffersFromInput(filePath, outputPath, ctx.sandboxDir);

    const fileRef = readFileReference(filePath, ctx.sandboxDir);
    const fileRefs = new Map([[fileRef.key, fileRef]]);

    // Build strategyOptions based on strategy
    const strategyOptions: Record<string, unknown> = { includeAnnotations };
    if (startPage != null) strategyOptions.start = startPage;
    if (pageLimit != null) strategyOptions.limit = pageLimit;

    if (strategy === 'preset') strategyOptions.preset = preset;
    if (strategy === 'regex') { strategyOptions.regex = regex; strategyOptions.caseSensitive = caseSensitive ?? true; }
    if (strategy === 'text') { strategyOptions.text = text; strategyOptions.caseSensitive = caseSensitive ?? false; }

    const instructions = {
      parts: [{ file: fileRef.key }],
      actions: [
        { type: 'createRedactions', strategy, strategyOptions },
        { type: 'applyRedactions' },
      ],
      output: { type: 'pdf' },
    };

    const body = buildFormData(instructions, fileRefs);
    const response = await ctx.client.post('build', body);

    // Write output
    const resolvedOutput = writeResponseToFile(response.data as ArrayBuffer, outputPath, ctx.sandboxDir);

    // Log credits
    if (response.creditsUsed != null) {
      ctx.credits.log({ operation: 'redact', requestCost: response.creditsUsed, remainingCredits: response.creditsRemaining });
    }

    return { success: true, output: `Redacted: ${resolvedOutput}`, credits_used: response.creditsUsed ?? undefined };
  } catch (e) {
    return formatError(e);
  }
}
```

### 2. `src/tools/ai-redact.ts`

AI-powered redaction tool. Uses a completely different API endpoint and request format.

**Parameters (JSON Schema):**
```json
{
  "type": "object",
  "required": ["filePath", "outputPath"],
  "properties": {
    "filePath": { "type": "string", "description": "Path to input document" },
    "outputPath": { "type": "string", "description": "Path for redacted output" },
    "criteria": {
      "type": "string",
      "default": "All personally identifiable information",
      "description": "What to redact. Examples: 'Names, email addresses, and phone numbers', 'Protected health information (PHI)', 'Social security numbers and credit card numbers'"
    }
  }
}
```

**execute logic:**
```typescript
async execute(args, ctx) {
  try {
    const { filePath, outputPath, criteria = 'All personally identifiable information' } = args;

    assertOutputDiffersFromInput(filePath, outputPath, ctx.sandboxDir);

    const fileRef = readFileReference(filePath, ctx.sandboxDir);

    // AI redact uses a different request format than /build
    // file1: the document, data: JSON with documents array and criteria
    const formData = new FormData();

    if (fileRef.file) {
      const blob = new Blob([fileRef.file.buffer]);
      formData.append('file1', blob, fileRef.name);
    } else {
      throw new FileError('AI redaction requires a local file, not a URL');
    }

    formData.append('data', JSON.stringify({
      documents: [{ documentId: 'file1' }],
      criteria,
    }));

    // 5 minute timeout — AI analysis takes 60-120 seconds typically
    const response = await ctx.client.post('ai/redact', formData, { timeout: 300000 });

    const resolvedOutput = writeResponseToFile(response.data as ArrayBuffer, outputPath, ctx.sandboxDir);

    if (response.creditsUsed != null) {
      ctx.credits.log({ operation: 'ai-redact', requestCost: response.creditsUsed, remainingCredits: response.creditsRemaining });
    }

    return { success: true, output: `AI redaction complete: ${resolvedOutput}`, credits_used: response.creditsUsed ?? undefined };
  } catch (e) {
    return formatError(e);
  }
}
```

## Acceptance Criteria

- [ ] `src/tools/redact.ts` exports a `ToolDefinition` named `nutrient_redact`
- [ ] `src/tools/ai-redact.ts` exports a `ToolDefinition` named `nutrient_ai_redact`
- [ ] `nutrient_redact` validates strategy-specific required fields (preset, regex, text)
- [ ] `nutrient_redact` builds instructions with `createRedactions` + `applyRedactions` actions
- [ ] `nutrient_redact` supports all 13 preset patterns
- [ ] `nutrient_redact` correctly sets caseSensitive defaults (true for regex, false for text)
- [ ] `nutrient_ai_redact` calls `/ai/redact` endpoint (not `/build`)
- [ ] `nutrient_ai_redact` constructs FormData with `file1` and `data` fields (not `instructions`)
- [ ] `nutrient_ai_redact` uses 300s timeout
- [ ] Both tools use `assertOutputDiffersFromInput()`
- [ ] Both tools log credits and wrap errors in `formatError()`
- [ ] `npm run build` succeeds

## Code to Port

| Source File | What to Port |
|---|---|
| `/tmp/nutrient-dws-mcp-server/src/dws/ai-redact.ts` | `performAiRedactCall()` — entire function. Adapt: replace MCP sandbox with `readFileReference`, replace stream with ArrayBuffer, replace MCP response with `ToolResponse`. |
| `/tmp/nutrient-dws-mcp-server/src/schemas.ts` | `CreateRedactionsActionSchema`, `CreateRedactionsStrategyOptionsPresetSchema`, `CreateRedactionsStrategyOptionsRegexSchema`, `CreateRedactionsStrategyOptionsTextSchema`, `SearchPresetSchema` — convert Zod to JSON Schema. |
| `/tmp/nutrient-dws-mcp-server/src/schemas.ts` | `ApplyRedactionsActionSchema` — the chained action pattern. |

## Tests Required

Covered in Section 9. Key test cases:

**nutrient_redact:**
- Strategy "preset" builds correct instructions with preset name
- Strategy "regex" builds correct instructions with regex and caseSensitive=true
- Strategy "text" builds correct instructions with text and caseSensitive=false
- Missing preset when strategy="preset" → error
- Missing regex when strategy="regex" → error
- API called with `/build` endpoint

**nutrient_ai_redact:**
- FormData has `file1` (blob) and `data` (JSON string) fields
- API called with `/ai/redact` endpoint
- Timeout set to 300000ms
- URL inputs rejected (requires local file)
- Output differs from input check works
