# Research: @nutrient-sdk/nutrient-openclaw Plugin

**Date:** 2026-02-04  
**Status:** Research Complete

---

## 1. Similar Existing Solutions

### Direct Competitors / Related Projects

| Project | Type | Relationship |
|---------|------|-------------|
| **@nutrient-sdk/dws-mcp-server** ([GitHub](https://github.com/PSPDFKit/nutrient-dws-mcp-server)) | MCP Server | **Our source codebase.** Same Nutrient DWS API, same tools (document_processor, document_signer, ai_redactor, check_credits). We're porting this from MCP → OpenClaw plugin. MIT licensed, v0.0.5. |
| **@nutrient-sdk/node** (npm) | Node SDK | On-premise Nutrient SDK for Node.js. Native module (WASM/binary). Different from DWS (cloud API). Not a competitor — DWS is cloud-based, pay-per-use. |
| **nutrient-document-engine-mcp-server** ([GitHub](https://github.com/PSPDFKit/nutrient-document-engine-mcp-server)) | MCP Server | Self-hosted Document Engine variant. Different API surface, requires Docker. Not relevant for our cloud-API plugin. |

### OpenClaw Plugin Ecosystem (patterns to follow)

| Plugin | Key Takeaway |
|--------|-------------|
| **@getfoundry/unbrowse-openclaw** | Reference plugin. Uses `openclaw.plugin.json` manifest, `package.json` with `openclaw.extensions`, registers tools via `api.registerTool()`. Ships hooks. UNLICENSED (we'll use MIT). |
| **openclaw-foundry** ([GitHub](https://github.com/lekt9/openclaw-foundry)) | Best manifest example: `openclaw.plugin.json` with `id`, `name`, `description`, `version`, `configSchema`, `uiHints`, `skills`. |
| **@openclaw/voice-call** | Official plugin. Shows CLI command registration, RPC methods, background services. |
| **@maximem/maximem-memory** | Third-party npm plugin. Shows the `openclaw plugins install` workflow works for external packages. |

### Critical Pattern Details (from Unbrowse source code)

1. **Manifest files:** Unbrowse ships BOTH `openclaw.plugin.json` AND `clawdbot.plugin.json` as separate files. The `configSchema` lives in these manifests, NOT in package.json.
2. **package.json structure:** Has `openclaw`, `clawdbot`, `moltbot` top-level keys, each with `{ "extensions": ["./dist/index.js"], "hooks": [...] }`. All three point to the same entry point. Uses optional `peerDependencies` for all three platforms.
3. **`api.registerTool()` signature:** Takes a single object: `{ name, description, parameters (JSON Schema), execute(args) }`. Parameters use **plain JSON Schema** — NOT TypeBox, NOT Zod.
4. **Return format:** `execute()` returns **plain objects** (e.g., `{ success: true, message: "..." }`), NOT MCP-style `{ content: [{ type: "text", text: "..." }] }`. This is a key difference from the MCP server.
5. **Plugin entry:** Default export is a function `(api: any) => void`. No TypeScript types available — use `any` for the api parameter.
6. **No runtime deps in Unbrowse's package.json** — all functionality comes from native module or the api parameter.

### Gap Analysis
- **No document processing plugin exists for OpenClaw.** This would be the first.
- MCP servers exist but require separate process management. An OpenClaw plugin runs in-process — zero config, no stdio bridge.
- Competitive advantage: native integration with OpenClaw's file sandbox, tool allowlists, and agent routing.

---

## 2. Key Technical Challenges

### 2.1 Native Module Dependency (CRITICAL)
The MCP server uses **`better-sqlite3`** for credit tracking (SQLite with WAL mode). This is a **native C++ addon** that requires compilation.

**Problem:** The plugin spec says "pure TypeScript, no native modules." `better-sqlite3` has platform-specific prebuilds but is definitively a native module.

**Solutions (pick one):**
1. **Replace with `sql.js`** (pure WASM SQLite) — drop-in compatible API, ~2MB WASM bundle, no native compilation. Slight perf hit but credit tracking is low-volume.
2. **Replace with JSON file storage** — simplest. Credit tracking writes are infrequent. Use atomic writes with `fs.writeFileSync` + temp file rename. Loses SQL query power.
3. **Replace with SQLite via `node:sqlite`** — Node.js 22+ ships built-in SQLite (experimental). Node 25.3.0 (our runtime) should have it. Zero deps. **Recommended if stable enough.**
4. **Keep `better-sqlite3`** but document it as an optional native dep with graceful fallback.

**Recommendation:** Option 3 (`node:sqlite` built-in) or Option 1 (`sql.js` WASM). Both are zero-native-compile.

### 2.2 API Key Configuration
The MCP server reads `NUTRIENT_DWS_API_KEY` from environment. OpenClaw plugins use `configSchema` in the manifest for structured config.

**Approach:** Accept `apiKey` in `configSchema` (marked `sensitive: true` in `uiHints`). Fall back to `NUTRIENT_API_KEY` env var. The plugin reads `api.config.plugins.entries['nutrient-openclaw'].config.apiKey`.

### 2.3 File Sandbox Integration
The MCP server has its own sandbox implementation (`fs/sandbox.ts`). OpenClaw has its own sandbox system (`tools.sandbox`).

**Challenge:** Need to respect OpenClaw's sandbox boundaries while providing file I/O for document processing. The plugin should use `sandboxDir` from config or default to a temp directory.

**Approach:** Reuse the sandbox logic from the MCP server but wire it to the OpenClaw config's `sandboxDir`. When OpenClaw's own sandbox is active, the plugin should operate within it.

### 2.4 Streaming Response Handling
The Nutrient API returns responses as streams (`responseType: 'stream'`). The existing code pipes streams to buffers/files. This works fine in OpenClaw's in-process model — no change needed.

### 2.5 Tool Schema Translation (CORRECTED)
MCP uses Zod schemas. OpenClaw's `api.registerTool()` accepts **plain JSON Schema objects** (`{ type: "object", properties: {...} }`). Verified from Unbrowse source — no TypeBox, no Zod, just raw JSON Schema.

**Approach:** Manually convert existing Zod schemas to plain JSON Schema objects. This is straightforward — the Zod schemas in the MCP server are simple (string, enum, array of objects). No converter library needed; hand-write the JSON Schema for each tool. Zero deps for schemas.

### 2.6 Tool Count & Organization
The MCP server exposes 4 tools. For OpenClaw, we should consider splitting into more granular tools for better agent discoverability:
- `nutrient_process` (build API — convert, OCR, watermark, merge, flatten, optimize, redact, form-fill, HTML-to-PDF)
- `nutrient_sign` (digital signing)
- `nutrient_ai_redact` (AI-powered redaction)
- `nutrient_credits` (credit balance/usage/forecast)
- `nutrient_extract` (text/KV/table extraction — subset of build with `output.type: "json-content"`)

**Or keep consolidated** like the MCP server (4 tools). Agent UX testing will determine.

### 2.7 Tool Return Format (CORRECTED)
MCP returns `{ content: [{ type: "text", text: "..." }] }`. OpenClaw's `api.registerTool().execute()` returns **plain objects** (e.g., `{ success: true, message: "...", filePath: "..." }`). This is NOT MCP-compatible — **all tool return values must be rewritten** from MCP format to plain object format. This is a moderate migration effort across all tools.

### 2.8 Error Handling for Long Operations
AI redaction takes 60-120 seconds. OpenClaw tools have timeouts. Need to ensure the tool doesn't time out. The existing code sets a 5-minute axios timeout. Should work but needs testing with OpenClaw's agent timeout settings.

---

## 3. Dependencies / Libraries

### Required Dependencies

| Package | Purpose | Native? | Notes |
|---------|---------|---------|-------|
| `axios` | HTTP client for Nutrient API | No | Already used in MCP server. Could swap for native `fetch` (Node 18+) to reduce deps. |
| `form-data` | Multipart form uploads | No | Required for file uploads to Nutrient API. |
| `@sinclair/typebox` | Tool parameter schemas | No | OpenClaw's preferred schema library. OR use plain JSON Schema (zero dep). |

### Optional Dependencies

| Package | Purpose | Native? | Notes |
|---------|---------|---------|-------|
| `sql.js` | WASM SQLite for credit tracking | No (WASM) | Only if we want SQLite without native modules. |
| `zod-to-json-schema` | Convert existing Zod schemas | No | Only during migration. Can drop after converting. |
| `env-paths` | XDG-compliant data dirs | No | For credit DB location. Can inline the logic. |

### Dependencies to AVOID

| Package | Reason |
|---------|--------|
| `better-sqlite3` | Native C++ module. Breaks "pure TypeScript" requirement. |
| `@modelcontextprotocol/sdk` | MCP-specific. Not needed for OpenClaw plugin. |
| `zod` | Can replace with JSON Schema or TypeBox for OpenClaw. Zod is fine as devDep for validation tests. |

### Dependency Minimization Strategy
Target: **2-3 runtime deps** (axios, form-data, and optionally sql.js).
- Replace `env-paths` with inline `~/.openclaw/nutrient-dws/` path.
- Replace `zod` schemas with plain JSON Schema objects.
- Consider replacing `axios` with native `fetch` + `FormData` (Node 18+ has both). Would make it **zero external deps** for HTTP. BUT: native `fetch` doesn't support streaming responses as cleanly, and `FormData` in Node doesn't handle file buffers identically. Stick with axios for now.

---

## 4. Regulatory & Compliance Considerations

### 4.1 Data Privacy (GDPR, CCPA, HIPAA)
- **Documents are uploaded to Nutrient's cloud API** (`api.nutrient.io`). Users must understand their documents leave the local machine.
- Nutrient's DWS processes documents in-memory and doesn't persist them (per their docs), but this should be documented clearly.
- **AI Redaction** specifically processes PII/PHI — the irony of uploading PII to cloud to redact it. Document this risk.
- **Recommendation:** Add a prominent warning in the tool description and README about cloud processing. Consider a `requireConfirmation` flag for sensitive operations.

### 4.2 Digital Signatures
- The plugin creates CMS/CAdES digital signatures. These have **legal standing** in many jurisdictions (eIDAS, ESIGN Act).
- The API generates signing certificates on Nutrient's servers — the private key is Nutrient-managed, not user-controlled.
- For legally binding signatures, users may need their own certificates. Document this limitation.

### 4.3 API Key Security
- The API key is a bearer token with full account access. Mark as `sensitive: true` in `uiHints`.
- OpenClaw stores config in `~/.openclaw/config.yaml` — ensure users know the key is stored in plaintext.
- **Recommendation:** Support env var `NUTRIENT_API_KEY` as primary, config as fallback.

### 4.4 Credit/Cost Awareness
- Operations consume credits (real money). AI redaction is particularly expensive.
- **Recommendation:** The `check_credits` tool should be registered as a required (non-optional) tool. Include credit cost estimates in tool descriptions. Consider a `costWarning` field or pre-flight credit check.

### 4.5 License Compatibility
- MCP server: MIT license ✅
- OpenClaw: MIT-adjacent (check exact license) ✅
- All proposed deps (axios, form-data, sql.js): MIT/compatible ✅
- Publishing as MIT under `@nutrient-sdk` scope: Need publish access to the npm scope (owned by Nutrient/PSPDFKit).

### 4.6 Export Controls
- Document processing tools (especially redaction, signing) may have export control implications in some jurisdictions. Low risk for a cloud API wrapper but worth noting.

---

## 5. Architecture Recommendations

### Plugin Structure
```
@nutrient-sdk/nutrient-openclaw/
├── openclaw.plugin.json          # OpenClaw manifest (config + uiHints)
├── clawdbot.plugin.json          # Clawdbot manifest (same content, different file)
├── package.json                  # npm package with openclaw/clawdbot/moltbot extensions
├── tsconfig.json
├── src/
│   ├── index.ts                  # Plugin entry: export default (api: any) => { ... }
│   ├── tools/
│   │   ├── convert.ts            # nutrient_convert
│   │   ├── ocr.ts                # nutrient_ocr
│   │   ├── watermark.ts          # nutrient_watermark
│   │   ├── merge.ts              # nutrient_merge
│   │   ├── redact.ts             # nutrient_redact
│   │   ├── ai-redact.ts          # nutrient_ai_redact
│   │   ├── sign.ts               # nutrient_sign
│   │   ├── extract.ts            # nutrient_extract
│   │   ├── html-to-pdf.ts        # nutrient_html_to_pdf
│   │   └── credits.ts            # nutrient_credits
│   ├── api/
│   │   ├── client.ts             # Adapted from dws/api.ts (HTTP client)
│   │   └── utils.ts              # Stream helpers, error handling
│   └── sandbox.ts                # File path resolution
├── dist/                         # Compiled output
└── README.md
```

### Manifest (openclaw.plugin.json)
```json
{
  "id": "nutrient-openclaw",
  "name": "Nutrient Document Processing",
  "description": "AI-powered document processing via Nutrient DWS API — convert, sign, redact, OCR, merge, and more",
  "version": "0.1.0",
  "repository": "github:pspdfkit/nutrient-openclaw",
  "configSchema": {
    "type": "object",
    "additionalProperties": false,
    "properties": {
      "apiKey": { "type": "string", "description": "Nutrient DWS API key" },
      "sandboxDir": { "type": "string", "description": "Directory for document I/O (default: ~/.openclaw/nutrient-dws/)" }
    },
    "required": ["apiKey"]
  },
  "uiHints": {
    "apiKey": { "label": "API Key", "sensitive": true, "placeholder": "your-nutrient-api-key" },
    "sandboxDir": { "label": "Sandbox Directory", "placeholder": "~/.openclaw/nutrient-dws/" }
  }
}
```

### package.json Pattern (from Unbrowse)
```json
{
  "name": "@nutrient-sdk/nutrient-openclaw",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "license": "MIT",
  "files": ["dist", "openclaw.plugin.json", "clawdbot.plugin.json", "README.md", "LICENSE"],
  "openclaw": { "extensions": ["./dist/index.js"] },
  "clawdbot": { "extensions": ["./dist/index.js"] },
  "moltbot": { "extensions": ["./dist/index.js"] },
  "peerDependencies": { "openclaw": "*", "clawdbot": "*", "moltbot": "*" },
  "peerDependenciesMeta": {
    "openclaw": { "optional": true },
    "clawdbot": { "optional": true },
    "moltbot": { "optional": true }
  },
  "dependencies": { "axios": "^1.13.0", "form-data": "^4.0.5" }
}
```

### Config Example
```yaml
plugins:
  entries:
    nutrient-openclaw:
      enabled: true
      config:
        apiKey: "your-api-key-here"
        sandboxDir: "~/documents/nutrient"
```

---

## 6. Migration Effort Estimate

| Component | Effort | Notes |
|-----------|--------|-------|
| Plugin scaffolding (manifests ×2, package.json, entry point) | 1-2 hrs | Follow Unbrowse pattern exactly |
| Port HTTP client (`api.ts`, `utils.ts`) | 1-2 hrs | Remove MCP imports, adapt env var reading |
| Port & split tools (10 tools from 4 MCP tools) | 4-6 hrs | Convert Zod → JSON Schema, **rewrite return format** from MCP to plain objects, split monolith tools into individual tools |
| Credit balance tool (API call only, no storage) | 0.5 hrs | Simple HTTP call, return balance info |
| Sandbox integration | 1-2 hrs | Wire to OpenClaw config |
| Testing & docs | 2-3 hrs | |
| **Total** | **~10-16 hrs** | |

---

## 7. Remaining Open Questions

1. **npm scope access:** Do we have publish rights to `@nutrient-sdk` on npm? If not, alternative: `@openclaw/nutrient-dws` or `nutrient-openclaw`.
2. **Clawdbot/Moltbot compatibility:** Unbrowse supports all three platforms. We should too — just ship both `openclaw.plugin.json` and `clawdbot.plugin.json` plus the package.json fields.
3. **Node.js minimum version:** MCP server targets Node 18+. We should match. `axios` and `form-data` both support Node 18+.

### Resolved Questions (from questions.md)
- ✅ **Tool granularity:** Option B — one tool per capability, prefixed `nutrient_`
- ✅ **File I/O:** Optional sandboxDir, direct filesystem when not configured
- ✅ **MVP scope:** 10 tools (convert, HTML-to-PDF, OCR, watermark, merge, redact, AI redact, sign, extract, credits)
- ✅ **Credit tracking:** v1 = API call only, no SQLite/storage
- ✅ **Target user:** Agent developers (clear tool descriptions for LLMs)
- ✅ **Auth:** Config takes priority over env var; lazy validation on first API call
- ✅ **Tool naming:** `nutrient_convert`, `nutrient_ocr`, `nutrient_sign`, etc.
