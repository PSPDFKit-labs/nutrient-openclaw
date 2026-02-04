# Product Specification: @nutrient-sdk/nutrient-openclaw

**Version:** 1.0.0-draft  
**Date:** 2026-02-04  
**Status:** Pre-implementation  

---

## 1. Problem Statement

AI agents increasingly need to process documents — convert formats, extract text, redact sensitive data, digitally sign, and more. Today, the only integration path for Nutrient's Document Web Services (DWS) API is via an MCP server (`@anthropic/nutrient-dws-mcp-server`), which requires MCP protocol overhead and a separate server process.

OpenClaw is a growing agent platform with a native plugin system that registers tools directly into the agent's tool namespace. A native OpenClaw plugin eliminates the MCP middleman: tools appear natively alongside the agent's built-in capabilities, with zero protocol overhead, simpler configuration, and tighter integration with the agent's filesystem and config system.

**This plugin brings Nutrient document processing to every OpenClaw agent as a first-class capability.**

---

## 2. Target Users

**Primary:** Agent developers building document-processing workflows on OpenClaw.

- Comfortable with API keys, npm, and plugin configuration
- Building agents that handle contracts, invoices, reports, compliance documents
- Need programmatic document manipulation within agent tool chains

**Not primary (v1):** End users seeking a turnkey "process my PDF" experience. However, tool descriptions must be clear enough for LLMs to select and invoke correctly without developer intervention at runtime.

---

## 3. Architecture Overview

### 3.1 Plugin Structure

```
@nutrient-sdk/nutrient-openclaw/
├── openclaw.plugin.json        # Plugin manifest (config schema, metadata)
├── package.json                # npm package config
├── src/
│   ├── index.ts                # Plugin entry — registers all tools via api.registerTool()
│   ├── client.ts               # HTTP client for Nutrient DWS API
│   ├── files.ts                # File I/O and sandbox resolution
│   ├── credits.ts              # Credit balance helper
│   └── tools/
│       ├── convert.ts          # nutrient_convert
│       ├── ocr.ts              # nutrient_ocr
│       ├── watermark.ts        # nutrient_watermark
│       ├── merge.ts            # nutrient_merge
│       ├── redact.ts           # nutrient_redact
│       ├── ai-redact.ts        # nutrient_ai_redact
│       ├── sign.ts             # nutrient_sign
│       ├── extract-text.ts     # nutrient_extract_text
│       ├── extract-kv.ts       # nutrient_extract_kv
│       ├── extract-table.ts    # nutrient_extract_table
│       ├── html-to-pdf.ts      # nutrient_html_to_pdf
│       └── credits.ts          # nutrient_credits
├── dist/                       # Compiled output
├── tsconfig.json
├── README.md
└── LICENSE                     # MIT
```

### 3.2 Plugin Entry Point

Following the OpenClaw plugin convention (as established by `@getfoundry/unbrowse-openclaw`), the plugin exports a default function that receives an `api` object:

```typescript
// src/index.ts
export default function nutrientPlugin(api: any) {
  const config = api.getConfig();  // Reads from openclaw.plugin.json configSchema
  const apiKey = config.NUTRIENT_API_KEY || process.env.NUTRIENT_API_KEY;
  const sandboxDir = config.sandboxDir;  // Optional

  // Register each tool
  api.registerTool({ name: "nutrient_convert", ... });
  api.registerTool({ name: "nutrient_ocr", ... });
  // ... etc
}
```

### 3.3 Plugin Manifest (`openclaw.plugin.json`)

```json
{
  "id": "nutrient-openclaw",
  "name": "Nutrient Document Processing",
  "description": "AI-native document processing for OpenClaw agents. Convert, OCR, redact, sign, extract, and watermark documents using the Nutrient Document Web Services API.",
  "version": "1.0.0",
  "repository": "github:nicofisch5/nutrient-openclaw-plugin",
  "configSchema": {
    "type": "object",
    "additionalProperties": false,
    "properties": {
      "NUTRIENT_API_KEY": {
        "type": "string",
        "description": "Nutrient DWS API key. Get one at https://dashboard.nutrient.io/sign_up"
      },
      "sandboxDir": {
        "type": "string",
        "description": "Optional directory to restrict file read/write operations. When set, all file paths are resolved relative to this directory. When unset, direct filesystem access is allowed."
      }
    }
  },
  "uiHints": {
    "NUTRIENT_API_KEY": {
      "label": "API Key",
      "help": "Your Nutrient Document Web Services API key",
      "sensitive": true,
      "placeholder": "your-api-key-here"
    },
    "sandboxDir": {
      "label": "Sandbox Directory",
      "help": "Restrict file operations to this directory (optional)",
      "placeholder": "/path/to/documents"
    }
  }
}
```

### 3.4 `package.json` Essentials

```json
{
  "name": "@nutrient-sdk/nutrient-openclaw",
  "version": "1.0.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "license": "MIT",
  "openclaw": {
    "extensions": ["./dist/index.js"]
  },
  "files": [
    "dist/",
    "openclaw.plugin.json"
  ],
  "peerDependencies": {
    "openclaw": "*"
  },
  "peerDependenciesMeta": {
    "openclaw": { "optional": true }
  },
  "dependencies": {
    "form-data": "^4.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "typescript": "^5.7.0"
  }
}
```

---

## 4. Tool Design

### 4.1 Design Principle: One Tool Per Capability

Each tool has a single, clear purpose with explicit parameters. This follows the OpenClaw convention (matching Unbrowse's pattern of `unbrowse_capture`, `unbrowse_replay`, etc.) and is optimal for LLM tool selection — the model can reliably pick `nutrient_convert` vs `nutrient_ocr` without parsing a complex instruction schema.

All tools are prefixed with `nutrient_` to avoid namespace collisions.

### 4.2 Tool Catalog

#### `nutrient_convert`

Convert documents between formats. Supports Office → PDF, Image → PDF, PDF → Image, PDF → Office, PDF → PDF/A, PDF → PDF/UA.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `filePath` | string | ✅ | Path to input file |
| `outputPath` | string | ✅ | Path for output file |
| `outputFormat` | enum | ✅ | `"pdf"`, `"pdfa"`, `"pdfua"`, `"png"`, `"jpeg"`, `"webp"`, `"docx"`, `"xlsx"`, `"pptx"` |
| `password` | string | ❌ | Password if input is encrypted |
| `pages` | object | ❌ | `{ start: number, end: number }` — page range (0-based, -1 = last) |
| `pdfaConformance` | enum | ❌ | `"pdfa-1a"`, `"pdfa-1b"`, `"pdfa-2a"`, `"pdfa-2u"`, `"pdfa-2b"`, `"pdfa-3a"`, `"pdfa-3u"` (only for `pdfa` output) |
| `imageDpi` | number | ❌ | Resolution for image output (default: 150) |

**Returns:** Success message with output file path, or error.

**Example invocation by LLM:**
```json
{
  "filePath": "/documents/report.docx",
  "outputPath": "/documents/report.pdf",
  "outputFormat": "pdf"
}
```

#### `nutrient_html_to_pdf`

Convert HTML content or an HTML file to PDF. Uses the DWS API's HTML-to-PDF pipeline.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `filePath` | string | ✅ | Path to HTML file |
| `outputPath` | string | ✅ | Path for output PDF |
| `orientation` | enum | ❌ | `"portrait"`, `"landscape"` |
| `pageSize` | string or object | ❌ | Preset (`"A4"`, `"Letter"`, etc.) or `{ width, height }` in mm |
| `margin` | object | ❌ | `{ left, top, right, bottom }` in mm |

**Returns:** Success message with output file path.

#### `nutrient_ocr`

Perform OCR on a document to make text searchable/extractable.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `filePath` | string | ✅ | Path to input PDF or image |
| `outputPath` | string | ✅ | Path for output PDF |
| `language` | string | ✅ | OCR language (e.g., `"english"`, `"german"`, `"french"`) |

**Returns:** Success message with output file path.

**Implementation:** Wraps the `/build` endpoint with `ocr` action + PDF output.

#### `nutrient_watermark`

Add a text or image watermark to a document.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `filePath` | string | ✅ | Path to input PDF |
| `outputPath` | string | ✅ | Path for output PDF |
| `watermarkType` | enum | ✅ | `"text"` or `"image"` |
| `text` | string | ❌ | Watermark text (required if type is `"text"`) |
| `imagePath` | string | ❌ | Path to watermark image (required if type is `"image"`) |
| `width` | string or number | ❌ | Width in points or percentage (e.g., `"50%"`) |
| `height` | string or number | ❌ | Height in points or percentage |
| `opacity` | number | ❌ | 0–1, default 0.7 |
| `rotation` | number | ❌ | Degrees counterclockwise, default 0 |
| `fontColor` | string | ❌ | Hex color for text watermarks (e.g., `"#FF0000"`) |
| `fontSize` | number | ❌ | Font size in points |

**Returns:** Success message with output file path.

#### `nutrient_merge`

Merge multiple documents into a single PDF.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `filePaths` | string[] | ✅ | Array of input file paths (in merge order) |
| `outputPath` | string | ✅ | Path for merged output PDF |
| `pageRanges` | object[] | ❌ | Per-file page ranges: `[{ start, end }]` matching `filePaths` order |

**Returns:** Success message with output file path.

**Implementation:** Wraps `/build` with multiple `parts`, each referencing a file.

#### `nutrient_redact`

Redact content from a document using pattern, text, or regex matching. Creates and applies redactions in a single call.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `filePath` | string | ✅ | Path to input PDF |
| `outputPath` | string | ✅ | Path for redacted output |
| `strategy` | enum | ✅ | `"preset"`, `"regex"`, or `"text"` |
| `preset` | enum | ❌ | One of: `"credit-card-number"`, `"date"`, `"email-address"`, `"international-phone-number"`, `"ipv4"`, `"ipv6"`, `"mac-address"`, `"north-american-phone-number"`, `"social-security-number"`, `"time"`, `"url"`, `"us-zip-code"`, `"vin"` (required if strategy is `"preset"`) |
| `regex` | string | ❌ | Regex pattern (required if strategy is `"regex"`) |
| `text` | string | ❌ | Text to search for (required if strategy is `"text"`) |
| `caseSensitive` | boolean | ❌ | Case sensitivity for regex/text (default: true for regex, false for text) |
| `includeAnnotations` | boolean | ❌ | Also redact matching annotation content (default: true) |
| `startPage` | number | ❌ | Start page index, 0-based |
| `pageLimit` | number | ❌ | Number of pages to search from startPage |

**Returns:** Success message with output file path.

**Implementation:** Wraps `/build` with `createRedactions` + `applyRedactions` actions.

#### `nutrient_ai_redact`

AI-powered redaction — uses Nutrient's AI to detect and permanently remove sensitive information.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `filePath` | string | ✅ | Path to input document |
| `outputPath` | string | ✅ | Path for redacted output |
| `criteria` | string | ❌ | What to redact (default: `"All personally identifiable information"`). Examples: `"Names, email addresses, and phone numbers"`, `"Protected health information (PHI)"` |

**Returns:** Success message with output file path.

**Implementation:** Calls the `/ai/redact` endpoint directly. Timeout set to 5 minutes (AI analysis typically takes 60–120s).

#### `nutrient_sign`

Digitally sign a PDF document with a CMS or CAdES signature.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `filePath` | string | ✅ | Path to PDF to sign |
| `outputPath` | string | ✅ | Path for signed output |
| `signatureType` | enum | ❌ | `"cms"` or `"cades"` (default: `"cms"`) |
| `signerName` | string | ❌ | Name of person/org signing |
| `signatureReason` | string | ❌ | Reason for signing |
| `signatureLocation` | string | ❌ | Location of signing |
| `flatten` | boolean | ❌ | Flatten before signing (default: false) |
| `visible` | boolean | ❌ | Create a visible signature (default: false) |
| `pageIndex` | number | ❌ | Page for visible signature (0-based) |
| `rect` | number[] | ❌ | `[left, top, width, height]` in PDF points for visible signature |
| `watermarkImagePath` | string | ❌ | Path to watermark image for signature appearance |
| `graphicImagePath` | string | ❌ | Path to graphic image for signature appearance |
| `cadesLevel` | enum | ❌ | `"b-lt"`, `"b-t"`, `"b-b"` (default: `"b-lt"`, only for CAdES) |

**Returns:** Success message with output file path.

**Implementation:** Calls the `/sign` endpoint with FormData.

#### `nutrient_extract_text`

Extract plain text from a document via OCR.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `filePath` | string | ✅ | Path to input document |
| `language` | string | ❌ | OCR language (default: `"english"`) |
| `pages` | object | ❌ | `{ start, end }` page range |

**Returns:** Extracted text content as a string (returned inline, not written to file).

**Implementation:** Wraps `/build` with `json-content` output, `plainText: true`.

#### `nutrient_extract_kv`

Extract key-value pairs from a document (phone numbers, emails, dates, currencies, etc.).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `filePath` | string | ✅ | Path to input document |
| `language` | string | ❌ | OCR language (default: `"english"`) |
| `pages` | object | ❌ | `{ start, end }` page range |

**Returns:** JSON object containing detected key-value pairs.

**Implementation:** Wraps `/build` with `json-content` output, `keyValuePairs: true`.

#### `nutrient_extract_table`

Extract tabular data from a document.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `filePath` | string | ✅ | Path to input document |
| `language` | string | ❌ | OCR language (default: `"english"`) |
| `pages` | object | ❌ | `{ start, end }` page range |

**Returns:** JSON object containing extracted table data.

**Implementation:** Wraps `/build` with `json-content` output, `tables: true`.

#### `nutrient_credits`

Check current API credit balance.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| *(none)* | — | — | No parameters needed |

**Returns:** JSON object with `remainingCredits` (number or null if unavailable), `lastRequestCost` (from the most recent API call in this session, if any).

**Implementation:** Makes a lightweight API call (e.g., an empty build with minimal input) and reads the `x-pspdfkit-remaining-credits` response header. Alternatively, caches the last-seen credit values from any preceding tool call in the session.

---

## 5. HTTP Client

### 5.1 API Base URL

```
https://api.nutrient.io/
```

### 5.2 Endpoints Used

| Tool | DWS Endpoint | Method | Content-Type |
|------|-------------|--------|-------------|
| `nutrient_convert` | `/build` | POST | `multipart/form-data` or `application/json` (URL inputs) |
| `nutrient_html_to_pdf` | `/build` | POST | `multipart/form-data` |
| `nutrient_ocr` | `/build` | POST | `multipart/form-data` |
| `nutrient_watermark` | `/build` | POST | `multipart/form-data` |
| `nutrient_merge` | `/build` | POST | `multipart/form-data` |
| `nutrient_redact` | `/build` | POST | `multipart/form-data` |
| `nutrient_ai_redact` | `/ai/redact` | POST | `multipart/form-data` |
| `nutrient_sign` | `/sign` | POST | `multipart/form-data` |
| `nutrient_extract_*` | `/build` | POST | `multipart/form-data` |
| `nutrient_credits` | *(derived from headers)* | — | — |

### 5.3 Authentication

All API calls include:
```
Authorization: Bearer <NUTRIENT_API_KEY>
User-Agent: NutrientOpenClawPlugin/1.0.0
```

### 5.4 Response Handling

- **File responses** (convert, OCR, sign, etc.): Stream the response body to `outputPath`.
- **JSON responses** (extract_text, extract_kv, extract_table): Parse and return inline to the agent.
- **Credit headers**: Every response includes `x-pspdfkit-credit-usage` and `x-pspdfkit-remaining-credits`. Cache the latest values in memory for the `nutrient_credits` tool.

### 5.5 HTTP Library

Use Node.js built-in `fetch` (available in Node 18+) with `FormData` from the `form-data` package for multipart uploads. Avoid `axios` to keep dependencies minimal. If streaming writes are needed, use Node.js streams.

**Alternative:** If `form-data` proves insufficient, consider `undici` (ships with Node.js). The goal is zero native modules.

---

## 6. File I/O

### 6.1 Path Resolution

```typescript
function resolveReadPath(filePath: string, sandboxDir?: string): string {
  if (sandboxDir) {
    const resolved = path.resolve(sandboxDir, filePath);
    // Ensure resolved path is within sandbox (prevent traversal)
    if (!resolved.startsWith(path.resolve(sandboxDir))) {
      throw new Error(`Path "${filePath}" escapes sandbox directory`);
    }
    return resolved;
  }
  return path.resolve(filePath);
}

function resolveWritePath(filePath: string, sandboxDir?: string): string {
  const resolved = resolveReadPath(filePath, sandboxDir);
  // Ensure parent directory exists (create if needed)
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  return resolved;
}
```

### 6.2 Behaviors

- **With `sandboxDir` configured:** All paths resolve relative to the sandbox. Path traversal (`../`) that escapes the sandbox is rejected with a clear error.
- **Without `sandboxDir`:** Paths resolve against the process working directory (the agent's workspace). Absolute paths are accepted as-is.
- **Output directories:** Created automatically if they don't exist.
- **Input validation:** Check file exists and is readable before uploading to API.

---

## 7. Authentication & Configuration

### 7.1 API Key Resolution (Priority Order)

1. Plugin config: `configSchema.NUTRIENT_API_KEY` (set via OpenClaw plugin settings)
2. Environment variable: `NUTRIENT_API_KEY`
3. If neither is set: **do not error on startup**. Error on first tool invocation.

### 7.2 Lazy Validation

The API key is **not** validated at plugin load time. On first API call:

1. Resolve the key (config → env → error)
2. If missing, return a clear error:
   ```
   Error: NUTRIENT_API_KEY not configured. 
   Set it in the plugin config or as an environment variable.
   Get an API key at https://dashboard.nutrient.io/sign_up
   ```
3. If present but invalid (API returns 401), return:
   ```
   Error: Invalid NUTRIENT_API_KEY. Check your key at https://dashboard.nutrient.io
   ```

### 7.3 Rationale

Lazy validation avoids blocking plugin registration. The plugin should always load and register its tools, even if the key isn't configured yet. This matches OpenClaw's convention where plugins are installed before being configured.

---

## 8. Credit Tracking (v1)

### 8.1 Approach: Header-Based, In-Memory Only

Every DWS API response includes:
- `x-pspdfkit-credit-usage`: Credits consumed by this request
- `x-pspdfkit-remaining-credits`: Remaining balance

### 8.2 Implementation

```typescript
// In-memory credit state (per plugin session)
let lastCreditInfo: {
  remainingCredits: number | null;
  lastRequestCost: number | null;
  timestamp: string;
} | null = null;

function updateCreditInfo(responseHeaders: Record<string, string>) {
  const cost = Number(responseHeaders['x-pspdfkit-credit-usage']);
  const remaining = Number(responseHeaders['x-pspdfkit-remaining-credits']);
  
  lastCreditInfo = {
    remainingCredits: Number.isFinite(remaining) ? remaining : null,
    lastRequestCost: Number.isFinite(cost) ? cost : null,
    timestamp: new Date().toISOString(),
  };
}
```

### 8.3 `nutrient_credits` Tool Behavior

- If any API call has been made in this session: return cached `lastCreditInfo`
- If no API calls yet: make a minimal API call to retrieve current balance
- Always returns: `{ remainingCredits, lastRequestCost, timestamp }`

### 8.4 What's NOT in v1

- No SQLite or file-based persistence
- No historical usage tracking
- No per-operation cost breakdown over time
- No credit forecasting

---

## 9. Error Handling

### 9.1 Error Categories

| Category | Handling |
|----------|---------|
| Missing API key | Clear message with signup link |
| Invalid API key (401) | Clear message with dashboard link |
| File not found | `Error: File not found: <path>` |
| Path escapes sandbox | `Error: Path "<path>" escapes sandbox directory` |
| API error (4xx/5xx) | Forward DWS API error JSON (includes `details`, `requestId`, `failingPaths`) |
| Network error | `Error: Failed to connect to Nutrient API. Check your internet connection.` |
| Timeout | `Error: Request timed out. The document may be too large or complex.` |

### 9.2 Error Response Format

All tools return errors in the format the LLM can understand and potentially retry:

```typescript
return {
  success: false,
  error: "Human-readable error message",
  details: { /* optional structured error data from API */ }
};
```

### 9.3 Timeouts

| Operation | Timeout |
|-----------|---------|
| Standard operations (convert, OCR, merge, etc.) | 120 seconds |
| AI redaction | 300 seconds (5 min) |
| Sign | 120 seconds |

---

## 10. Non-Functional Requirements

| Requirement | Specification |
|-------------|--------------|
| **Language** | Pure TypeScript, compiled to ESM (`"type": "module"`) |
| **Native modules** | None. Zero native dependencies. |
| **License** | MIT |
| **Node.js** | ≥ 18 (for built-in `fetch`) |
| **npm scope** | `@nutrient-sdk` |
| **Package size** | Minimal — only `form-data` as runtime dependency |
| **Build** | `tsc` only, no bundler required |
| **Testing** | Unit tests for file resolution, tool parameter validation. Integration tests hitting DWS API (gated behind `NUTRIENT_API_KEY` env var). |
| **CI/CD** | Not required for v1. Manual `npm publish`. |

---

## 11. Out of Scope (v1)

| Feature | Reason |
|---------|--------|
| Flatten annotations | Lower priority; can be added post-v1 |
| Optimize / compress PDF | Lower priority |
| Form filling (Instant JSON) | Complex schema, lower priority for v1 |
| Historical credit tracking | Requires persistence layer; v1 is header-based only |
| SQLite / `better-sqlite3` | Native module — violates pure-TS constraint |
| Multiple API keys | Single key only for v1 |
| Onboarding wizard / guided setup | Target audience is developers |
| CI/CD pipeline | Manual publish for v1 |
| `clawdbot` / `moltbot` compatibility | Focus on OpenClaw only for v1 (trivial to add later via package.json aliases) |

---

## 12. Success Criteria

### 12.1 Installation

```bash
openclaw plugins install @nutrient-sdk/nutrient-openclaw
```

Must work out of the box. Plugin registers all tools on load.

### 12.2 End-to-End Smoke Test

An agent invocation of:
> "Convert this DOCX to PDF"

Must:
1. Select `nutrient_convert` tool
2. Execute with correct parameters
3. Call the DWS API
4. Write the PDF to the specified path
5. Return a success message

### 12.3 All v1 Tools Functional

Each of the 12 tools must be testable with a valid API key:

- [ ] `nutrient_convert` — DOCX → PDF, PDF → PNG, Image → PDF
- [ ] `nutrient_html_to_pdf` — HTML file → PDF
- [ ] `nutrient_ocr` — scanned PDF → searchable PDF
- [ ] `nutrient_watermark` — text watermark, image watermark
- [ ] `nutrient_merge` — 2+ PDFs → single PDF
- [ ] `nutrient_redact` — preset (SSN), regex, text strategies
- [ ] `nutrient_ai_redact` — AI-detected PII removal
- [ ] `nutrient_sign` — CMS digital signature
- [ ] `nutrient_extract_text` — text extraction from PDF
- [ ] `nutrient_extract_kv` — key-value pair extraction
- [ ] `nutrient_extract_table` — table extraction
- [ ] `nutrient_credits` — balance check

### 12.4 Documentation

README.md must include:
1. One-line install command
2. Configuration (API key setup)
3. Quick start example
4. Tool reference (all 12 tools with parameters)
5. Link to Nutrient DWS API docs

### 12.5 npm Publication

Published under `@nutrient-sdk/nutrient-openclaw` on npm. `npm install` resolves correctly.

---

## 13. Implementation Notes

### 13.1 DWS Build Instruction Mapping

Most tools map to the `/build` endpoint with different instruction configurations:

```typescript
// nutrient_convert: DOCX → PDF
{
  parts: [{ file: "input.docx" }],
  output: { type: "pdf" }
}

// nutrient_ocr: PDF → searchable PDF
{
  parts: [{ file: "scan.pdf" }],
  actions: [{ type: "ocr", language: "english" }],
  output: { type: "pdf" }
}

// nutrient_watermark: Add text watermark
{
  parts: [{ file: "doc.pdf" }],
  actions: [{ type: "watermark", watermarkType: "text", text: "DRAFT", width: "50%", height: "50%", opacity: 0.5 }],
  output: { type: "pdf" }
}

// nutrient_merge: Combine files
{
  parts: [{ file: "a.pdf" }, { file: "b.pdf" }],
  output: { type: "pdf" }
}

// nutrient_redact: Pattern-based redaction
{
  parts: [{ file: "doc.pdf" }],
  actions: [
    { type: "createRedactions", strategy: "preset", strategyOptions: { preset: "social-security-number" } },
    { type: "applyRedactions" }
  ],
  output: { type: "pdf" }
}

// nutrient_extract_text
{
  parts: [{ file: "doc.pdf" }],
  output: { type: "json-content", plainText: true }
}

// nutrient_html_to_pdf
{
  parts: [{ file: "page.html", layout: { orientation: "portrait", size: "A4" } }],
  output: { type: "pdf" }
}
```

### 13.2 FormData Construction

Files referenced in instructions are read from disk, assigned a sanitized key, and the instruction `file` field is replaced with the key. The file buffer is appended to the FormData under that key:

```typescript
const formData = new FormData();
const fileBuffer = fs.readFileSync(resolvedPath);
const fileKey = path.basename(resolvedPath).replace(/[^a-zA-Z0-9]/g, '_');
formData.append(fileKey, fileBuffer, { filename: path.basename(resolvedPath) });

// Replace file path with key in instructions
instructions.parts[0].file = fileKey;
formData.append('instructions', JSON.stringify(instructions));
```

### 13.3 URL Input Support

If a `filePath` starts with `http://` or `https://`, pass it directly in the instructions without reading from disk. The DWS API fetches it server-side. When all inputs are URLs, send `application/json` instead of FormData.

---

## Appendix A: OpenClaw Plugin API Surface (Observed)

Based on the Unbrowse reference implementation:

```typescript
interface OpenClawPluginAPI {
  /** Get plugin config values from openclaw.plugin.json configSchema */
  getConfig(): Record<string, any>;
  
  /** Register a tool that the agent can invoke */
  registerTool(tool: {
    name: string;
    description: string;
    parameters: JSONSchema;
    execute: (args: any) => Promise<any>;
  }): void;
}
```

The plugin's default export receives this API object:
```typescript
export default function myPlugin(api: OpenClawPluginAPI): void;
```

## Appendix B: DWS API Response Headers

| Header | Type | Description |
|--------|------|-------------|
| `x-pspdfkit-credit-usage` | string (number) | Credits consumed by this request |
| `x-pspdfkit-remaining-credits` | string (number) | Remaining credit balance |

These are present on all billable API responses.
